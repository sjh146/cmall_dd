package handlers

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"log"
	"net/http"
	"strconv"
	"strings"

	"cmall_dd/internal/models"
	"github.com/gin-gonic/gin"
)

// validSessionID reports whether sessionID is a well-formed anonymous cart
// session identifier: non-empty, at most 64 characters, and containing only
// alphanumeric characters plus underscore and hyphen. This bounds the value
// before it is used in SQL lookups and prevents oversized/malformed input.
func validSessionID(sessionID string) bool {
	if sessionID == "" || len(sessionID) > 64 {
		return false
	}
	for _, r := range sessionID {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_' || r == '-' {
			continue
		}
		return false
	}
	return true
}

func GetCart(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		sessionID := c.Query("sessionId")
		userID, hasUserID := c.Get("userId")

		var query string
		var args []interface{}

		if hasUserID {
			// Use user_id if authenticated
			query = `
				SELECT c.id, c.product_id, c.quantity, COALESCE(c.session_id, ''), c.user_id, c.created_at, c.updated_at,
				       p.id, p.seller_id, p.name, p.price, p.original_price, p.image, p.category, p.product_type,
				       p.version, p.download_url, p.file_size, p.license_key, p.description, p.features,
				       p.system_requirements, p.created_at, p.updated_at
				FROM cart c
				JOIN products p ON c.product_id = p.id
				WHERE c.user_id = $1
				ORDER BY c.created_at DESC
			`
			args = []interface{}{userID}
		} else if sessionID != "" {
			if !verifyAnonymousSessionIP(c, db, sessionID) {
				return
			}
			query = `
				SELECT c.id, c.product_id, c.quantity, COALESCE(c.session_id, ''), COALESCE(c.user_id, 0), c.created_at, c.updated_at,
				       p.id, p.seller_id, p.name, p.price, p.original_price, p.image, p.category, p.product_type,
				       p.version, p.download_url, p.file_size, p.license_key, p.description, p.features,
				       p.system_requirements, p.created_at, p.updated_at
				FROM cart c
				JOIN products p ON c.product_id = p.id
				WHERE c.session_id = $1 AND c.user_id IS NULL
				ORDER BY c.created_at DESC
			`
			args = []interface{}{sessionID}
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "sessionId is required or authentication needed"})
			return
		}

		rows, err := db.Query(query, args...)
		if err != nil {
			respondDBError(c, err)
			return
		}
		defer rows.Close()

		var cartItems []models.CartItem
		for rows.Next() {
			var item models.CartItem
			var product models.Product
			var sessionIDVal string
			var userIDVal sql.NullInt64

			err := rows.Scan(
				&item.ID, &item.ProductID, &item.Quantity, &sessionIDVal, &userIDVal,
				&item.CreatedAt, &item.UpdatedAt,
				&product.ID, &product.SellerID, &product.Name, &product.Price, &product.OriginalPrice,
				&product.Image, &product.Category, &product.ProductType, &product.Version,
				&product.DownloadURL, &product.FileSize, &product.LicenseKey, &product.Description,
				&product.Features, &product.SystemReq, &product.CreatedAt, &product.UpdatedAt,
			)
			if err != nil {
				respondDBError(c, err)
				return
			}

			item.SessionID = sessionIDVal
			if userIDVal.Valid {
				uid := int(userIDVal.Int64)
				item.UserID = &uid
			}
			item.Product = &product
			cartItems = append(cartItems, item)
		}

		c.JSON(http.StatusOK, cartItems)
	}
}

func AddToCart(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.AddToCartRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Reject non-positive quantities. req.Quantity is an int, so JSON
		// floats/non-integers already fail binding (400); only the < 1 guard is
		// needed here.
		if req.Quantity < 1 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "quantity must be at least 1"})
			return
		}

		userID, hasUserID := c.Get("userId")

		// Check if item already exists in cart
		var existingID int
		var query string
		var args []interface{}

		if hasUserID {
			query = "SELECT id FROM cart WHERE product_id = $1 AND user_id = $2"
			args = []interface{}{req.ProductID, userID}
		} else {
			if !verifyAnonymousSessionIP(c, db, req.SessionID) {
				return
			}
			query = "SELECT id FROM cart WHERE product_id = $1 AND session_id = $2 AND user_id IS NULL"
			args = []interface{}{req.ProductID, req.SessionID}
		}

		err := db.QueryRow(query, args...).Scan(&existingID)

		if err == nil {
			// Update existing item
			updateQuery := `
				UPDATE cart 
				SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP
				WHERE id = $2
				RETURNING id, product_id, quantity, session_id, user_id, created_at, updated_at
			`
			var item models.CartItem
			err = db.QueryRow(updateQuery, req.Quantity, existingID).Scan(
				&item.ID, &item.ProductID, &item.Quantity, &item.SessionID,
				&item.UserID, &item.CreatedAt, &item.UpdatedAt,
			)
			if err != nil {
				respondDBError(c, err)
				return
			}
			c.JSON(http.StatusOK, item)
			return
		}

		// Insert new item
		insertQuery := `
			INSERT INTO cart (product_id, quantity, session_id, user_id)
			VALUES ($1, $2, $3, $4)
			RETURNING id, product_id, quantity, session_id, user_id, created_at, updated_at
		`

		var item models.CartItem
		var userIDPtr *int
		if hasUserID {
			uid := userID.(int)
			userIDPtr = &uid
		}

		err = db.QueryRow(insertQuery, req.ProductID, req.Quantity, req.SessionID, userIDPtr).Scan(
			&item.ID, &item.ProductID, &item.Quantity, &item.SessionID,
			&item.UserID, &item.CreatedAt, &item.UpdatedAt,
		)

		if err != nil {
			// A foreign-key violation means the referenced product does not
			// exist. Return a generic 400 to the client (no driver detail) and
			// log the detail server-side.
			if strings.Contains(err.Error(), "violates foreign key constraint") {
				log.Printf("invalid product in cart add: %v", err)
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid product"})
				return
			}
			respondDBError(c, err)
			return
		}

		c.JSON(http.StatusCreated, item)
	}
}

func UpdateCartItem(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid cart item ID"})
			return
		}

		var req struct {
			Quantity int `json:"quantity" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Reject non-positive quantities instead of deleting the item. The
		// ownership verification that previously lived in the delete branch is
		// already duplicated in the update path below, so no ownership checks
		// are lost by removing it.
		if req.Quantity < 1 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "quantity must be at least 1"})
			return
		}

		// Verify ownership before updating
		userID, hasUserID := c.Get("userId")
		if hasUserID {
			var ownerID sql.NullInt64
			err := db.QueryRow("SELECT user_id FROM cart WHERE id = $1", id).Scan(&ownerID)
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{"error": "Cart item not found"})
				return
			}
			if err != nil {
				respondDBError(c, err)
				return
			}
			if !ownerID.Valid || int(ownerID.Int64) != userID.(int) {
				c.JSON(http.StatusForbidden, gin.H{"error": "You can only modify your own cart items"})
				return
			}
		} else {
			if !verifyAnonymousSessionIP(c, db, c.Query("sessionId")) {
				return
			}
			if !verifyAnonymousCartOwnership(c, db, id) {
				return
			}
		}

		query := `
			UPDATE cart 
			SET quantity = $1, updated_at = CURRENT_TIMESTAMP
			WHERE id = $2
			RETURNING id, product_id, quantity, session_id, user_id, created_at, updated_at
		`

		var item models.CartItem
		err = db.QueryRow(query, req.Quantity, id).Scan(
			&item.ID, &item.ProductID, &item.Quantity, &item.SessionID,
			&item.UserID, &item.CreatedAt, &item.UpdatedAt,
		)

		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Cart item not found"})
			return
		}
		if err != nil {
			respondDBError(c, err)
			return
		}

		c.JSON(http.StatusOK, item)
	}
}

func RemoveFromCart(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid cart item ID"})
			return
		}

		// Verify ownership when authenticated
		userID, hasUserID := c.Get("userId")
		if hasUserID {
			var ownerID sql.NullInt64
			err := db.QueryRow("SELECT user_id FROM cart WHERE id = $1", id).Scan(&ownerID)
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{"error": "Cart item not found"})
				return
			}
			if err != nil {
				respondDBError(c, err)
				return
			}
			if !ownerID.Valid || int(ownerID.Int64) != userID.(int) {
				c.JSON(http.StatusForbidden, gin.H{"error": "You can only remove your own cart items"})
				return
			}
		} else {
			if !verifyAnonymousSessionIP(c, db, c.Query("sessionId")) {
				return
			}
			if !verifyAnonymousCartOwnership(c, db, id) {
				return
			}
		}

		result, err := db.Exec("DELETE FROM cart WHERE id = $1", id)
		if err != nil {
			respondDBError(c, err)
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Cart item not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Cart item removed successfully"})
	}
}

// verifyAnonymousSessionIP ensures an unauthenticated request's sessionId is
// bound to the caller's IP. On first access (no record) it upserts the current
// IP and allows. On subsequent access the recorded IP must match c.ClientIP(),
// otherwise 403. NOTE: NAT/mobile IP changes will break anonymous carts — an
// accepted LOW-severity tradeoff for this mitigation.
func verifyAnonymousSessionIP(c *gin.Context, db *sql.DB, sessionID string) bool {
	if !validSessionID(sessionID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "sessionId is required and must be at most 64 characters of alphanumerics, '_', or '-'"})
		return false
	}
	var recordedIP string
	var recordedGuestCookie string
	err := db.QueryRow("SELECT client_ip, guest_cookie FROM cart_sessions WHERE session_id = $1", sessionID).Scan(&recordedIP, &recordedGuestCookie)
	if err == sql.ErrNoRows {
		// First access: issue a fresh HttpOnly guest cookie, record the
		// caller's IP and cookie, and allow.
		newValue, genErr := generateGuestCookie()
		if genErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": genErr.Error()})
			return false
		}
		setGuestCookie(c, newValue)
		_, _ = db.Exec(`
			INSERT INTO cart_sessions (session_id, client_ip, guest_cookie)
			VALUES ($1, $2, $3)
			ON CONFLICT (session_id) DO UPDATE SET client_ip = EXCLUDED.client_ip, guest_cookie = EXCLUDED.guest_cookie
		`, sessionID, c.ClientIP(), newValue)
		return true
	}
	if err != nil {
		respondDBError(c, err)
		return false
	}
	if recordedIP != c.ClientIP() {
		c.JSON(http.StatusForbidden, gin.H{"error": "Session cart does not belong to this client"})
		return false
	}
	// Bind the server-issued HttpOnly guest cookie to the session as well.
	// Real browsers (frontend) go through same-origin nginx, so the HttpOnly
	// cookie is automatically maintained on every request and normal flows are
	// unaffected. This binding only rejects clients that cannot present the
	// cookie the server originally issued for this session.
	ok, _ := verifyAnonymousSessionCookie(c, db, sessionID, recordedGuestCookie)
	return ok
}

// verifyAnonymousSessionCookie binds the server-issued HttpOnly cmall_guest
// cookie to an anonymous cart session. It returns (true, newValue) when the
// request is allowed, and (false, "") after writing a 403 when it is not.
//
// - If the recorded guest_cookie is empty (a legacy row created before cookie
//   binding existed), a new cookie is issued, the row is updated, and the
//   request is allowed — a one-time migration path so existing anonymous carts
//   do not break.
// - If the request's cmall_guest cookie matches the recorded value, allow.
// - Otherwise the cookie is missing or mismatched → 403.
func verifyAnonymousSessionCookie(c *gin.Context, db *sql.DB, sessionID string, recordedGuestCookie string) (bool, string) {
	reqCookie, err := c.Cookie("cmall_guest")
	if recordedGuestCookie == "" {
		// Legacy row: bind a fresh cookie and allow.
		newValue, genErr := generateGuestCookie()
		if genErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": genErr.Error()})
			return false, ""
		}
		setGuestCookie(c, newValue)
		_, _ = db.Exec("UPDATE cart_sessions SET guest_cookie = $1 WHERE session_id = $2", newValue, sessionID)
		return true, newValue
	}
	if err != nil || reqCookie != recordedGuestCookie {
		c.JSON(http.StatusForbidden, gin.H{"error": "Session cart does not belong to this client"})
		return false, ""
	}
	return true, ""
}

// generateGuestCookie returns a cryptographically random 64-hex-char value for
// the cmall_guest cookie. crypto/rand is used (never math/rand) for security.
func generateGuestCookie() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

// setGuestCookie writes the HttpOnly cmall_guest cookie on the response.
func setGuestCookie(c *gin.Context, value string) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie("cmall_guest", value, 0, "/", "", false, true)
}

// verifyAnonymousCartOwnership ensures an unauthenticated request may only
// modify a cart item that belongs to the provided session. Returns false if a
// response has already been written.
func verifyAnonymousCartOwnership(c *gin.Context, db *sql.DB, id int) bool {
	var ownerID sql.NullInt64
	var sessionID string
	err := db.QueryRow("SELECT user_id, session_id FROM cart WHERE id = $1", id).Scan(&ownerID, &sessionID)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Cart item not found"})
		return false
	}
	if err != nil {
		respondDBError(c, err)
		return false
	}
	if ownerID.Valid && ownerID.Int64 != 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "You can only modify your own cart items"})
		return false
	}
	reqSessionID := c.Query("sessionId")
	if !validSessionID(reqSessionID) || reqSessionID != sessionID {
		c.JSON(http.StatusForbidden, gin.H{"error": "You can only modify your own cart items"})
		return false
	}
	return true
}

// MergeCart merges session cart to user cart upon login
func MergeCart(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userId")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		sessionID := c.Query("sessionId")
		if !validSessionID(sessionID) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "sessionId is required and must be at most 64 characters of alphanumerics, '_', or '-'"})
			return
		}

		var recordedIP string
		var recordedGuestCookie string
		err := db.QueryRow("SELECT client_ip, guest_cookie FROM cart_sessions WHERE session_id = $1", sessionID).Scan(&recordedIP, &recordedGuestCookie)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusForbidden, gin.H{"error": "Session cart ownership could not be verified"})
			return
		}
		if err != nil {
			respondDBError(c, err)
			return
		}
		if recordedIP != c.ClientIP() {
			c.JSON(http.StatusForbidden, gin.H{"error": "Session cart does not belong to this client"})
			return
		}
		// Verify the server-issued HttpOnly guest cookie matches the recorded
		// value for this session. Real browsers (frontend) go through
		// same-origin nginx so the HttpOnly cookie is automatically maintained
		// and normal flows are unaffected.
		if ok, _ := verifyAnonymousSessionCookie(c, db, sessionID, recordedGuestCookie); !ok {
			return
		}

		// Move all session cart items to user cart atomically. The copy and
		// consume must run inside a single transaction that locks the guest
		// cart rows (SELECT ... FOR UPDATE) so concurrent merge requests for
		// the same guest session serialize: the first transaction copies and
		// deletes the guest items, and any waiting transaction then sees zero
		// guest rows and copies/deletes nothing (no duplication, no quantity
		// multiplication).
		tx, err := db.BeginTx(context.Background(), nil)
		if err != nil {
			respondDBError(c, err)
			return
		}

		// Lock the guest cart rows so concurrent merges block until this
		// transaction commits.
		_, err = tx.Exec("SELECT id FROM cart WHERE session_id = $1 AND user_id IS NULL FOR UPDATE", sessionID)
		if err != nil {
			tx.Rollback()
			respondDBError(c, err)
			return
		}

		query := `
			INSERT INTO cart (product_id, quantity, user_id)
			SELECT product_id, quantity, $1
			FROM cart
			WHERE session_id = $2 AND user_id IS NULL
			ON CONFLICT DO NOTHING
		`
		_, err = tx.Exec(query, userID, sessionID)
		if err != nil {
			tx.Rollback()
			respondDBError(c, err)
			return
		}

		// Delete old session cart items
		_, err = tx.Exec("DELETE FROM cart WHERE session_id = $1 AND user_id IS NULL", sessionID)
		if err != nil {
			tx.Rollback()
			respondDBError(c, err)
			return
		}

		if err := tx.Commit(); err != nil {
			tx.Rollback()
			respondDBError(c, err)
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Cart merged successfully"})
	}
}
