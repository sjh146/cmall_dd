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

	"github.com/gin-gonic/gin"
)

// ── M6: SaaS 구독 (SubscriptionManager 연동) ──────────────────────────────
// 온체인 구독(USDC approve → subscribe) 성사 후 cmall DB에 기록한다.
// entitlements는 subscriptions 테이블의 current_period_end로 만료를 검사한다.

// gatewayProxy — blockchain-gateway 내부 API 호출 (X-Internal-Api-Key)
func gatewayProxy(method, path string, body map[string]interface{}) (map[string]interface{}, error) {
	base := os.Getenv("BLOCKCHAIN_GATEWAY_URL")
	if base == "" {
		return nil, fmt.Errorf("BLOCKCHAIN_GATEWAY_URL not set")
	}
	var reader io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		reader = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, base+path, reader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Api-Key", internalKey("INTERNAL_API_KEY"))
	client := &http.Client{Timeout: 12 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("gateway invalid json: %s", string(respBody))
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("gateway returned %d: %s", resp.StatusCode, string(respBody))
	}
	return result, nil
}

// SubscriptionIntent — POST /api/v1/subscriptions/intent (JWT)
// 프론트가 지갑 approve + subscribe() 트랜잭션을 구성하도록 컨트랙트 정보 반환.
func SubscriptionIntent(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		if _, exists := c.Get("userId"); !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		var req struct {
			ProductID int `json:"productId" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		var amountUsdc int64
		var intervalDays int
		if err := db.QueryRow(
			`SELECT crypto_price_usdc, billing_interval_days FROM products WHERE id = $1 AND is_active = true`,
			req.ProductID,
		).Scan(&amountUsdc, &intervalDays); err != nil || intervalDays <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "not a subscription product"})
			return
		}
		res, err := gatewayProxy(http.MethodPost, "/internal/subscription/intent", map[string]interface{}{
			"planId":      fmt.Sprintf("%d", req.ProductID),
			"amountUsdc":  fmt.Sprintf("%d", amountUsdc),
			"intervalSec": fmt.Sprintf("%d", intervalDays*86400),
		})
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, res)
	}
}

// SubscriptionActive — GET /api/v1/subscriptions/active (JWT)
// (walletAddress, productId)의 온체인 활성 구독 조회 — 프론트 구독 완료 검증용.
func SubscriptionActive(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		if _, exists := c.Get("userId"); !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		wallet := c.Query("walletAddress")
		productID := c.Query("productId")
		if wallet == "" || productID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "walletAddress, productId required"})
			return
		}
		// CWE-639 (IDOR): 조회하려는 지갑이 로그인 사용자 본인의 지갑인지 DB로 검증 —
		// 타 사용자의 구독 상태를 읽을 수 없게 한다.
		userIDVal, _ := c.Get("userId")
		userID, _ := userIDVal.(int)
		var walletOwner int
		if err := db.QueryRow(
			"SELECT user_id FROM wallets WHERE wallet_address = LOWER($1)", strings.ToLower(wallet),
		).Scan(&walletOwner); err != nil || walletOwner != userID {
			c.JSON(http.StatusForbidden, gin.H{"error": "wallet not owned by user"})
			return
		}
		res, err := gatewayProxy(http.MethodGet,
			fmt.Sprintf("/internal/subscription/active?subscriber=%s&planId=%s", wallet, productID), nil)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, res)
	}
}

// CreateSubscription — POST /api/v1/subscriptions (JWT)
// 온체인 구독 성사 후 기록. 지갑 바인딩: JWT의 walletAddress와 일치해야 함 (CWE-862).
func CreateSubscription(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userId")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		var req struct {
			ProductID              int    `json:"productId" binding:"required"`
			WalletAddress          string `json:"walletAddress" binding:"required"`
			ContractSubscriptionID int64  `json:"contractSubscriptionId" binding:"required"`
			PeriodEnd              string `json:"periodEnd" binding:"required"` // RFC3339
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// 지갑 바인딩 검증 — 로그인한 지갑과 구독 지갑이 일치해야 함
		if jwtWallet, _ := c.Get("walletAddress"); jwtWallet != nil {
			if jwtWallet != req.WalletAddress {
				c.JSON(http.StatusForbidden, gin.H{"error": "wallet mismatch"})
				return
			}
		}

		periodEnd, err := time.Parse(time.RFC3339, req.PeriodEnd)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid periodEnd"})
			return
		}

		// 상품이 구독형인지 확인
		var intervalDays int
		if err := db.QueryRow(
			`SELECT billing_interval_days FROM products WHERE id = $1 AND is_active = true`,
			req.ProductID,
		).Scan(&intervalDays); err != nil || intervalDays <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "not a subscription product"})
			return
		}

		var amountUsdc int64
		_ = db.QueryRow(`SELECT crypto_price_usdc FROM products WHERE id = $1`, req.ProductID).Scan(&amountUsdc)

		_, err = db.Exec(`
			INSERT INTO subscriptions
				(product_id, user_id, wallet_address, contract_subscription_id,
				 status, amount_usdc, interval_days, current_period_start,
				 current_period_end, periods_paid)
			VALUES ($1, $2, $3, $4, 'active', $5, $6, NOW(), $7, 1)
			ON CONFLICT (product_id, user_id) DO UPDATE SET
				status = 'active',
				contract_subscription_id = EXCLUDED.contract_subscription_id,
				wallet_address = EXCLUDED.wallet_address,
				amount_usdc = EXCLUDED.amount_usdc,
				interval_days = EXCLUDED.interval_days,
				current_period_end = EXCLUDED.current_period_end,
				periods_paid = subscriptions.periods_paid + 1
		`, req.ProductID, userID, req.WalletAddress, req.ContractSubscriptionID,
			amountUsdc, intervalDays, periodEnd,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to record subscription"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"ok": true, "productId": req.ProductID, "periodEnd": periodEnd})
	}
}

// GetSubscriptions — GET /api/v1/subscriptions (JWT) — 내 구독 목록
func GetSubscriptions(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userId")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		rows, err := db.Query(`
			SELECT s.id, s.product_id, COALESCE(pr.name, ''), s.status,
			       s.amount_usdc, s.interval_days,
			       COALESCE(s.current_period_end, NOW()), s.auto_renew
			FROM subscriptions s
			LEFT JOIN products pr ON pr.id = s.product_id
			WHERE s.user_id = $1
			ORDER BY s.created_at DESC`, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load subscriptions"})
			return
		}
		defer rows.Close()

		type sub struct {
			ID            int64     `json:"id"`
			ProductID     int       `json:"productId"`
			ProductName   string    `json:"productName"`
			Status        string    `json:"status"`
			AmountUsdc    int64     `json:"amountUsdc"`
			IntervalDays  int       `json:"intervalDays"`
			PeriodEnd     time.Time `json:"periodEnd"`
			AutoRenew     bool      `json:"autoRenew"`
		}
		result := []sub{}
		for rows.Next() {
			var s sub
			if err := rows.Scan(&s.ID, &s.ProductID, &s.ProductName, &s.Status,
				&s.AmountUsdc, &s.IntervalDays, &s.PeriodEnd, &s.AutoRenew); err != nil {
				continue
			}
			result = append(result, s)
		}
		c.JSON(http.StatusOK, gin.H{"subscriptions": result})
	}
}
