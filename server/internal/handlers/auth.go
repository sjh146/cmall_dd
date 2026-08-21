package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"cmall_dd/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// JWT Claims
type Claims struct {
	UserID        int    `json:"userId"`
	Email         string `json:"email"`
	Role          string `json:"role"`
	WalletAddress string `json:"walletAddress,omitempty"`
	jwt.RegisteredClaims
}

// Generate JWT token
func generateToken(user models.User) (string, error) {
	claims := &Claims{
		UserID: user.ID,
		Email:  user.Email,
		Role:   user.Role,
		RegisteredClaims: jwtRegisteredClaims(),
	}
	return signClaims(claims)
}

// Register creates a new user account
func Register(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.RegisterRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Check if email already exists — CWE-203: 가입 응답으로 계정 존재 여부를
		// 노출하지 않기 위해 신규/기존 모두 동일한 201 + 메시지 본문을 반환한다.
		// (이 쇼핑몰의 가입 흐름은 응답 토큰을 사용하지 않고 UI 상태만 전환)
		var existingID int
		err := db.QueryRow("SELECT id FROM users WHERE email = $1", req.Email).Scan(&existingID)
		if err == nil {
			c.JSON(http.StatusCreated, gin.H{"message": "Registration successful"})
			return
		}

		// Hash password
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
			return
		}

		// Insert user - admin 승격은 기존 admin의 SetUserAsAdmin 경로로만 (CWE-269:
		// ADMIN_EMAIL 일치 가입 시 자동 admin 부여는 등록자가 관리자 계정을 선점할 수 있음)
		var user models.User
		role := "seller"

		// 지갑 전용 예약 도메인 가입 차단 (CWE-639: wallet.local 스쿼팅 방지)
		if strings.HasSuffix(strings.ToLower(req.Email), "@wallet.local") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "reserved email domain: @wallet.local"})
			return
		}

		query := `
			INSERT INTO users (email, password, name, role)
			VALUES ($1, $2, $3, $4)
			RETURNING id, email, name, role, avatar, bio, created_at, updated_at
		`
		err = db.QueryRow(query, req.Email, string(hashedPassword), req.Name, role).Scan(
			&user.ID, &user.Email, &user.Name, &user.Role,
			&user.Avatar, &user.Bio, &user.CreatedAt, &user.UpdatedAt,
		)
		if err != nil {
			respondDBError(c, err)
			return
		}

		// Generate token (세션 유지용 — 응답에는 포함하지 않음: 신규/기존 가입 응답을
		// 완전히 동일하게 유지해 계정 열거(CWE-203)를 차단한다. 프론트는 가입 응답
		// 토큰을 사용하지 않고 로그인/지갑 연결로 전환한다.)
		_, err = generateToken(user)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"message": "Registration successful"})
	}
}

// ── 로그인 시도 레이트리밋 (CWE-307: 무차별 대입/크레덴셜 스프레이 방지) ──────────
// 이메일 기준 인메모리 카운터: 5회 연속 실패 → 15분 잠금 (429).
var (
	loginAttemptsMu sync.Mutex
	loginFails      = map[string]int{}
	loginLockedTill = map[string]time.Time{}
)

const (
	maxLoginAttempts = 5
	loginLockoutDur  = 15 * time.Minute
)

func loginLocked(email string) bool {
	loginAttemptsMu.Lock()
	defer loginAttemptsMu.Unlock()
	key := strings.ToLower(strings.TrimSpace(email))
	if till, ok := loginLockedTill[key]; ok && time.Now().Before(till) {
		return true
	}
	return false
}

func loginFail(email string) {
	loginAttemptsMu.Lock()
	defer loginAttemptsMu.Unlock()
	key := strings.ToLower(strings.TrimSpace(email))
	loginFails[key]++
	if loginFails[key] >= maxLoginAttempts {
		loginLockedTill[key] = time.Now().Add(loginLockoutDur)
		delete(loginFails, key)
	}
}

func loginSuccess(email string) {
	loginAttemptsMu.Lock()
	defer loginAttemptsMu.Unlock()
	key := strings.ToLower(strings.TrimSpace(email))
	delete(loginFails, key)
	delete(loginLockedTill, key)
}

// Login authenticates a user
func Login(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.LoginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if loginLocked(req.Email) {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "Too many attempts. Try again in 15 minutes."})
			return
		}

		// Find user by email
		var user models.User
		query := `
			SELECT id, email, password, name, role, avatar, bio, created_at, updated_at
			FROM users WHERE email = $1
		`
		err := db.QueryRow(query, req.Email).Scan(
			&user.ID, &user.Email, &user.Password, &user.Name, &user.Role,
			&user.Avatar, &user.Bio, &user.CreatedAt, &user.UpdatedAt,
		)
		if err == sql.ErrNoRows {
			loginFail(req.Email)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
			return
		}
		if err != nil {
			respondDBError(c, err)
			return
		}

		// Check password
		if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
			loginFail(req.Email)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
			return
		}
		loginSuccess(req.Email)

		// Generate token
		token, err := generateToken(user)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
			return
		}

		c.JSON(http.StatusOK, models.AuthResponse{
			Token: token,
			User:  user,
		})
	}
}

// GetCurrentUser returns the authenticated user's information
func GetCurrentUser(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userId")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		var user models.User
		query := `
			SELECT id, email, name, role, avatar, bio, created_at, updated_at
			FROM users WHERE id = $1
		`
		err := db.QueryRow(query, userID).Scan(
			&user.ID, &user.Email, &user.Name, &user.Role,
			&user.Avatar, &user.Bio, &user.CreatedAt, &user.UpdatedAt,
		)
		if err != nil {
			respondDBError(c, err)
			return
		}

		c.JSON(http.StatusOK, user)
	}
}

// UpdateUser updates the authenticated user's profile
func UpdateUser(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userId")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		var req struct {
			Name   *string `json:"name,omitempty"`
			Bio    *string `json:"bio,omitempty"`
			Avatar *string `json:"avatar,omitempty"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		query := "UPDATE users SET updated_at = CURRENT_TIMESTAMP"
		args := []interface{}{}
		argIndex := 1

		if req.Name != nil {
			query += ", name = $" + strconv.Itoa(argIndex)
			args = append(args, *req.Name)
			argIndex++
		}
		if req.Bio != nil {
			query += ", bio = $" + strconv.Itoa(argIndex)
			args = append(args, *req.Bio)
			argIndex++
		}
		if req.Avatar != nil {
			query += ", avatar = $" + strconv.Itoa(argIndex)
			args = append(args, *req.Avatar)
			argIndex++
		}

		query += " WHERE id = $" + strconv.Itoa(argIndex)
		args = append(args, userID)

		var user models.User
		err := db.QueryRow(query, args...).Scan(
			&user.ID, &user.Email, &user.Name, &user.Role,
			&user.Avatar, &user.Bio, &user.CreatedAt, &user.UpdatedAt,
		)
		if err != nil {
			respondDBError(c, err)
			return
		}

		c.JSON(http.StatusOK, user)
	}
}

// SetUserAsAdmin sets the current user's role to admin (for testing)
func SetUserAsAdmin(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userId")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		// Get user email from context
		userEmail, _ := c.Get("userEmail")

		// Verify the caller's actual role from the server DB, not the JWT role claim
		var dbRole string
		err := db.QueryRow("SELECT role FROM users WHERE id = $1", userID).Scan(&dbRole)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify user role"})
			return
		}
		if dbRole != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Only admins can promote users to admin"})
			return
		}

		_, err = db.Exec("UPDATE users SET role = 'admin' WHERE id = $1", userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update role"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "You are now an admin", "email": userEmail})
	}
}
