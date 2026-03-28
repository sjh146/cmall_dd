package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// Diary represents a trading diary entry
type Diary struct {
	ID        int       `json:"id"`
	UserID    int       `json:"userId"`
	UserName  string    `json:"userName,omitempty"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"createdAt"`
}

// DiaryComment represents a comment on a diary entry
type DiaryComment struct {
	ID        int       `json:"id"`
	DiaryID   int       `json:"diaryId"`
	UserID    int       `json:"userId"`
	UserName  string    `json:"userName,omitempty"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"createdAt"`
}

// CreateDiaryRequest represents the request body for creating a diary
type CreateDiaryRequest struct {
	Title   string `json:"title" binding:"required"`
	Content string `json:"content" binding:"required"`
}

// CreateCommentRequest represents the request body for creating a comment
type CreateCommentRequest struct {
	DiaryID int    `json:"diaryId" binding:"required"`
	Content string `json:"content" binding:"required"`
}

// GetDiaries returns all diaries with their comments (public)
func GetDiaries(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := `
			SELECT d.id, d.user_id, COALESCE(u.name, 'Anonymous'), d.title, d.content, d.created_at
			FROM diaries d
			LEFT JOIN users u ON d.user_id = u.id
			ORDER BY d.created_at DESC
			LIMIT 100
		`

		rows, err := db.Query(query)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var diaries []Diary
		diaryIDs := []int{}
		diaryMap := make(map[int]Diary)

		for rows.Next() {
			var d Diary
			if err := rows.Scan(&d.ID, &d.UserID, &d.UserName, &d.Title, &d.Content, &d.CreatedAt); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			diaryIDs = append(diaryIDs, d.ID)
			diaryMap[d.ID] = d
			diaries = append(diaries, d)
		}

		if diaries == nil {
			diaries = []Diary{}
		}

		// Get comments for all diaries
		commentsMap := make(map[int][]DiaryComment)
		if len(diaryIDs) > 0 {
			commentsQuery := `
				SELECT c.id, c.diary_id, c.user_id, COALESCE(u.name, 'Anonymous'), c.content, c.created_at
				FROM diary_comments c
				LEFT JOIN users u ON c.user_id = u.id
				WHERE c.diary_id = ANY($1)
				ORDER BY c.created_at ASC
			`

			commentRows, err := db.Query(commentsQuery, diaryIDs)
			if err == nil {
				defer commentRows.Close()
				for commentRows.Next() {
					var comment DiaryComment
					if err := commentRows.Scan(&comment.ID, &comment.DiaryID, &comment.UserID, &comment.UserName, &comment.Content, &comment.CreatedAt); err != nil {
						continue
					}
					commentsMap[comment.DiaryID] = append(commentsMap[comment.DiaryID], comment)
				}
			}
		}

		// Build response with comments
		var response []map[string]interface{}
		for _, d := range diaries {
			entry := map[string]interface{}{
				"id":        d.ID,
				"userId":    d.UserID,
				"userName":  d.UserName,
				"title":     d.Title,
				"content":   d.Content,
				"createdAt": d.CreatedAt,
				"comments":  commentsMap[d.ID],
			}
			response = append(response, entry)
		}

		if response == nil {
			response = []map[string]interface{}{}
		}

		c.JSON(http.StatusOK, response)
	}
}

// CreateDiary creates a new diary entry (requires auth)
func CreateDiary(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userId")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		var req CreateDiaryRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		query := `
			INSERT INTO diaries (user_id, title, content)
			VALUES ($1, $2, $3)
			RETURNING id, user_id, title, content, created_at
		`

		var d Diary
		err := db.QueryRow(query, userID, req.Title, req.Content).Scan(
			&d.ID, &d.UserID, &d.Title, &d.Content, &d.CreatedAt,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Get user name
		var userName string
		db.QueryRow("SELECT name FROM users WHERE id = $1", userID).Scan(&userName)
		d.UserName = userName

		c.JSON(http.StatusCreated, map[string]interface{}{
			"id":        d.ID,
			"userId":    d.UserID,
			"userName":  d.UserName,
			"title":     d.Title,
			"content":   d.Content,
			"createdAt": d.CreatedAt,
			"comments":  []DiaryComment{},
		})
	}
}

// DeleteDiary deletes a diary entry (owner only)
func DeleteDiary(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userId")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		var req struct {
			ID int `json:"id"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Check ownership
		var ownerID int
		err := db.QueryRow("SELECT user_id FROM diaries WHERE id = $1", req.ID).Scan(&ownerID)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Diary not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if ownerID != userID.(int) {
			c.JSON(http.StatusForbidden, gin.H{"error": "You can only delete your own diaries"})
			return
		}

		_, err = db.Exec("DELETE FROM diaries WHERE id = $1", req.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Diary deleted"})
	}
}

// UpdateDiary updates a diary entry (owner only)
func UpdateDiary(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userId")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid diary ID"})
			return
		}

		var req struct {
			Title   string `json:"title"`
			Content string `json:"content"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Check ownership
		var ownerID int
		err = db.QueryRow("SELECT user_id FROM diaries WHERE id = $1", id).Scan(&ownerID)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Diary not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if ownerID != userID.(int) {
			c.JSON(http.StatusForbidden, gin.H{"error": "You can only edit your own diaries"})
			return
		}

		// Update
		query := `
			UPDATE diaries 
			SET title = $1, content = $2, updated_at = CURRENT_TIMESTAMP
			WHERE id = $3
			RETURNING id, user_id, title, content, created_at, updated_at
		`

		var d Diary
		err = db.QueryRow(query, req.Title, req.Content, id).Scan(
			&d.ID, &d.UserID, &d.Title, &d.Content, &d.CreatedAt,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Get user name
		var userName string
		db.QueryRow("SELECT name FROM users WHERE id = $1", userID).Scan(&userName)
		d.UserName = userName

		c.JSON(http.StatusOK, d)
	}
}

// CreateComment creates a comment on a diary entry (requires auth)
func CreateComment(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userId")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		var req CreateCommentRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Check if diary exists
		var diaryExists int
		err := db.QueryRow("SELECT 1 FROM diaries WHERE id = $1", req.DiaryID).Scan(&diaryExists)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Diary not found"})
			return
		}

		query := `
			INSERT INTO diary_comments (diary_id, user_id, content)
			VALUES ($1, $2, $3)
			RETURNING id, diary_id, user_id, content, created_at
		`

		var comment DiaryComment
		err = db.QueryRow(query, req.DiaryID, userID, req.Content).Scan(
			&comment.ID, &comment.DiaryID, &comment.UserID, &comment.Content, &comment.CreatedAt,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Get user name
		var userName string
		db.QueryRow("SELECT name FROM users WHERE id = $1", userID).Scan(&userName)
		comment.UserName = userName

		c.JSON(http.StatusCreated, comment)
	}
}

// DeleteComment deletes a comment (owner only)
func DeleteComment(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userId")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		var req struct {
			ID int `json:"id"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Check ownership
		var ownerID int
		err := db.QueryRow("SELECT user_id FROM diary_comments WHERE id = $1", req.ID).Scan(&ownerID)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Comment not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if ownerID != userID.(int) {
			c.JSON(http.StatusForbidden, gin.H{"error": "You can only delete your own comments"})
			return
		}

		_, err = db.Exec("DELETE FROM diary_comments WHERE id = $1", req.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Comment deleted"})
	}
}
