package handlers

import (
	"database/sql"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"cmall_dd/internal/models"
)

func GetCart(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		sessionID := c.Query("sessionId")
		if sessionID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "sessionId is required"})
			return
		}

		query := `
			SELECT c.id, c.product_id, c.quantity, c.session_id, c.created_at, c.updated_at,
			       p.id, p.name, p.price, p.original_price, p.image, p.category, p.condition,
			       p.description, p.size, p.brand, p.color, p.material, p.created_at, p.updated_at
			FROM cart c
			JOIN cmall_dd p ON c.product_id = p.id
			WHERE c.session_id = $1
			ORDER BY c.created_at DESC
		`

		rows, err := db.Query(query, sessionID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var cartItems []models.CartItem
		for rows.Next() {
			var item models.CartItem
			var product models.Product
			err := rows.Scan(
				&item.ID, &item.ProductID, &item.Quantity, &item.SessionID,
				&item.CreatedAt, &item.UpdatedAt,
				&product.ID, &product.Name, &product.Price, &product.OriginalPrice,
				&product.Image, &product.Category, &product.Condition, &product.Description,
				&product.Size, &product.Brand, &product.Color, &product.Material,
				&product.CreatedAt, &product.UpdatedAt,
			)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
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

		if req.Quantity == 0 {
			req.Quantity = 1
		}

		// Check if item already exists in cart
		var existingID int
		err := db.QueryRow(
			"SELECT id FROM cart WHERE product_id = $1 AND session_id = $2",
			req.ProductID, req.SessionID,
		).Scan(&existingID)

		if err == nil {
			// Update existing item
			query := `
				UPDATE cart 
				SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP
				WHERE id = $2
				RETURNING id, product_id, quantity, session_id, created_at, updated_at
			`
			var item models.CartItem
			err = db.QueryRow(query, req.Quantity, existingID).Scan(
				&item.ID, &item.ProductID, &item.Quantity, &item.SessionID,
				&item.CreatedAt, &item.UpdatedAt,
			)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, item)
			return
		}

		// Insert new item
		query := `
			INSERT INTO cart (product_id, quantity, session_id)
			VALUES ($1, $2, $3)
			RETURNING id, product_id, quantity, session_id, created_at, updated_at
		`

		var item models.CartItem
		err = db.QueryRow(query, req.ProductID, req.Quantity, req.SessionID).Scan(
			&item.ID, &item.ProductID, &item.Quantity, &item.SessionID,
			&item.CreatedAt, &item.UpdatedAt,
		)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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

		if req.Quantity <= 0 {
			// Delete item if quantity is 0 or less
			_, err := db.Exec("DELETE FROM cart WHERE id = $1", id)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"message": "Cart item deleted"})
			return
		}

		query := `
			UPDATE cart 
			SET quantity = $1, updated_at = CURRENT_TIMESTAMP
			WHERE id = $2
			RETURNING id, product_id, quantity, session_id, created_at, updated_at
		`

		var item models.CartItem
		err = db.QueryRow(query, req.Quantity, id).Scan(
			&item.ID, &item.ProductID, &item.Quantity, &item.SessionID,
			&item.CreatedAt, &item.UpdatedAt,
		)

		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Cart item not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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

		result, err := db.Exec("DELETE FROM cart WHERE id = $1", id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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

