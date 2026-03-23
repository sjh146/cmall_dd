package handlers

import (
	"database/sql"
	"net/http"
	"os"
	"strconv"
	"time"

	"cmall_dd/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// JWT Claims
type Claims struct {
	UserID int    `json:"userId"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

// Generate JWT token
func generateToken(user models.User) (string, error) {
	secretKey := os.Getenv("JWT_SECRET")
	if secretKey == "" {
		secretKey = "cmall_dd_secret_key_change_in_production"
	}

	expirationTime := time.Now().Add(24 * 7 * time.Hour) // 7 days

	claims := &Claims{
		UserID: user.ID,
		Email:  user.Email,
		Role:   user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "cmall_dd",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secretKey))
}

// Register creates a new user account
func Register(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.RegisterRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Check if email already exists
		var existingID int
		err := db.QueryRow("SELECT id FROM users WHERE email = $1", req.Email).Scan(&existingID)
		if err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Email already registered"})
			return
		}

		// Hash password
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
			return
		}

		// Insert user
		var user models.User
		query := `
			INSERT INTO users (email, password, name, role)
			VALUES ($1, $2, $3, 'seller')
			RETURNING id, email, name, role, avatar, bio, created_at, updated_at
		`
		err = db.QueryRow(query, req.Email, string(hashedPassword), req.Name).Scan(
			&user.ID, &user.Email, &user.Name, &user.Role,
			&user.Avatar, &user.Bio, &user.CreatedAt, &user.UpdatedAt,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Generate token
		token, err := generateToken(user)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
			return
		}

		c.JSON(http.StatusCreated, models.AuthResponse{
			Token: token,
			User:  user,
		})
	}
}

// Login authenticates a user
func Login(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.LoginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Check password
		if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
			return
		}

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
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, user)
	}
}
