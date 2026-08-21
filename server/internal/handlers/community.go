package handlers

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ── 커뮤니티 (2026-08-21) ─────────────────────────────────────────────────
// 로그인 사용자가 글을 남기고, 댓글로 소통하고, 알고리즘 전략을 공유하는 게시판.
// 삭제: 작성자 본인 OR 관리자(role=admin, DB 재검증 — JWT 클레임 비신뢰, CWE-269/862).

type CommunityPost struct {
	ID           int       `json:"id"`
	UserID       int       `json:"userId"`
	UserName     string    `json:"userName"`
	Title        string    `json:"title"`
	Content      string    `json:"content"`
	Category     string    `json:"category"`
	CreatedAt    time.Time `json:"createdAt"`
	CommentCount int       `json:"commentCount"`
}

type CommunityComment struct {
	ID        int       `json:"id"`
	PostID    int       `json:"postId"`
	UserID    int       `json:"userId"`
	UserName  string    `json:"userName"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"createdAt"`
}

// isAdminUser — DB에서 role 조회 (JWT 클레임 스푸핑 방지)
func isAdminUser(db *sql.DB, userID int) bool {
	var role string
	if err := db.QueryRow("SELECT role FROM users WHERE id = $1", userID).Scan(&role); err != nil {
		return false
	}
	return role == "admin"
}

// GetCommunityPosts — GET /api/v1/community/posts (공개)
func GetCommunityPosts(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		category := strings.TrimSpace(c.Query("category"))
		query := `
			SELECT p.id, p.user_id, COALESCE(u.name, 'Anonymous'), p.title, p.content, p.category, p.created_at,
			       (SELECT COUNT(*) FROM community_comments cc WHERE cc.post_id = p.id) AS comment_count
			FROM community_posts p
			LEFT JOIN users u ON p.user_id = u.id
		`
		args := []interface{}{}
		if category != "" {
			query += " WHERE p.category = $1"
			args = append(args, category)
		}
		query += " ORDER BY p.created_at DESC LIMIT 200"

		rows, err := db.Query(query, args...)
		if err != nil {
			respondDBError(c, err)
			return
		}
		defer rows.Close()

		posts := []CommunityPost{}
		for rows.Next() {
			var p CommunityPost
			if err := rows.Scan(&p.ID, &p.UserID, &p.UserName, &p.Title, &p.Content, &p.Category, &p.CreatedAt, &p.CommentCount); err != nil {
				continue
			}
			posts = append(posts, p)
		}
		c.JSON(http.StatusOK, gin.H{"posts": posts})
	}
}

// GetCommunityPost — GET /api/v1/community/posts/:id (공개, 댓글 포함)
func GetCommunityPost(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var p CommunityPost
		err := db.QueryRow(`
			SELECT p.id, p.user_id, COALESCE(u.name, 'Anonymous'), p.title, p.content, p.category, p.created_at,
			       (SELECT COUNT(*) FROM community_comments cc WHERE cc.post_id = p.id)
			FROM community_posts p
			LEFT JOIN users u ON p.user_id = u.id
			WHERE p.id = $1
		`, id).Scan(&p.ID, &p.UserID, &p.UserName, &p.Title, &p.Content, &p.Category, &p.CreatedAt, &p.CommentCount)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
			return
		}
		if err != nil {
			respondDBError(c, err)
			return
		}

		commentRows, err := db.Query(`
			SELECT c.id, c.post_id, c.user_id, COALESCE(u.name, 'Anonymous'), c.content, c.created_at
			FROM community_comments c
			LEFT JOIN users u ON c.user_id = u.id
			WHERE c.post_id = $1
			ORDER BY c.created_at ASC
		`, id)
		if err != nil {
			respondDBError(c, err)
			return
		}
		defer commentRows.Close()

		comments := []CommunityComment{}
		for commentRows.Next() {
			var cm CommunityComment
			if err := commentRows.Scan(&cm.ID, &cm.PostID, &cm.UserID, &cm.UserName, &cm.Content, &cm.CreatedAt); err != nil {
				continue
			}
			comments = append(comments, cm)
		}
		c.JSON(http.StatusOK, gin.H{"post": p, "comments": comments})
	}
}

// CreateCommunityPost — POST /api/v1/community/posts (JWT)
func CreateCommunityPost(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userId")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		var req struct {
			Title    string `json:"title"`
			Content  string `json:"content"`
			Category string `json:"category"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		req.Title = strings.TrimSpace(req.Title)
		req.Content = strings.TrimSpace(req.Content)
		if req.Title == "" || req.Content == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "title and content required"})
			return
		}
		if req.Title == "" || len(req.Title) > 200 || len(req.Content) > 10000 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "title(1-200자) 또는 content(최대 10000자) 범위 오류"})
			return
		}
		if req.Category == "" {
			req.Category = "잡담"
		}
		allowedCategories := map[string]bool{"전략 공유": true, "질문": true, "잡담": true}
		if !allowedCategories[req.Category] {
			req.Category = "잡담"
		}

		var p CommunityPost
		err := db.QueryRow(`
			INSERT INTO community_posts (user_id, title, content, category)
			VALUES ($1, $2, $3, $4)
			RETURNING id, user_id, title, content, category, created_at
		`, userID, req.Title, req.Content, req.Category).Scan(
			&p.ID, &p.UserID, &p.Title, &p.Content, &p.Category, &p.CreatedAt,
		)
		if err != nil {
			respondDBError(c, err)
			return
		}
		c.JSON(http.StatusCreated, gin.H{"post": p})
	}
}

// DeleteCommunityPost — DELETE /api/v1/community/posts/:id (작성자 OR 관리자)
func DeleteCommunityPost(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userId")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		id := c.Param("id")

		var ownerID int
		err := db.QueryRow("SELECT user_id FROM community_posts WHERE id = $1", id).Scan(&ownerID)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
			return
		}
		if err != nil {
			respondDBError(c, err)
			return
		}

		// 작성자 본인 또는 관리자(DB role)만 삭제 가능
		if ownerID != userID.(int) && !isAdminUser(db, userID.(int)) {
			c.JSON(http.StatusForbidden, gin.H{"error": "작성자 또는 관리자만 삭제할 수 있습니다"})
			return
		}

		if _, err := db.Exec("DELETE FROM community_posts WHERE id = $1", id); err != nil {
			respondDBError(c, err)
			return
		}
		// 댓글도 함께 삭제 (게시물 삭제 시 고아 댓글 방지)
		_, _ = db.Exec("DELETE FROM community_comments WHERE post_id = $1", id)
		c.JSON(http.StatusOK, gin.H{"message": "Post deleted"})
	}
}

// CreateCommunityComment — POST /api/v1/community/posts/:id/comments (JWT)
func CreateCommunityComment(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userId")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		postID := c.Param("id")
		var req struct {
			Content string `json:"content"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		req.Content = strings.TrimSpace(req.Content)
		if req.Content == "" || len(req.Content) > 2000 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "댓글은 1~2000자"})
			return
		}

		var existsPost int
		if err := db.QueryRow("SELECT 1 FROM community_posts WHERE id = $1", postID).Scan(&existsPost); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
			return
		}

		var cm CommunityComment
		err := db.QueryRow(`
			INSERT INTO community_comments (post_id, user_id, content)
			VALUES ($1, $2, $3)
			RETURNING id, post_id, user_id, content, created_at
		`, postID, userID, req.Content).Scan(&cm.ID, &cm.PostID, &cm.UserID, &cm.Content, &cm.CreatedAt)
		if err != nil {
			respondDBError(c, err)
			return
		}
		c.JSON(http.StatusCreated, gin.H{"comment": cm})
	}
}

// DeleteCommunityComment — DELETE /api/v1/community/comments/:id (작성자 OR 관리자)
func DeleteCommunityComment(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userId")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		id := c.Param("id")

		var ownerID int
		err := db.QueryRow("SELECT user_id FROM community_comments WHERE id = $1", id).Scan(&ownerID)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Comment not found"})
			return
		}
		if err != nil {
			respondDBError(c, err)
			return
		}

		if ownerID != userID.(int) && !isAdminUser(db, userID.(int)) {
			c.JSON(http.StatusForbidden, gin.H{"error": "작성자 또는 관리자만 삭제할 수 있습니다"})
			return
		}

		if _, err := db.Exec("DELETE FROM community_comments WHERE id = $1", id); err != nil {
			respondDBError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Comment deleted"})
	}
}
