package handlers

import (
	"database/sql"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"cmall_dd/internal/models"
	"github.com/gin-gonic/gin"
)

// validateDownloadURL rejects downloadUrl values whose scheme is not http or
// https. This prevents stored XSS via javascript:/data:/vbscript: URLs that the
// SPA later renders into an <a href>. Returns a non-empty error message when
// the URL is invalid.
func validateDownloadURL(raw string) string {
	u, err := url.Parse(raw)
	if err != nil {
		return "downloadUrl must be a valid URL"
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return "downloadUrl must use http or https scheme"
	}
	return ""
}

// sanitizePublicProduct removes downloadUrl and licenseKey from a product so
// they are omitted from the JSON response (both fields are omitempty). It is
// the shared public-field scoping helper used across ALL public serialization
// paths (product list/detail/search/cart) so sensitive fields are never
// exposed to callers who are not the product's owner (CWE-639).
func sanitizePublicProduct(p *models.Product) {
	p.DownloadURL = nil
	p.LicenseKey = nil
}

// GetProducts returns all products
func GetProducts(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := `
			SELECT id, seller_id, name, price, COALESCE(original_price, 0), COALESCE(image, ''),
			       COALESCE(category, ''), product_type,
			       COALESCE(version, ''), COALESCE(download_url, ''), COALESCE(file_size, ''),
			       COALESCE(license_key, ''), COALESCE(description, ''), COALESCE(features, ''),
			       COALESCE(system_requirements, ''), created_at, updated_at
			FROM products
			WHERE is_active = true
			ORDER BY created_at DESC
		`

		rows, err := db.Query(query)
		if err != nil {
			respondDBError(c, err)
			return
		}
		defer rows.Close()

		var products []models.Product
		for rows.Next() {
			var p models.Product
			err := rows.Scan(
				&p.ID, &p.SellerID, &p.Name, &p.Price, &p.OriginalPrice, &p.Image,
				&p.Category, &p.ProductType, &p.Version, &p.DownloadURL, &p.FileSize,
				&p.LicenseKey, &p.Description, &p.Features, &p.SystemReq,
				&p.CreatedAt, &p.UpdatedAt,
			)
			if err != nil {
				respondDBError(c, err)
				return
			}
			// Public listing: never expose downloadUrl/licenseKey to
			// unauthenticated callers (CWE-639).
			sanitizePublicProduct(&p)
			products = append(products, p)
		}

		c.JSON(http.StatusOK, products)
	}
}

// GetProduct returns a single product
func GetProduct(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID"})
			return
		}

		query := `
			SELECT id, seller_id, name, price, COALESCE(original_price, 0), COALESCE(image, ''),
			       COALESCE(category, ''), product_type,
			       COALESCE(version, ''), COALESCE(download_url, ''), COALESCE(file_size, ''),
			       COALESCE(license_key, ''), COALESCE(description, ''), COALESCE(features, ''),
			       COALESCE(system_requirements, ''), created_at, updated_at
			FROM products
			WHERE id = $1 AND is_active = true
		`

		var p models.Product
		err = db.QueryRow(query, id).Scan(
			&p.ID, &p.SellerID, &p.Name, &p.Price, &p.OriginalPrice, &p.Image,
			&p.Category, &p.ProductType, &p.Version, &p.DownloadURL, &p.FileSize,
			&p.LicenseKey, &p.Description, &p.Features, &p.SystemReq,
			&p.CreatedAt, &p.UpdatedAt,
		)

		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
			return
		}
		if err != nil {
			respondDBError(c, err)
			return
		}

		// Only the product's seller or an admin may see downloadUrl/licenseKey.
		// Unauthenticated and non-owner callers get the fields stripped (CWE-639).
		userID, hasUserID := c.Get("userId")
		userRole, _ := c.Get("userRole")
		isOwner := hasUserID && userID == p.SellerID
		isAdmin := userRole == "admin"
		if !isOwner && !isAdmin {
			sanitizePublicProduct(&p)
		}

		c.JSON(http.StatusOK, p)
	}
}

// CreateProduct creates a new product (seller only)
func CreateProduct(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		sellerID, exists := c.Get("userId")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		var req models.CreateProductRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Reject non-http(s) downloadUrl schemes to prevent stored XSS (CWE-79).
		if req.DownloadURL != nil {
			if msg := validateDownloadURL(*req.DownloadURL); msg != "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": msg})
				return
			}
		}

		// Validate product type and role restrictions. Normalize the type
		// (lowercase + trim) so case/whitespace variants like "Program",
		// "PROGRAM", or " program " cannot bypass the admin-only allowlist.
		normalizedType := strings.ToLower(strings.TrimSpace(req.ProductType))
		adminOnlyTypes := map[string]bool{"program": true, "code": true, "instruction": true}
		if adminOnlyTypes[normalizedType] {
			userRole, _ := c.Get("userRole")
			if userRole != "admin" {
				c.JSON(http.StatusForbidden, gin.H{"error": "Only admins can create 'program' products"})
				return
			}
		}

		query := `
			INSERT INTO products (seller_id, name, price, original_price, image, category,
			                      product_type, version, download_url, file_size, license_key,
			                      description, features, system_requirements)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
			RETURNING id, seller_id, name, price, original_price, image, category, product_type,
			          version, download_url, file_size, license_key, description, features,
			          system_requirements, created_at, updated_at
		`

		var p models.Product
		err := db.QueryRow(query,
			sellerID, req.Name, req.Price, req.OriginalPrice, req.Image, req.Category,
			normalizedType, req.Version, req.DownloadURL, req.FileSize, req.LicenseKey,
			req.Description, req.Features, req.SystemReq,
		).Scan(
			&p.ID, &p.SellerID, &p.Name, &p.Price, &p.OriginalPrice, &p.Image,
			&p.Category, &p.ProductType, &p.Version, &p.DownloadURL, &p.FileSize,
			&p.LicenseKey, &p.Description, &p.Features, &p.SystemReq,
			&p.CreatedAt, &p.UpdatedAt,
		)

		if err != nil {
			respondDBError(c, err)
			return
		}

		c.JSON(http.StatusCreated, p)
	}
}

// UpdateProduct updates a product (seller only, own products)
func UpdateProduct(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		sellerID, exists := c.Get("userId")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

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

		// Reject non-http(s) downloadUrl schemes to prevent stored XSS (CWE-79).
		if req.DownloadURL != nil {
			if msg := validateDownloadURL(*req.DownloadURL); msg != "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": msg})
				return
			}
		}

		// Build dynamic update query
		query := "UPDATE products SET updated_at = CURRENT_TIMESTAMP"
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
		if req.ProductType != nil {
			// admin-only 타입은 관리자만 설정 가능 (CWE-862 — CreateProduct와 동일 정책)
			normalizedType := strings.ToLower(strings.TrimSpace(*req.ProductType))
			adminOnlyTypes := map[string]bool{"program": true, "code": true, "instruction": true}
			if adminOnlyTypes[normalizedType] {
				userRole, _ := c.Get("userRole")
				if userRole != "admin" {
					c.JSON(http.StatusForbidden, gin.H{"error": "Only admins can set this product type"})
					return
				}
			} else if normalizedType != "diary" && normalizedType != "ebook" && normalizedType != "software" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Product type must be 'program', 'diary', 'ebook' or 'software'"})
				return
			}
			query += ", product_type = $" + strconv.Itoa(argIndex)
			args = append(args, *req.ProductType)
			argIndex++
		}
		if req.Version != nil {
			query += ", version = $" + strconv.Itoa(argIndex)
			args = append(args, *req.Version)
			argIndex++
		}
		if req.DownloadURL != nil {
			query += ", download_url = $" + strconv.Itoa(argIndex)
			args = append(args, *req.DownloadURL)
			argIndex++
		}
		if req.FileSize != nil {
			query += ", file_size = $" + strconv.Itoa(argIndex)
			args = append(args, *req.FileSize)
			argIndex++
		}
		if req.LicenseKey != nil {
			query += ", license_key = $" + strconv.Itoa(argIndex)
			args = append(args, *req.LicenseKey)
			argIndex++
		}
		if req.Description != nil {
			query += ", description = $" + strconv.Itoa(argIndex)
			args = append(args, *req.Description)
			argIndex++
		}
		if req.Features != nil {
			query += ", features = $" + strconv.Itoa(argIndex)
			args = append(args, *req.Features)
			argIndex++
		}
		if req.SystemReq != nil {
			query += ", system_requirements = $" + strconv.Itoa(argIndex)
			args = append(args, *req.SystemReq)
			argIndex++
		}

		query += " WHERE id = $" + strconv.Itoa(argIndex) + " AND seller_id = $" + strconv.Itoa(argIndex+1)
		query += " RETURNING id, seller_id, name, price, original_price, image, category, product_type, version, download_url, file_size, license_key, description, features, system_requirements, created_at, updated_at"
		args = append(args, id, sellerID)

		var p models.Product
		err = db.QueryRow(query, args...).Scan(
			&p.ID, &p.SellerID, &p.Name, &p.Price, &p.OriginalPrice, &p.Image,
			&p.Category, &p.ProductType, &p.Version, &p.DownloadURL, &p.FileSize,
			&p.LicenseKey, &p.Description, &p.Features, &p.SystemReq,
			&p.CreatedAt, &p.UpdatedAt,
		)

		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Product not found or not authorized"})
			return
		}
		if err != nil {
			respondDBError(c, err)
			return
		}

		c.JSON(http.StatusOK, p)
	}
}

// DeleteProduct deletes a product (seller only, own products)
func DeleteProduct(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		sellerID, exists := c.Get("userId")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID"})
			return
		}

		result, err := db.Exec("DELETE FROM products WHERE id = $1 AND seller_id = $2", id, sellerID)
		if err != nil {
			respondDBError(c, err)
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Product not found or not authorized"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Product deleted successfully"})
	}
}

// GetMyProducts returns products owned by the authenticated seller
func GetMyProducts(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		sellerID, exists := c.Get("userId")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		query := `
			SELECT id, seller_id, name, price, original_price, image, category, product_type,
			       version, download_url, file_size, license_key, description, features,
			       system_requirements, created_at, updated_at
			FROM products
			WHERE seller_id = $1
			ORDER BY created_at DESC
		`

		rows, err := db.Query(query, sellerID)
		if err != nil {
			respondDBError(c, err)
			return
		}
		defer rows.Close()

		var products []models.Product
		for rows.Next() {
			var p models.Product
			err := rows.Scan(
				&p.ID, &p.SellerID, &p.Name, &p.Price, &p.OriginalPrice, &p.Image,
				&p.Category, &p.ProductType, &p.Version, &p.DownloadURL, &p.FileSize,
				&p.LicenseKey, &p.Description, &p.Features, &p.SystemReq,
				&p.CreatedAt, &p.UpdatedAt,
			)
			if err != nil {
				respondDBError(c, err)
				return
			}
			products = append(products, p)
		}

		c.JSON(http.StatusOK, products)
	}
}

// SearchProducts searches products by name or description
func SearchProducts(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		search := c.Query("q")
		productType := c.Query("type")
		category := c.Query("category")

		query := `
			SELECT id, seller_id, name, price, original_price, image, category, product_type,
			       version, download_url, file_size, license_key, description, features,
			       system_requirements, created_at, updated_at
			FROM products
			WHERE 1=1
		`
		args := []interface{}{}
		argIndex := 1

		if search != "" {
			query += " AND (LOWER(name) LIKE $" + strconv.Itoa(argIndex) + " OR LOWER(description) LIKE $" + strconv.Itoa(argIndex) + ")"
			args = append(args, "%"+strings.ToLower(search)+"%")
			argIndex++
		}
		if productType != "" {
			query += " AND product_type = $" + strconv.Itoa(argIndex)
			args = append(args, productType)
			argIndex++
		}
		if category != "" {
			query += " AND category = $" + strconv.Itoa(argIndex)
			args = append(args, category)
			argIndex++
		}

		query += " ORDER BY created_at DESC"

		rows, err := db.Query(query, args...)
		if err != nil {
			respondDBError(c, err)
			return
		}
		defer rows.Close()

		var products []models.Product
		for rows.Next() {
			var p models.Product
			err := rows.Scan(
				&p.ID, &p.SellerID, &p.Name, &p.Price, &p.OriginalPrice, &p.Image,
				&p.Category, &p.ProductType, &p.Version, &p.DownloadURL, &p.FileSize,
				&p.LicenseKey, &p.Description, &p.Features, &p.SystemReq,
				&p.CreatedAt, &p.UpdatedAt,
			)
			if err != nil {
				respondDBError(c, err)
				return
			}
			// Public search endpoint: never expose downloadUrl/licenseKey to
			// any caller (CWE-639).
			sanitizePublicProduct(&p)
			products = append(products, p)
		}

		c.JSON(http.StatusOK, products)
	}
}
