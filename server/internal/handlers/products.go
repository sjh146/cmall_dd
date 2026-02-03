package handlers

import (
	"database/sql"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"cmall_dd/internal/models"
)

func GetProducts(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := `
			SELECT id, name, price, original_price, image, category, condition, 
			       description, size, brand, color, material, created_at, updated_at
			FROM cmall_dd
			ORDER BY created_at DESC
		`

		rows, err := db.Query(query)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var products []models.Product
		for rows.Next() {
			var p models.Product
			err := rows.Scan(
				&p.ID, &p.Name, &p.Price, &p.OriginalPrice, &p.Image, &p.Category,
				&p.Condition, &p.Description, &p.Size, &p.Brand, &p.Color,
				&p.Material, &p.CreatedAt, &p.UpdatedAt,
			)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			products = append(products, p)
		}

		c.JSON(http.StatusOK, products)
	}
}

func GetProduct(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID"})
			return
		}

		query := `
			SELECT id, name, price, original_price, image, category, condition, 
			       description, size, brand, color, material, created_at, updated_at
			FROM cmall_dd
			WHERE id = $1
		`

		var p models.Product
		err = db.QueryRow(query, id).Scan(
			&p.ID, &p.Name, &p.Price, &p.OriginalPrice, &p.Image, &p.Category,
			&p.Condition, &p.Description, &p.Size, &p.Brand, &p.Color,
			&p.Material, &p.CreatedAt, &p.UpdatedAt,
		)

		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, p)
	}
}

func CreateProduct(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.CreateProductRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		query := `
			INSERT INTO cmall_dd (name, price, original_price, image, category, condition, 
			                      description, size, brand, color, material)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			RETURNING id, name, price, original_price, image, category, condition, 
			          description, size, brand, color, material, created_at, updated_at
		`

		var p models.Product
		err := db.QueryRow(query,
			req.Name, req.Price, req.OriginalPrice, req.Image, req.Category,
			req.Condition, req.Description, req.Size, req.Brand, req.Color, req.Material,
		).Scan(
			&p.ID, &p.Name, &p.Price, &p.OriginalPrice, &p.Image, &p.Category,
			&p.Condition, &p.Description, &p.Size, &p.Brand, &p.Color,
			&p.Material, &p.CreatedAt, &p.UpdatedAt,
		)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, p)
	}
}

func UpdateProduct(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID"})
			return
		}

		var req models.UpdateProductRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Build dynamic update query
		query := "UPDATE cmall_dd SET updated_at = CURRENT_TIMESTAMP"
		args := []interface{}{}
		argIndex := 1

		if req.Name != nil {
			query += ", name = $" + strconv.Itoa(argIndex)
			args = append(args, *req.Name)
			argIndex++
		}
		if req.Price != nil {
			query += ", price = $" + strconv.Itoa(argIndex)
			args = append(args, *req.Price)
			argIndex++
		}
		if req.OriginalPrice != nil {
			query += ", original_price = $" + strconv.Itoa(argIndex)
			args = append(args, *req.OriginalPrice)
			argIndex++
		}
		if req.Image != nil {
			query += ", image = $" + strconv.Itoa(argIndex)
			args = append(args, *req.Image)
			argIndex++
		}
		if req.Category != nil {
			query += ", category = $" + strconv.Itoa(argIndex)
			args = append(args, *req.Category)
			argIndex++
		}
		if req.Condition != nil {
			query += ", condition = $" + strconv.Itoa(argIndex)
			args = append(args, *req.Condition)
			argIndex++
		}
		if req.Description != nil {
			query += ", description = $" + strconv.Itoa(argIndex)
			args = append(args, *req.Description)
			argIndex++
		}
		if req.Size != nil {
			query += ", size = $" + strconv.Itoa(argIndex)
			args = append(args, *req.Size)
			argIndex++
		}
		if req.Brand != nil {
			query += ", brand = $" + strconv.Itoa(argIndex)
			args = append(args, *req.Brand)
			argIndex++
		}
		if req.Color != nil {
			query += ", color = $" + strconv.Itoa(argIndex)
			args = append(args, *req.Color)
			argIndex++
		}
		if req.Material != nil {
			query += ", material = $" + strconv.Itoa(argIndex)
			args = append(args, *req.Material)
			argIndex++
		}

		query += " WHERE id = $" + strconv.Itoa(argIndex) + " RETURNING id, name, price, original_price, image, category, condition, description, size, brand, color, material, created_at, updated_at"
		args = append(args, id)

		var p models.Product
		err = db.QueryRow(query, args...).Scan(
			&p.ID, &p.Name, &p.Price, &p.OriginalPrice, &p.Image, &p.Category,
			&p.Condition, &p.Description, &p.Size, &p.Brand, &p.Color,
			&p.Material, &p.CreatedAt, &p.UpdatedAt,
		)

		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, p)
	}
}

func DeleteProduct(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID"})
			return
		}

		result, err := db.Exec("DELETE FROM cmall_dd WHERE id = $1", id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Product deleted successfully"})
	}
}

