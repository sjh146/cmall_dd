package handlers

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// ── 공용 헬퍼 (결제 플랫폼) ────────────────────────────────────────────────

var errInvalidSignature = errors.New("invalid signature")

func sprintf(format string, args ...interface{}) string {
	return fmt.Sprintf(format, args...)
}

func envInt(name string, fallback int) int {
	v := os.Getenv(name)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

func envBool(name string, fallback bool) bool {
	v := os.Getenv(name)
	if v == "" {
		return fallback
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return fallback
	}
	return b
}

// jwtSecret — JWT 시크릿. 프로덕션에서는 env 강제(fail-closed, 심층분석 S3).
// 개발 환경에서는 기존 하위호환 폴백 + 경고 로그.
func jwtSecret() []byte {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		if os.Getenv("APP_ENV") == "production" {
			panic("JWT_SECRET is required in production (fail-closed)")
		}
		secret = "cmall_dd_secret_key_change_in_production"
	}
	return []byte(secret)
}

func jwtRegisteredClaims() jwt.RegisteredClaims {
	expirationTime := time.Now().Add(24 * 7 * time.Hour) // 7 days
	return jwt.RegisteredClaims{
		ExpiresAt: jwt.NewNumericDate(expirationTime),
		IssuedAt:  jwt.NewNumericDate(time.Now()),
		Issuer:    "cmall_dd",
	}
}

func signClaims(claims *Claims) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret())
}

func hashPassword(password string) (string, error) {
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(hashed), err
}

// internalKey — 내부 API 키 (blockchain-gateway/analyist 호출용).
// 운영은 env 강제. 없으면 경고 후 빈 키 (호출 시 401 처리됨).
func internalKey(name string) string {
	key := os.Getenv(name)
	if key == "" {
		return ""
	}
	return key
}
