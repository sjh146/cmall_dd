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

// ── M2-1: World ID 인간 증명 (Humanity) ────────────────────────────────
// 설계: M2-zk-auth-design.md §3.1 — 검증은 World ID Cloud Verify (자체 ZK 없음).
// 서버 저장: nullifier_hash / verification_level만 (프루프 원문 무영속).

// worldIDConfig — env에서 앱 설정 (미설정 시 fail-closed 503)
func worldIDConfig() (appID, actionID string, ok bool) {
	appID = os.Getenv("WORLD_ID_APP_ID")
	actionID = os.Getenv("WORLD_ID_ACTION_ID")
	ok = appID != "" && actionID != ""
	return
}

// HumanityNonce — POST /api/v1/wallet/humanity/nonce
// World ID 프루프 생성용 nonce 발급 (single-use, 5분 TTL, challenge_type=worldid)
func HumanityNonce(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, _, ok := worldIDConfig()
		if !ok {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "World ID not configured"})
			return
		}

		var req struct {
			WalletAddress string `json:"walletAddress"`
		}
		if err := c.ShouldBindJSON(&req); err != nil || !strings.HasPrefix(strings.ToLower(req.WalletAddress), "0x") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "walletAddress required"})
			return
		}
		wallet := strings.ToLower(req.WalletAddress)

		nonce, err := randomHex(32)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate nonce"})
			return
		}
		expires := time.Now().Add(5 * time.Minute)
		_, err = db.Exec(`
			INSERT INTO auth_challenges (wallet_address, nonce, challenge_type, expires_at)
			VALUES ($1, $2, 'worldid', $3)
		`, wallet, nonce, expires)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to store nonce"})
			return
		}

		_, actionID, _ := worldIDConfig()
		c.JSON(http.StatusOK, gin.H{
			"nonce":      nonce,
			"action_id":  actionID,
			"expires_at": expires.UTC().Format(time.RFC3339),
		})
	}
}

// HumanityVerify — POST /api/v1/wallet/humanity/verify (JWT)
// World ID Cloud Verify로 프루프 검증 → nullifier_hash를 wallets에 바인딩 (1인 1계정).
func HumanityVerify(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		appID, actionID, ok := worldIDConfig()
		if !ok {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "World ID not configured"})
			return
		}
		userID, _ := c.Get("userId")
		walletAddr, _ := c.Get("walletAddress")
		wallet := strings.ToLower(fmt.Sprintf("%v", walletAddr))

		var req struct {
			Nonce      string `json:"nonce" binding:"required"`
			Proof      string `json:"proof" binding:"required"`
			MerkleRoot string `json:"merkleRoot" binding:"required"`
			Signal     string `json:"signal" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "nonce/proof/merkleRoot/signal required"})
			return
		}

		// ① nonce 검증 — single-use + 만료 + 지갑 바인딩 (프루프 리플레이 방지)
		var usedAt *time.Time
		err := db.QueryRow(`
			SELECT used_at FROM auth_challenges
			WHERE nonce = $1 AND challenge_type = 'worldid' AND wallet_address = $2 AND expires_at > NOW()
		`, req.Nonce, wallet).Scan(&usedAt)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired nonce"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check nonce"})
			return
		}
		_, _ = db.Exec(`UPDATE auth_challenges SET used_at = NOW() WHERE nonce = $1`, req.Nonce)

		// ② signal = 지갑 주소 바인딩 확인 (프루프를 다른 지갑에 재사용 불가)
		if !strings.EqualFold(strings.TrimSpace(req.Signal), wallet) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "signal must match wallet address"})
			return
		}

		// ③ World ID Cloud Verify 호출 (자체 ZK 없음 — 검증된 SDK 인프라)
		body, _ := json.Marshal(map[string]string{
			"merkle_root":        req.MerkleRoot,
			"nullifier_hash":     "",
			"proof":              req.Proof,
			"verification_level": "device",
			"action":             actionID,
			"signal":             wallet,
		})
		verifyReq, _ := http.NewRequest(http.MethodPost,
			"https://developer.worldcoin.org/api/v1/verify/"+appID, bytes.NewReader(body))
		verifyReq.Header.Set("Content-Type", "application/json")
		client := &http.Client{Timeout: 15 * time.Second}
		resp, err := client.Do(verifyReq)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "World ID verification unavailable"})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))

		var wv struct {
			Success       bool   `json:"success"`
			NullifierHash string `json:"nullifier_hash"`
			Detail        string `json:"detail"`
		}
		_ = json.Unmarshal(respBody, &wv)

		if resp.StatusCode != http.StatusOK || !wv.Success || wv.NullifierHash == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "World ID verification failed", "detail": wv.Detail})
			return
		}

		// ④ nullifier_hash 저장 — UNIQUE (1인 1계정), 프루프 원문은 저장 안 함
		// 기존 지갑에 바인딩: wallets(user_id, wallet_address) 레코드가 있어야 함 (wallet/connect 선행)
		var credentialID string
		err = db.QueryRow(`
			INSERT INTO wallets (user_id, wallet_address, credential_id, verification_result, nullifier_hash, verification_level)
			VALUES ($1, $2, $3, 'verified', $4, 'device')
			ON CONFLICT (wallet_address) DO UPDATE
				SET credential_id = EXCLUDED.credential_id,
				    nullifier_hash = EXCLUDED.nullifier_hash,
				    verification_level = EXCLUDED.verification_level,
				    verification_result = 'verified',
				    updated_at = NOW()
			RETURNING credential_id
		`, userID, wallet, "wid_"+wv.NullifierHash, wv.NullifierHash).Scan(&credentialID)
		if err != nil {
			// nullifier_hash 중복(UNIQUE) = 이미 다른 계정에서 사용 — 1인 1계정 위반
			c.JSON(http.StatusConflict, gin.H{"error": "this World ID is already bound to another account"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"verified":           true,
			"credential_id":      credentialID,
			"verification_level": "device",
			"wallet_address":     wallet,
			"bound":              true,
		})
	}
}
