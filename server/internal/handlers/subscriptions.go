package handlers

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// ── M6: SaaS 구독 (SubscriptionManager 연동) ──────────────────────────────
// 온체인 구독(USDC approve → subscribe) 성사 후 cmall DB에 기록한다.
// entitlements는 subscriptions 테이블의 current_period_end로 만료를 검사한다.

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
