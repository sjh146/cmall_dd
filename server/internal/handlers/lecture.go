package handlers

import (
	"database/sql"
	"fmt"
	"net/http"

	"cmall_dd/internal/models"

	"github.com/gin-gonic/gin"
)

// GetLectures returns all published lectures (public)
func GetLectures(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := `
			SELECT id, title, description, content, thumbnail, video_url, duration, instructor, is_published, created_at, updated_at
			FROM lectures
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

		var lectures []models.Lecture
		for rows.Next() {
			var l models.Lecture
			if err := rows.Scan(&l.ID, &l.Title, &l.Description, &l.Content, &l.Thumbnail, &l.VideoURL, &l.Duration, &l.Instructor, &l.IsPublished, &l.CreatedAt, &l.UpdatedAt); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			lectures = append(lectures, l)
		}

		if lectures == nil {
			lectures = []models.Lecture{}
		}

		c.JSON(http.StatusOK, lectures)
	}
}

// GetAllLectures returns all lectures including unpublished (admin only)
func GetAllLectures(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check admin role
		userRole, exists := c.Get("userRole")
		if !exists || userRole != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
			return
		}

		query := `
			SELECT id, title, description, content, thumbnail, video_url, duration, instructor, is_published, created_at, updated_at
			FROM lectures
			ORDER BY created_at DESC
			LIMIT 50
		`

		rows, err := db.Query(query)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var lectures []models.Lecture
		for rows.Next() {
			var l models.Lecture
			if err := rows.Scan(&l.ID, &l.Title, &l.Description, &l.Content, &l.Thumbnail, &l.VideoURL, &l.Duration, &l.Instructor, &l.IsPublished, &l.CreatedAt, &l.UpdatedAt); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			lectures = append(lectures, l)
		}

		if lectures == nil {
			lectures = []models.Lecture{}
		}

		c.JSON(http.StatusOK, lectures)
	}
}

// GetLecture returns a single lecture by ID (public)
func GetLecture(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		var l models.Lecture
		query := `
			SELECT id, title, description, content, thumbnail, video_url, duration, instructor, is_published, created_at, updated_at
			FROM lectures
			WHERE id = $1
		`

		err := db.QueryRow(query, id).Scan(&l.ID, &l.Title, &l.Description, &l.Content, &l.Thumbnail, &l.VideoURL, &l.Duration, &l.Instructor, &l.IsPublished, &l.CreatedAt, &l.UpdatedAt)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Lecture not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, l)
	}
}

// CreateLecture creates a new lecture (admin only)
func CreateLecture(db *sql.DB) gin.HandlerFunc {
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

		var req models.CreateLectureRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		isPublished := false
		if req.IsPublished != nil {
			isPublished = *req.IsPublished
		}

		query := `
			INSERT INTO lectures (title, description, content, thumbnail, video_url, duration, instructor, is_published)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			RETURNING id, title, description, content, thumbnail, video_url, duration, instructor, is_published, created_at, updated_at
		`

		var l models.Lecture
		err := db.QueryRow(query, req.Title, req.Description, req.Content, req.Thumbnail, req.VideoURL, req.Duration, req.Instructor, isPublished).Scan(
			&l.ID, &l.Title, &l.Description, &l.Content, &l.Thumbnail, &l.VideoURL, &l.Duration, &l.Instructor, &l.IsPublished, &l.CreatedAt, &l.UpdatedAt,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, l)
	}
}

// UpdateLecture updates an existing lecture (admin only)
func UpdateLecture(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check admin role
		userRole, exists := c.Get("userRole")
		if !exists || userRole != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
			return
		}

		id := c.Param("id")

		var req models.UpdateLectureRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Get existing lecture first
		var existing models.Lecture
		err := db.QueryRow("SELECT id, title, description, content, thumbnail, video_url, duration, instructor, is_published, created_at, updated_at FROM lectures WHERE id = $1", id).Scan(
			&existing.ID, &existing.Title, &existing.Description, &existing.Content, &existing.Thumbnail, &existing.VideoURL, &existing.Duration, &existing.Instructor, &existing.IsPublished, &existing.CreatedAt, &existing.UpdatedAt,
		)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Lecture not found"})
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

		description := existing.Description
		if req.Description != nil {
			description = req.Description
		}

		content := existing.Content
		if req.Content != nil {
			content = req.Content
		}

		thumbnail := existing.Thumbnail
		if req.Thumbnail != nil {
			thumbnail = req.Thumbnail
		}

		videoURL := existing.VideoURL
		if req.VideoURL != nil {
			videoURL = req.VideoURL
		}

		duration := existing.Duration
		if req.Duration != nil {
			duration = req.Duration
		}

		instructor := existing.Instructor
		if req.Instructor != nil {
			instructor = req.Instructor
		}

		isPublished := existing.IsPublished
		if req.IsPublished != nil {
			isPublished = *req.IsPublished
		}

		query := `
			UPDATE lectures 
			SET title = $1, description = $2, content = $3, thumbnail = $4, video_url = $5, duration = $6, instructor = $7, is_published = $8, updated_at = CURRENT_TIMESTAMP
			WHERE id = $9
			RETURNING id, title, description, content, thumbnail, video_url, duration, instructor, is_published, created_at, updated_at
		`

		var l models.Lecture
		err = db.QueryRow(query, title, description, content, thumbnail, videoURL, duration, instructor, isPublished, id).Scan(
			&l.ID, &l.Title, &l.Description, &l.Content, &l.Thumbnail, &l.VideoURL, &l.Duration, &l.Instructor, &l.IsPublished, &l.CreatedAt, &l.UpdatedAt,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, l)
	}
}

// DeleteLecture deletes a lecture (admin only)
func DeleteLecture(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check admin role
		userRole, exists := c.Get("userRole")
		if !exists || userRole != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
			return
		}

		id := c.Param("id")

		result, err := db.Exec("DELETE FROM lectures WHERE id = $1", id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Lecture not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Lecture deleted"})
	}
}
