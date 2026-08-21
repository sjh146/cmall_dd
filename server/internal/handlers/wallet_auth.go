package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"cmall_dd/internal/models"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// ── 지갑 인증 (M3) ────────────────────────────────────────────────────────
// 시크릿 무영속 원칙: 서버는 nonce/서명 검증 결과만 저장한다.
// 개인키/시드는 절대 서버에 존재하지 않는다. (red_dd 무영속 원칙 계승)

const (
	nonceTTL        = 5 * time.Minute
	loginMessageFmt = "cmall_dd login (chain %d)\nnonce: %s"
)

// personalSignHash — EIP-191 개인 서명 메시지 해시
func personalSignHash(message []byte) []byte {
	lenStr := itoa(len(message))
	prefixed := append([]byte("\x19Ethereum Signed Message:\n"), []byte(lenStr)...)
	return crypto.Keccak256(append(prefixed, message...))
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}

// randomHex — 암호학적 난수 hex 문자열
func randomHex(nBytes int) (string, error) {
	b := make([]byte, nBytes)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// WalletNonce — POST /api/v1/auth/nonce
// 지갑 주소에 대한 로그인 nonce 발급 (TTL 5분, single-use)
func WalletNonce(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.NonceRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		wallet := strings.ToLower(req.WalletAddress)
		if !common.IsHexAddress(wallet) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid wallet address"})
			return
		}

		nonce, err := randomHex(32)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate nonce"})
			return
		}

		chainID := envInt("CHAIN_ID", 84532)
		_, err = db.Exec(
			"INSERT INTO auth_challenges (wallet_address, nonce, challenge_type, expires_at) VALUES ($1, $2, 'login', $3)",
			wallet, nonce, time.Now().Add(nonceTTL),
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save challenge"})
			return
		}

		c.JSON(http.StatusOK, models.NonceResponse{
			Nonce:     nonce,
			Message:   sprintf(loginMessageFmt, chainID, nonce),
			ExpiresIn: int(nonceTTL.Seconds()),
		})
	}
}

// WalletVerify — POST /api/v1/auth/verify
// nonce 서명 검증 → 지갑 등록 → JWT 발급 (walletAddress claim 포함)
func WalletVerify(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.VerifyRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		wallet := strings.ToLower(req.WalletAddress)
		if !common.IsHexAddress(wallet) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid wallet address"})
			return
		}

		// ① 원자적 nonce consume (single-use — 리플레이 차단, 심층분석 S5)
		var challengeWallet string
		var challengeType string
		err := db.QueryRow(`
			UPDATE auth_challenges
			SET used_at = NOW()
			WHERE nonce = $1 AND used_at IS NULL AND expires_at > NOW()
			RETURNING wallet_address, challenge_type
		`, req.Nonce).Scan(&challengeWallet, &challengeType)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired nonce"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to consume nonce"})
			return
		}
		if !strings.EqualFold(challengeWallet, wallet) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "nonce issued for a different wallet"})
			return
		}

		// ② 서명 검증 — 항상 실제 EIP-191 개인 서명 검증 (dev-mock 우회 경로 제거, CWE-287)
		chainID := envInt("CHAIN_ID", 84532)
		msg := []byte(sprintf(loginMessageFmt, chainID, req.Nonce))
		recovered, err := recoverAddress(msg, req.Signature)
		if err != nil || !strings.EqualFold(recovered, wallet) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
			return
		}

		// ③ 사용자 조회/생성 — 로그인 상태면 그 계정에 지갑 바인딩 (2026-08-13 계정 분리 수정)
		//    비로그인 상태면 지갑 전용 계정 생성 (기존 동작)
		user, err := resolveUserWithWalletBinding(c, db, wallet)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to provision user"})
			return
		}

		// ④ 지갑 등록 (upsert)
		_, err = db.Exec(`
			INSERT INTO wallets (user_id, wallet_address, verification_result)
			VALUES ($1, $2, 'verified')
			ON CONFLICT (wallet_address) DO UPDATE SET verification_result = 'verified', updated_at = NOW()
		`, user.ID, wallet)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save wallet"})
			return
		}

		// ⑤ JWT 발급
		token, err := generateWalletToken(user, wallet)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
			return
		}

		c.JSON(http.StatusOK, models.WalletAuthResponse{
			Token:         token,
			WalletAddress: wallet,
			User:          user,
		})
	}
}

// WalletConnect — POST /api/v1/wallet/connect (JWT)
// 현재 세션의 지갑 정보 반환
func WalletConnect(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userId")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		walletAddr, _ := c.Get("walletAddress")

		var wallet models.Wallet
		err := db.QueryRow(`
			SELECT id, user_id, wallet_address, credential_id, verification_result, created_at, updated_at
			FROM wallets WHERE user_id = $1 ORDER BY id DESC LIMIT 1
		`, userID).Scan(&wallet.ID, &wallet.UserID, &wallet.WalletAddress,
			&wallet.CredentialID, &wallet.VerificationResult, &wallet.CreatedAt, &wallet.UpdatedAt)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusOK, gin.H{"connected": false, "walletAddress": walletAddr})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load wallet"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"connected": true, "wallet": wallet})
	}
}

// ── 내부 헬퍼 ─────────────────────────────────────────────────────────────

// recoverAddress — EIP-191 personal_sign 서명에서 주소 복구
func recoverAddress(message []byte, signature string) (string, error) {
	sig := common.FromHex(signature)
	if len(sig) != 65 {
		return "", errInvalidSignature
	}
	// v 값 정규화 (27/28 → 0/1)
	if sig[64] >= 27 {
		sig[64] -= 27
	}
	hash := personalSignHash(message)
	pub, err := crypto.SigToPub(hash, sig)
	if err != nil {
		return "", err
	}
	return crypto.PubkeyToAddress(*pub).Hex(), nil
}

// devSignatureOK — 제거됨 (CWE-287: dev-mock 서명 우회 경로 완전 삭제 — 2026-08-21 Strix 재발견 후).
// 지갑 인증은 항상 실제 EIP-191 개인 서명 검증만 수행한다.

// resolveUserWithWalletBinding — 지갑 연결 시 계정 결정 (2026-08-13)
// - 요청에 유효한 로그인 토큰(JWT)이 있으면: 그 계정에 지갑을 바인딩한다.
//   기존에 지갑 전용 계정으로 쌓인 결제/분석 내역은 로그인 계정으로 이전 →
//   "My Products 구매 내역"이 로그인 계정에서 보이도록 보장.
// - 로그인 토큰이 없으면: 지갑 전용 계정 생성 (기존 동작, 비로그인 지갑 결제)
func resolveUserWithWalletBinding(c *gin.Context, db *sql.DB, wallet string) (models.User, error) {
	// 1) 유효한 로그인 토큰 확인 (옵셔널 — /auth/verify는 public 라우트)
	var loggedInID int
	if authHeader := c.GetHeader("Authorization"); strings.HasPrefix(authHeader, "Bearer ") {
		claims := &Claims{}
		if token, err := jwt.ParseWithClaims(strings.TrimPrefix(authHeader, "Bearer "), claims, func(t *jwt.Token) (interface{}, error) {
			return jwtSecret(), nil
		}); err == nil && token.Valid {
			loggedInID = claims.UserID
		}
	}

	wUser, err := getOrCreateWalletUser(db, wallet)
	if err != nil {
		return wUser, err
	}

	// 2) 비로그인 또는 이미 같은 계정 → 지갑 전용 계정 그대로
	if loggedInID <= 0 || loggedInID == wUser.ID {
		return wUser, nil
	}

	// 3) 로그인 계정으로 바인딩 (지갑 전용 계정의 내역 이전 포함)
	var loggedUser models.User
	err = db.QueryRow(
		"SELECT id, email, name, role, avatar, bio, created_at, updated_at FROM users WHERE id = $1", loggedInID,
	).Scan(&loggedUser.ID, &loggedUser.Email, &loggedUser.Name, &loggedUser.Role,
		&loggedUser.Avatar, &loggedUser.Bio, &loggedUser.CreatedAt, &loggedUser.UpdatedAt)
	if err != nil {
		// 로그인 계정이 더 이상 없으면 지갑 전용 계정 사용
		return wUser, nil
	}

	// 지갑 전용 계정(wUser)이면 결제/분석 내역을 로그인 계정으로 이전
	// (안전: @wallet.local 도메인 계정만 대상 — 일반 계정 데이터는 건드리지 않음)
	var wEmail string
	_ = db.QueryRow("SELECT email FROM users WHERE id = $1", wUser.ID).Scan(&wEmail)
	if strings.HasSuffix(strings.ToLower(wEmail), "@wallet.local") {
		if tx, txErr := db.Begin(); txErr == nil {
			_, _ = tx.Exec("UPDATE payments SET user_id = $1 WHERE user_id = $2", loggedUser.ID, wUser.ID)
			_, _ = tx.Exec("UPDATE analysis_requests SET user_id = $1 WHERE user_id = $2", loggedUser.ID, wUser.ID)
			_, _ = tx.Exec("UPDATE wallets SET user_id = $1 WHERE wallet_address = $2", loggedUser.ID, wallet)
			_ = tx.Commit()
		}
	}

	return loggedUser, nil
}

// getOrCreateWalletUser — 지갑 전용 사용자 자동 프로비저닝
// CWE-639 방어: is_wallet_user 플래그로 지갑 전용 계정을 구분 —
// 일반 가입(wallet.local 예약 도메인은 Register에서 차단)으로 생성된 계정과 충돌 불가.
func getOrCreateWalletUser(db *sql.DB, wallet string) (models.User, error) {
	var user models.User
	email := wallet + "@wallet.local"

	err := db.QueryRow(`
		SELECT id, email, name, role, avatar, bio, created_at, updated_at
		FROM users WHERE email = $1 AND is_wallet_user = true
	`, email).Scan(&user.ID, &user.Email, &user.Name, &user.Role,
		&user.Avatar, &user.Bio, &user.CreatedAt, &user.UpdatedAt)
	if err == nil {
		return user, nil
	}
	if err != sql.ErrNoRows {
		return user, err
	}

	// 신규: 랜덤 해시 + wallet 로컬 이메일 (비밀번호 로그인 불가 계정, is_wallet_user=true)
	// ON CONFLICT: 컬럼 도입 전 생성된 레거시 지갑 계정(is_wallet_user=false)을 승격 —
	// 비밀번호를 랜덤으로 교체해 공격자 로그인 무효화, admin role은 보존.
	randPass, _ := randomHex(32)
	hashed, _ := hashPassword(randPass)
	err = db.QueryRow(`
		INSERT INTO users (email, password, name, role, is_wallet_user)
		VALUES ($1, $2, $3, 'buyer', true)
		ON CONFLICT (email) DO UPDATE
			SET password = EXCLUDED.password,
			    name = EXCLUDED.name,
			    is_wallet_user = true,
			    role = CASE WHEN users.role = 'admin' THEN 'admin' ELSE 'buyer' END,
			    updated_at = CURRENT_TIMESTAMP
		RETURNING id, email, name, role, avatar, bio, created_at, updated_at
	`, email, hashed, "Wallet User").Scan(&user.ID, &user.Email, &user.Name, &user.Role,
		&user.Avatar, &user.Bio, &user.CreatedAt, &user.UpdatedAt)
	return user, err
}

// generateWalletToken — walletAddress claim 포함 JWT
func generateWalletToken(user models.User, wallet string) (string, error) {
	claims := &Claims{
		UserID:        user.ID,
		Email:         user.Email,
		Role:          user.Role,
		WalletAddress: wallet,
		RegisteredClaims: jwtRegisteredClaims(),
	}
	return signClaims(claims)
}
