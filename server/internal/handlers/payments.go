package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"cmall_dd/internal/models"
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

// GetAgents — GET /api/v1/agents
// 판매 중인 AI 분석 상품 (product_type='analysis' 또는 USDC 가격이 설정된 상품)
func GetAgents(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`
			SELECT id, seller_id, name, price, original_price, image, category, product_type,
			       version, download_url, file_size, license_key, description, features,
			       system_requirements, crypto_price_usdc, created_at, updated_at
			FROM products
			WHERE crypto_price_usdc > 0
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
			CryptoPriceUsdc int64  `json:"cryptoPriceUsdc"`
		}
		agents := []agentProduct{}
		for rows.Next() {
			var a agentProduct
			var sellerID, price, originalPrice interface{}
			var image, version, downloadURL, fileSize, licenseKey, features, systemReq string
			var createdAt, updatedAt interface{}
			if err := rows.Scan(&a.ID, &sellerID, &a.Name, &price, &originalPrice, &image, &a.Category,
				&a.ProductType, &version, &downloadURL, &fileSize, &licenseKey, &a.Description,
				&features, &systemReq, &a.CryptoPriceUsdc, &createdAt, &updatedAt); err != nil {
				continue
			}
			agents = append(agents, a)
		}
		c.JSON(http.StatusOK, gin.H{"agents": agents})
	}
}
