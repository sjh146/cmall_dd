package handlers

import (
	"database/sql"
	"fmt"
	"net/http"

	"cmall_dd/internal/models"

	"github.com/gin-gonic/gin"
)

// GetNotices returns all published notices (public)
func GetNotices(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := `
			SELECT id, title, content, is_published, created_at, updated_at
			FROM notices
			WHERE is_published = true
			ORDER BY created_at DESC
			LIMIT 50
		`

		rows, err := db.Query(query)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var notices []models.Notice
		for rows.Next() {
			var n models.Notice
			if err := rows.Scan(&n.ID, &n.Title, &n.Content, &n.IsPublished, &n.CreatedAt, &n.UpdatedAt); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			notices = append(notices, n)
		}

		if notices == nil {
			notices = []models.Notice{}
		}

		c.JSON(http.StatusOK, notices)
	}
}

// GetAllNotices returns all notices including unpublished (admin only)
func GetAllNotices(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check admin role
		userRole, exists := c.Get("userRole")
		if !exists || userRole != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
			return
		}

		query := `
			SELECT id, title, content, is_published, created_at, updated_at
			FROM notices
			ORDER BY created_at DESC
			LIMIT 50
		`

		rows, err := db.Query(query)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var notices []models.Notice
		for rows.Next() {
			var n models.Notice
			if err := rows.Scan(&n.ID, &n.Title, &n.Content, &n.IsPublished, &n.CreatedAt, &n.UpdatedAt); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			notices = append(notices, n)
		}

		if notices == nil {
			notices = []models.Notice{}
		}

		c.JSON(http.StatusOK, notices)
	}
}

// GetNotice returns a single notice by ID (public)
func GetNotice(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		var n models.Notice
		query := `
			SELECT id, title, content, is_published, created_at, updated_at
			FROM notices
			WHERE id = $1
		`

		err := db.QueryRow(query, id).Scan(&n.ID, &n.Title, &n.Content, &n.IsPublished, &n.CreatedAt, &n.UpdatedAt)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Notice not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, n)
	}
}

// CreateNotice creates a new notice (admin only)
func CreateNotice(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Debug: log user info
		userID, _ := c.Get("userId")
		userRole, exists := c.Get("userRole")
		userEmail, _ := c.Get("userEmail")

		roleStr := ""
		if roleStrVal, ok := userRole.(string); ok {
			roleStr = roleStrVal
		}

		// Check admin role
		if !exists || roleStr != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required. userId: " + fmt.Sprintf("%v", userID) + ", email: " + fmt.Sprintf("%v", userEmail) + ", role: '" + roleStr + "'"})
			return
		}

		var req models.CreateNoticeRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		isPublished := false
		if req.IsPublished != nil {
			isPublished = *req.IsPublished
		}

		query := `
			INSERT INTO notices (title, content, is_published)
			VALUES ($1, $2, $3)
			RETURNING id, title, content, is_published, created_at, updated_at
		`

		var n models.Notice
		err := db.QueryRow(query, req.Title, req.Content, isPublished).Scan(
			&n.ID, &n.Title, &n.Content, &n.IsPublished, &n.CreatedAt, &n.UpdatedAt,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, n)
	}
}

// UpdateNotice updates an existing notice (admin only)
func UpdateNotice(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check admin role
		userRole, exists := c.Get("userRole")
		if !exists || userRole != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
			return
		}

		id := c.Param("id")

		var req models.UpdateNoticeRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Get existing notice first
		var existing models.Notice
		err := db.QueryRow("SELECT id, title, content, is_published, created_at, updated_at FROM notices WHERE id = $1", id).Scan(
			&existing.ID, &existing.Title, &existing.Content, &existing.IsPublished, &existing.CreatedAt, &existing.UpdatedAt,
		)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Notice not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Update fields
		title := existing.Title
		if req.Title != nil {
			title = *req.Title
		}

		content := existing.Content
		if req.Content != nil {
			content = *req.Content
		}

		isPublished := existing.IsPublished
		if req.IsPublished != nil {
			isPublished = *req.IsPublished
		}

		query := `
			UPDATE notices 
			SET title = $1, content = $2, is_published = $3, updated_at = CURRENT_TIMESTAMP
			WHERE id = $4
			RETURNING id, title, content, is_published, created_at, updated_at
		`

		var n models.Notice
		err = db.QueryRow(query, title, content, isPublished, id).Scan(
			&n.ID, &n.Title, &n.Content, &n.IsPublished, &n.CreatedAt, &n.UpdatedAt,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, n)
	}
}

// DeleteNotice deletes a notice (admin only)
func DeleteNotice(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check admin role
		userRole, exists := c.Get("userRole")
		if !exists || userRole != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
			return
		}

		id := c.Param("id")

		result, err := db.Exec("DELETE FROM notices WHERE id = $1", id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Notice not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Notice deleted"})
	}
}
