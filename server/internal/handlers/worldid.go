package handlers

import (
	"bytes"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/crypto"
	"github.com/gin-gonic/gin"
)

// ── M2-1: World ID 인간 증명 (Humanity) ────────────────────────────────
// 설계: M2-zk-auth-design.md §3.1 — 검증은 World ID Cloud Verify (자체 ZK 없음).
// 서버 저장: nullifier_hash / verification_level만 (프루프 원문 무영속).

// mustRandomHex8 — 8바이트(16 hex) 랜덤 문자열 (오류 시 빈 값 — credential_id 접미용)
func mustRandomHex8() string {
	s, _ := randomHex(8)
	return s
}

// worldIDConfig — env에서 앱 설정 (미설정 시 fail-closed 503)
// RP ID: 신규 포털(developer.world.org) — v4 verify에 사용. app_id는 프론트 위젯용(하위호환).
func worldIDConfig() (appID, rpID, actionID string, ok bool) {
	appID = os.Getenv("WORLD_ID_APP_ID")
	rpID = os.Getenv("WORLD_ID_RP_ID")
	actionID = os.Getenv("WORLD_ID_ACTION_ID")
	ok = appID != "" && rpID != "" && actionID != ""
	return
}

// ZKPassportVerify — POST /api/v1/wallet/zkpassport (JWT)
// 프론트가 생성한 ZKPassport 증명을 gateway(/internal/zkpassport/verify)로 검증 위임 후
// 검증된 속성만 wallets.attributes(JSONB)에 저장 (원시 증명/여권 데이터 무영속 — 설계 §6).
func ZKPassportVerify(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userId")
		walletAddr, _ := c.Get("walletAddress")
		wallet := strings.ToLower(fmt.Sprintf("%v", walletAddr))

		var req struct {
			Proofs        interface{} `json:"proofs" binding:"required"`
			OriginalQuery interface{} `json:"originalQuery" binding:"required"`
			QueryResult   interface{} `json:"queryResult" binding:"required"`
			Validity      interface{} `json:"validity,omitempty"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "proofs/originalQuery/queryResult required"})
			return
		}

		base := gatewayURL()
		if base == "" {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "gateway not configured"})
			return
		}
		body, _ := json.Marshal(map[string]interface{}{
			"proofs":        req.Proofs,
			"originalQuery": req.OriginalQuery,
			"queryResult":   req.QueryResult,
			"validity":      req.Validity,
		})
		httpReq, _ := http.NewRequest(http.MethodPost, base+"/internal/zkpassport/verify", bytes.NewReader(body))
		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("X-Internal-Api-Key", internalKey("INTERNAL_API_KEY"))
		client := &http.Client{Timeout: 30 * time.Second}
		resp, err := client.Do(httpReq)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "gateway unavailable"})
			return
		}
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))

		var gw struct {
			Verified   bool        `json:"verified"`
			Attributes interface{} `json:"attributes"`
			Error      string      `json:"error"`
		}
		_ = json.Unmarshal(respBody, &gw)

		if resp.StatusCode != http.StatusOK || !gw.Verified {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "zkpassport verification failed", "detail": gw.Error})
			return
		}

		// 검증된 속성만 저장 (JSONB) — 원시 증명/여권 데이터 저장 금지
		attrsJSON, _ := json.Marshal(gw.Attributes)
		if attrsJSON == nil || string(attrsJSON) == "null" {
			attrsJSON = []byte("[]")
		}
		var credentialID string
		err = db.QueryRow(`
			INSERT INTO wallets (user_id, wallet_address, credential_id, verification_result, attributes)
			VALUES ($1, $2, $3, 'zkpassport_verified', $4::jsonb)
			ON CONFLICT (wallet_address) DO UPDATE
				SET attributes = EXCLUDED.attributes,
				    verification_result = 'zkpassport_verified',
				    updated_at = NOW()
			RETURNING credential_id
		`, userID, wallet, "zkp_"+mustRandomHex8(), string(attrsJSON)).Scan(&credentialID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to store attributes"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"verified":     true,
			"credential_id": credentialID,
			"attributes":   json.RawMessage(attrsJSON),
			"wallet_address": wallet,
		})
	}
}

// WorldIDPublicConfig — GET /api/v1/config/worldid (공개)
// 프론트가 app_id/action_id를 주입받기 위한 공개 설정 (app_id는 위젯에 이미 노출되는 값 — 비밀 아님)
func WorldIDPublicConfig(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		appID, _, actionID, ok := worldIDConfig()
		if !ok {
			c.JSON(http.StatusOK, gin.H{"enabled": false})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"enabled":   true,
			"app_id":    appID,
			"action_id": actionID,
		})
	}
}

// HumanityNonce — POST /api/v1/wallet/humanity/nonce
// World ID 프루프 생성용 nonce 발급 (single-use, 5분 TTL, challenge_type=worldid)
func HumanityNonce(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, _, _, ok := worldIDConfig()
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

		_, _, actionID, _ := worldIDConfig()
		c.JSON(http.StatusOK, gin.H{
			"nonce":      nonce,
			"action_id":  actionID,
			"expires_at": expires.UTC().Format(time.RFC3339),
		})
	}
}

// HumanityVerify — POST /api/v1/wallet/humanity/verify (JWT)
// World ID v4 Verify API(rp_id)로 프루프 검증 → nullifier_hash를 wallets에 바인딩 (1인 1계정).
func HumanityVerify(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		appID, rpID, actionID, ok := worldIDConfig()
		if !ok {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "World ID not configured"})
			return
		}
		userID, _ := c.Get("userId")
		walletAddr, _ := c.Get("walletAddress")
		wallet := strings.ToLower(fmt.Sprintf("%v", walletAddr))

		var req struct {
			Nonce             string `json:"nonce" binding:"required"`
			Proof             string `json:"proof" binding:"required"`
			MerkleRoot        string `json:"merkleRoot" binding:"required"`
			NullifierHash     string `json:"nullifierHash" binding:"required"`
			VerificationLevel string `json:"verificationLevel" binding:"required"`
			Signal            string `json:"signal" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "nonce/proof/merkleRoot/nullifierHash/verificationLevel/signal required"})
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

		// ③ World ID v4 Verify API (rp_id) — IDKit 결과를 그대로 전달 (legacy 3.0 proof)
		// signal_hash = keccak256(signal) — 지갑 주소 바인딩 (프루프가 특정 지갑에 고정)
		signalHash := "0x" + hex.EncodeToString(crypto.Keccak256([]byte(wallet)))
		body, _ := json.Marshal(map[string]interface{}{
			"protocol_version": "3.0",
			"nonce":            req.Nonce,
			"action":           actionID,
			"environment":      "production",
			"responses": []map[string]interface{}{{
				"identifier":  req.VerificationLevel,
				"merkle_root": req.MerkleRoot,
				"nullifier":   req.NullifierHash,
				"proof":       req.Proof,
				"signal_hash": signalHash,
			}},
		})
		client := &http.Client{Timeout: 15 * time.Second}

		verify := func(url string, payload []byte) (*http.Response, []byte, error) {
			req, _ := http.NewRequest(http.MethodPost, url, bytes.NewReader(payload))
			req.Header.Set("Content-Type", "application/json")
			resp, err := client.Do(req)
			if err != nil {
				return nil, nil, err
			}
			defer resp.Body.Close()
			b, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
			return resp, b, nil
		}

		var wv struct {
			Success       bool   `json:"success"`
			Nullifier     string `json:"nullifier"`
			NullifierHash string `json:"nullifier_hash"`
			Detail        string `json:"detail"`
		}

		// v4 우선 시도 (rp_id) — 앱이 4.0 미마이그레이션이면 v2로 폴백
		resp, respBody, err := verify("https://developer.world.org/api/v4/verify/"+rpID, body)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "World ID verification unavailable"})
			return
		}
		_ = json.Unmarshal(respBody, &wv)
		if resp.StatusCode == http.StatusBadRequest && strings.Contains(wv.Detail, "not been migrated") {
			// v2 폴백: legacy Cloud Verify (app_id, action, signal)
			body2, _ := json.Marshal(map[string]string{
				"merkle_root":        req.MerkleRoot,
				"nullifier_hash":     req.NullifierHash,
				"proof":              req.Proof,
				"verification_level": req.VerificationLevel,
				"action":             actionID,
				"signal":             wallet,
			})
			resp2, respBody2, err2 := verify("https://developer.world.org/api/v2/verify/"+appID, body2)
			if err2 != nil {
				c.JSON(http.StatusBadGateway, gin.H{"error": "World ID verification unavailable"})
				return
			}
			wv = struct {
				Success       bool   `json:"success"`
				Nullifier     string `json:"nullifier"`
				NullifierHash string `json:"nullifier_hash"`
				Detail        string `json:"detail"`
			}{}
			_ = json.Unmarshal(respBody2, &wv)
			resp = resp2
		}

		nullifier := wv.Nullifier
		if nullifier == "" {
			nullifier = wv.NullifierHash
		}

		if resp.StatusCode != http.StatusOK || !wv.Success || nullifier == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "World ID verification failed", "detail": wv.Detail})
			return
		}

		// ④ nullifier_hash 저장 — UNIQUE (1인 1계정), 프루프 원문은 저장 안 함
		var credentialID string
		err = db.QueryRow(`
			INSERT INTO wallets (user_id, wallet_address, credential_id, verification_result, nullifier_hash, verification_level)
			VALUES ($1, $2, $3, 'verified', $4, $5)
			ON CONFLICT (wallet_address) DO UPDATE
				SET credential_id = EXCLUDED.credential_id,
				    nullifier_hash = EXCLUDED.nullifier_hash,
				    verification_level = EXCLUDED.verification_level,
				    verification_result = 'verified',
				    updated_at = NOW()
			RETURNING credential_id
		`, userID, wallet, "wid_"+nullifier, nullifier, req.VerificationLevel).Scan(&credentialID)
		if err != nil {
			// nullifier_hash 중복(UNIQUE) = 이미 다른 계정에서 사용 — 1인 1계정 위반
			c.JSON(http.StatusConflict, gin.H{"error": "this World ID is already bound to another account"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"verified":           true,
			"credential_id":      credentialID,
			"verification_level": req.VerificationLevel,
			"wallet_address":     wallet,
			"bound":              true,
		})
	}
}
