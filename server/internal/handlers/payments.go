package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"cmall_dd/internal/models"
	"github.com/ethereum/go-ethereum/common"
	"github.com/gin-gonic/gin"
)

// ── 결제 (M3) ─────────────────────────────────────────────────────────────
// 흐름: createPayment → 사용자가 지갑에서 USDC 결제(컨트랙트) → getPayment가
// blockchain-gateway 온체인 검증 호출 → status=paid
// 시크릿 무영속: 서버는 결제 상태/참조 ID만 저장.

const paymentPending = "pending"
const paymentPaid = "paid"

// gatewayURL — blockchain-gateway 베이스 URL
func gatewayURL() string {
	return os.Getenv("BLOCKCHAIN_GATEWAY_URL") // e.g. http://blockchain-gateway:8090
}

// verifyWithGateway — blockchain-gateway에 결제 검증 요청
// 반환: {verified, tx_hash, order_id, payer, amount_usdc, chain_id}
func verifyWithGateway(referenceID string) (map[string]interface{}, error) {
	base := gatewayURL()
	if base == "" {
		return nil, fmt.Errorf("BLOCKCHAIN_GATEWAY_URL not set")
	}
	body, _ := json.Marshal(map[string]string{"reference_id": referenceID})
	req, err := http.NewRequest(http.MethodPost, base+"/internal/blockchain/payment/verify", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Api-Key", internalKey("INTERNAL_API_KEY"))

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("gateway returned %d: %s", resp.StatusCode, string(respBody))
	}
	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// paymentMatchesGateway — 게이트웨이가 반환한 온체인 금액/지갑이 레코드와 일치하는지 검증.
// amount_usdc (마이크로 단위) 이 payment.AmountUsdc와 동일하고,
// payer 지갑이 payment.WalletAddress(소문자)와 동일할 때만 true를 반환한다.
func paymentMatchesGateway(gatewayResult map[string]interface{}, payment *models.Payment) bool {
	amountOk := false
	if amtStr, ok := gatewayResult["amount_usdc"].(string); ok {
		if amt, err := strconv.ParseInt(amtStr, 10, 64); err == nil {
			amountOk = amt == payment.AmountUsdc
		}
	} else if amtNum, ok := gatewayResult["amount_usdc"].(float64); ok {
		amountOk = int64(amtNum) == payment.AmountUsdc
	}
	if !amountOk {
		return false
	}

	payer, ok := gatewayResult["payer"].(string)
	if !ok {
		return false
	}
	return strings.ToLower(strings.TrimSpace(payer)) == payment.WalletAddress
}

// registerWithGateway — 결제 주문 사전등록 (dev-mock: 게이트웨이 저장; 온체인: owner 서명 registerOrder)
// 실패해도 결제 생성은 차단하지 않는다 (온체인 등록은 게이트웨이 signer 연동 후 활성화).
// 실패 시 서버 로그에 기록 (B2/S5 — 조용한 실패 방지, 사용자 오류 일반화 유지).
func registerWithGateway(referenceID, walletAddress string, amountUsdc int64) {
	base := gatewayURL()
	if base == "" {
		return
	}
	body, _ := json.Marshal(map[string]interface{}{
		"reference_id":   referenceID,
		"wallet_address": walletAddress,
		"amount_usdc":    strconv.FormatInt(amountUsdc, 10),
	})
	req, err := http.NewRequest(http.MethodPost, base+"/internal/blockchain/payment/register", bytes.NewReader(body))
	if err != nil {
		log.Printf("[payments] register request build failed: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Api-Key", internalKey("INTERNAL_API_KEY"))

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[payments] register failed (ref=%s): %v", referenceID, err)
		return
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
	if resp.StatusCode != http.StatusOK {
		log.Printf("[payments] register returned %d (ref=%s): %s", resp.StatusCode, referenceID, string(respBody))
		return
	}
	log.Printf("[payments] register OK (ref=%s, wallet=%s, amount=%d)", referenceID, walletAddress, amountUsdc)
}

// CreatePayment — POST /api/v1/payments/create (JWT)
// 상품 → 결제 레코드 생성 (pending). amount_usdc는 products.crypto_price_usdc 사용.
func CreatePayment(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userId")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		walletAddr, _ := c.Get("walletAddress")

		var req models.CreatePaymentRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// 상품 + USDC 가격 조회
		var cryptoPrice int64
		err := db.QueryRow(
			"SELECT crypto_price_usdc FROM products WHERE id = $1", req.ProductID,
		).Scan(&cryptoPrice)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load product"})
			return
		}
		if cryptoPrice <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "product has no crypto price set (crypto_price_usdc)"})
			return
		}

		// 관리자 무료 구매: 지갑 연결·온체인 결제 없이 즉시 paid.
		// role은 JWT 클레임이 아니라 DB에서 재조회 (클레임 스푸핑 방지).
		var dbRole string
		if err := db.QueryRow("SELECT role FROM users WHERE id = $1", userID).Scan(&dbRole); err == nil && dbRole == "admin" {
			ref, err := randomHex(16)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate reference"})
				return
			}
			referenceID := "pay_" + ref
			zeroWallet := "0x0000000000000000000000000000000000000000"
			chainID := envInt("CHAIN_ID", 84532)
			var payment models.Payment
			err = db.QueryRow(`
				INSERT INTO payments (user_id, order_id, reference_id, wallet_address, amount_usdc, status, chain_id)
				VALUES ($1, $2, $3, $4, 0, 'paid', $5)
				RETURNING id, user_id, order_id, reference_id, wallet_address, amount_usdc, status, COALESCE(tx_hash, '') AS tx_hash, chain_id, created_at, updated_at
			`, userID, req.ProductID, referenceID, zeroWallet, chainID).Scan(
				&payment.ID, &payment.UserID, &payment.OrderID, &payment.ReferenceID, &payment.WalletAddress,
				&payment.AmountUsdc, &payment.Status, &payment.TxHash, &payment.ChainID,
				&payment.CreatedAt, &payment.UpdatedAt,
			)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create free payment"})
				return
			}
			c.JSON(http.StatusCreated, models.PaymentResponse{
				Payment:         payment,
				ContractAddress: os.Getenv("PAYMENT_CONTRACT_ADDRESS"),
				TokenAddress:    os.Getenv("USDC_TOKEN_ADDRESS"),
			})
			return
		}

		// 지갑 주소 (JWT에 없으면 wallets 테이블에서)
		wallet := fmt.Sprintf("%v", walletAddr)
		if wallet == "<nil>" || wallet == "" {
			err := db.QueryRow(
				"SELECT wallet_address FROM wallets WHERE user_id = $1 ORDER BY id DESC LIMIT 1", userID,
			).Scan(&wallet)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "wallet not connected"})
				return
			}
		}

		// 운영자 대행 결제 모드 (MetaMask 없는 사용자 — 주소만 연결) — dev 전용
		// pay()가 payer 바인딩을 강제하므로, 주문을 운영자 지갑(payer)으로 등록해야
		// dev-pay(운영자 키 approve+pay)가 성립한다. 결제 주체는 운영자 테스트 지갑.
		if req.PayerMode == "operator" {
			if os.Getenv("APP_ENV") != "dev" {
				c.JSON(http.StatusForbidden, gin.H{"error": "operator payer mode is dev-only"})
				return
			}
			operator := os.Getenv("DEV_PAYER_WALLET")
			if operator == "" {
				// 기본값: 배포 지갑 (운영자 키 소유) — .env에 DEV_PAYER_WALLET 명시 권장
				operator = "0x519c8b06D8E57969B4886e1028863BcDb0C425c4"
			}
			if !common.IsHexAddress(operator) {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "DEV_PAYER_WALLET misconfigured"})
				return
			}
			wallet = strings.ToLower(operator)
		}

		// reference_id + 레코드 생성
		ref, err := randomHex(16)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate reference"})
			return
		}
		referenceID := "pay_" + ref

		var payment models.Payment
		chainID := envInt("CHAIN_ID", 84532)
		err = db.QueryRow(`
			INSERT INTO payments (user_id, order_id, reference_id, wallet_address, amount_usdc, status, chain_id)
			VALUES ($1, $2, $3, $4, $5, 'pending', $6)
			RETURNING id, user_id, order_id, reference_id, wallet_address, amount_usdc, status, COALESCE(tx_hash, '') AS tx_hash, chain_id, created_at, updated_at
		`, userID, req.ProductID, referenceID, strings.ToLower(wallet), cryptoPrice, chainID).Scan(
			&payment.ID, &payment.UserID, &payment.OrderID, &payment.ReferenceID, &payment.WalletAddress,
			&payment.AmountUsdc, &payment.Status, &payment.TxHash, &payment.ChainID,
			&payment.CreatedAt, &payment.UpdatedAt,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create payment"})
			return
		}

		// 결제 주문 사전등록 (dev-mock 게이트웨이; 온체인 registerOrder는 signer 연동 후)
		registerWithGateway(payment.ReferenceID, payment.WalletAddress, payment.AmountUsdc)

		c.JSON(http.StatusCreated, models.PaymentResponse{
			Payment:         payment,
			ContractAddress: os.Getenv("PAYMENT_CONTRACT_ADDRESS"),
			TokenAddress:    os.Getenv("USDC_TOKEN_ADDRESS"),
		})
	}
}

// GetPayment — GET /api/v1/payments/:referenceId (JWT, 소유자 확인)
// pending 상태면 blockchain-gateway에 검증 요청 → paid 승격
func GetPayment(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userId")
		referenceID := c.Param("referenceId")

		var payment models.Payment
		err := db.QueryRow(`
			SELECT id, user_id, order_id, reference_id, wallet_address, amount_usdc, status, COALESCE(tx_hash, '') AS tx_hash, chain_id, created_at, updated_at
			FROM payments WHERE reference_id = $1
		`, referenceID).Scan(
			&payment.ID, &payment.UserID, &payment.OrderID, &payment.ReferenceID, &payment.WalletAddress,
			&payment.AmountUsdc, &payment.Status, &payment.TxHash, &payment.ChainID,
			&payment.CreatedAt, &payment.UpdatedAt,
		)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "payment not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load payment"})
			return
		}
		if payment.UserID != userID {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		// 온체인 검증 (pending일 때)
		if payment.Status == paymentPending {
			gatewayResult, gwErr := verifyWithGateway(payment.ReferenceID)
			if gwErr != nil {
				// 게이트웨이 미기동 — pending 유지, 클라이언트에 안내
				c.JSON(http.StatusOK, gin.H{"payment": payment, "verifyError": gwErr.Error()})
				return
			}
			if verified, _ := gatewayResult["verified"].(bool); verified {
				txHash, _ := gatewayResult["tx_hash"].(string)
				if !paymentMatchesGateway(gatewayResult, &payment) {
					// 온체인 금액/지갑이 레코드와 일치하지 않으면 paid 승격 금지
					c.JSON(http.StatusOK, gin.H{"payment": payment, "verifyError": "on-chain amount or payer does not match the recorded payment"})
					return
				}
				_, err = db.Exec(
					"UPDATE payments SET status = 'paid', tx_hash = $1, updated_at = NOW() WHERE reference_id = $2",
					txHash, payment.ReferenceID,
				)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update payment"})
					return
				}
				payment.Status = paymentPaid
				payment.TxHash = txHash
			}
		}

		c.JSON(http.StatusOK, gin.H{"payment": payment})
	}
}

// MyPurchases — GET /api/v1/my-purchases
// 내가 결제(paid)한 분석 상품 목록 + 연결된 분석 요청/결과 (My Products의 구매 내역)
func MyPurchases(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userId")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		rows, err := db.Query(`
			SELECT p.reference_id, p.wallet_address, p.amount_usdc, p.status, COALESCE(p.tx_hash, ''),
			       p.created_at,
			       pr.id, pr.name, pr.request_type,
			       COALESCE(a.id, 0), COALESCE(a.status, ''), COALESCE(a.result_json, ''),
			       COALESCE(a.updated_at, p.created_at)
			FROM payments p
			JOIN products pr ON pr.id = p.order_id
			LEFT JOIN LATERAL (
				SELECT * FROM analysis_requests a
				WHERE a.user_id = p.user_id AND a.request_type = pr.request_type
				ORDER BY a.id DESC LIMIT 1
			) a ON true
			WHERE p.user_id = $1 AND p.status = 'paid'
			ORDER BY p.created_at DESC
		`, userID)
		if err != nil {
			log.Printf("[payments] my-purchases query failed: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load purchases"})
			return
		}
		defer rows.Close()

		type purchaseItem struct {
			ReferenceID     string    `json:"referenceId"`
			WalletAddress   string    `json:"walletAddress"`
			AmountUsdc      int64     `json:"amountUsdc"`
			Status          string    `json:"status"`
			TxHash          string    `json:"txHash"`
			PurchasedAt     time.Time `json:"purchasedAt"`
			ProductID       int       `json:"productId"`
			ProductName     string    `json:"productName"`
			RequestType     string    `json:"requestType"`
			AnalysisID      int       `json:"analysisId"`
			AnalysisStatus  string    `json:"analysisStatus"`
			ResultJSON      string    `json:"resultJson"`
			AnalysisUpdated time.Time `json:"analysisUpdated"`
		}
		items := []purchaseItem{}
		for rows.Next() {
			var it purchaseItem
			if err := rows.Scan(&it.ReferenceID, &it.WalletAddress, &it.AmountUsdc, &it.Status, &it.TxHash,
				&it.PurchasedAt, &it.ProductID, &it.ProductName, &it.RequestType,
				&it.AnalysisID, &it.AnalysisStatus, &it.ResultJSON, &it.AnalysisUpdated); err != nil {
				log.Printf("[payments] my-purchases scan failed: %v", err)
				continue
			}
			items = append(items, it)
		}
		c.JSON(http.StatusOK, gin.H{"purchases": items})
	}
}

// GetAgents — GET /api/v1/agents
// 판매 중인 AI 분석 상품 (product_type='analysis' 또는 USDC 가격이 설정된 상품)
func GetAgents(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`
			SELECT id, seller_id, name, price, original_price, image, category, product_type,
			       request_type, version, download_url, file_size, license_key, description, features,
			       system_requirements, crypto_price_usdc, created_at, updated_at
			FROM products
			WHERE crypto_price_usdc > 0 AND is_active = true
			ORDER BY id DESC
		`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load agents"})
			return
		}
		defer rows.Close()

		type agentProduct struct {
			ID              int    `json:"id"`
			Name            string `json:"name"`
			Description     string `json:"description"`
			Category        string `json:"category"`
			ProductType     string `json:"productType"`
			RequestType     string `json:"requestType"`
			CryptoPriceUsdc int64  `json:"cryptoPriceUsdc"`
		}
		agents := []agentProduct{}
		for rows.Next() {
			var a agentProduct
			var sellerID, price, originalPrice interface{}
			var image, version, downloadURL, fileSize, licenseKey, features, systemReq string
			var createdAt, updatedAt interface{}
			if err := rows.Scan(&a.ID, &sellerID, &a.Name, &price, &originalPrice, &image, &a.Category,
				&a.ProductType, &a.RequestType, &version, &downloadURL, &fileSize, &licenseKey, &a.Description,
				&features, &systemReq, &a.CryptoPriceUsdc, &createdAt, &updatedAt); err != nil {
				continue
			}
		agents = append(agents, a)
	}
	c.JSON(http.StatusOK, gin.H{"agents": agents})
	}
}

// DevPayPayment — POST /api/v1/payments/:referenceId/dev-pay (dev 전용)
// MetaMask 없이 주소만 연결한 사용자의 결제를 운영자 키로 대행 실행.
// 게이트웨이 /execute가 approve+pay를 수행하고, 상태 승격은 GetPayment의
// 상태기반 verify 폴링으로 반영된다. (2026-08-13 사용자 요청)
func DevPayPayment(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		if os.Getenv("APP_ENV") != "dev" {
			c.JSON(http.StatusForbidden, gin.H{"error": "dev-pay is dev-only"})
			return
		}
		userID, _ := c.Get("userId")
		referenceID := c.Param("referenceId")

		var ownerID int64
		var status string
		err := db.QueryRow(
			"SELECT user_id, status FROM payments WHERE reference_id = $1", referenceID,
		).Scan(&ownerID, &status)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "payment not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load payment"})
			return
		}
		if fmt.Sprintf("%v", ownerID) != fmt.Sprintf("%v", userID) {
			c.JSON(http.StatusForbidden, gin.H{"error": "not your payment"})
			return
		}
		if status != "pending" {
			c.JSON(http.StatusConflict, gin.H{"error": "payment not pending"})
			return
		}

		// 게이트웨이에 운영자 대행 결제 실행 요청
		base := gatewayURL()
		if base == "" {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "gateway not configured"})
			return
		}
		body, _ := json.Marshal(map[string]interface{}{"reference_id": referenceID})
		req, err := http.NewRequest(http.MethodPost, base+"/internal/blockchain/payment/execute", bytes.NewReader(body))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "request build failed"})
			return
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Internal-Api-Key", internalKey("INTERNAL_API_KEY"))

		client := &http.Client{Timeout: 150 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "gateway execute failed"})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<16))

		var gw struct {
			Ok     bool   `json:"ok"`
			TxHash string `json:"tx_hash"`
			Error  string `json:"error"`
		}
		_ = json.Unmarshal(respBody, &gw)
		if resp.StatusCode != http.StatusOK || !gw.Ok {
			log.Printf("[payments] dev-pay failed (ref=%s): %d %s", referenceID, resp.StatusCode, string(respBody))
			c.JSON(http.StatusBadGateway, gin.H{"error": "onchain execute failed: " + gw.Error})
			return
		}

		c.JSON(http.StatusOK, gin.H{"ok": true, "txHash": gw.TxHash})
	}
}
