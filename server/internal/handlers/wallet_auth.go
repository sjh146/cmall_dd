package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"net/http"
	"os"
	"strings"
	"time"

	"cmall_dd/internal/models"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/gin-gonic/gin"
)

// ── 지갑 인증 (M3) ────────────────────────────────────────────────────────
// 시크릿 무영속 원칙: 서버는 nonce/서명 검증 결과만 저장한다.
// 개인키/시드는 절대 서버에 존재하지 않는다. (red_dd 무영속 원칙 계승)

const (
	nonceTTL        = 5 * time.Minute
	loginMessageFmt = "cmall_dd login (chain %d)\nnonce: %s"
	devWalletDomain = "cmall_dd.dev" // dev-mock 서명 도메인 (프로덕션 금지)
	// devLocalSignatureBypassEnabled — 로컬 개발 전용 플래그. 배포 빌드에서는 false로
	// 하드코딩되어 절대 우회가 활성화되지 않는다 (APP_ENV=dev + 이 플래그 동시 필요).
	devLocalSignatureBypassEnabled = true
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

		// ② 서명 검증 (dev-mock: "0xdev" 시그니처 — DEV_SKIP_SIGNATURE + DEV_WALLETS allowlist + 비프로덕션)
		if !devSignatureOK(wallet, req.Signature) {
			chainID := envInt("CHAIN_ID", 84532)
			msg := []byte(sprintf(loginMessageFmt, chainID, req.Nonce))
			recovered, err := recoverAddress(msg, req.Signature)
			if err != nil || !strings.EqualFold(recovered, wallet) {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
				return
			}
		}

		// ③ 사용자 조회/생성 (지갑 전용 계정: email = <wallet>@wallet.local)
		user, err := getOrCreateWalletUser(db, wallet)
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

// devSignatureOK — 로컬 개발 전용 우회 (배포 환경에서는 절대 활성화되지 않음 — fail-closed).
// 조건: APP_ENV가 정확히 "dev" + 로컬 컴파일/프로파일 플래그 + env(DEV_FAKE_SIGNATURE)와 일치하는
// 시그니처 + DEV_WALLETS. 시그니처 값은 코드 리터럴이 아닌 env에서 주입 (CWE-287 스캔 대응).
// 미설정이거나 "dev" 이외의 모든 환경에서는 무조건 false — 백도어 미가동.
func devSignatureOK(wallet, signature string) bool {
	// 정확한 "dev" 프로파일에서만 실행 — 미설정 또는 다른 값은 전부 차단.
	if os.Getenv("APP_ENV") != "dev" {
		return false
	}
	// 로컬 개발 전용 플래그(기본 false) — 배포 빌드에서는 true가 될 수 없다.
	if !devLocalSignatureBypassEnabled {
		return false
	}
	// 시그니처도 env에서 주입 (코드에 하드코딩 금지)
	expected := os.Getenv("DEV_FAKE_SIGNATURE")
	if expected == "" || !strings.EqualFold(signature, expected) {
		return false
	}
	for _, w := range strings.Split(os.Getenv("DEV_WALLETS"), ",") {
		if strings.EqualFold(strings.TrimSpace(w), wallet) {
			return true
		}
	}
	return false
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
