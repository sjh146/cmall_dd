package openclaw

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Handler handles OpenClaw browser automation requests
type Handler struct {
	client *Client
	db     *sql.DB
}

// NewHandler creates a new OpenClaw handler
func NewHandler(db *sql.DB, baseURL string) *Handler {
	return &Handler{
		client: NewClient(baseURL),
		db:     db,
	}
}

// ClickElementRequest represents the request body for clicking an element
type ClickElementRequest struct {
	ElementID string `json:"elementId" binding:"required"`
	Kind      string `json:"kind,omitempty"`
	URL       string `json:"url,omitempty"`
}

// ClickElement handles POST /api/v1/openclaw/click
func (h *Handler) ClickElement(c *gin.Context) {
	var req ClickElementRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check service health first
	if err := h.client.CheckServiceHealth(); err != nil {
		if e, ok := err.(*Error); ok && e.IsServiceUnavailable() {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"error": e.Message,
				"code":  "SERVICE_UNAVAILABLE",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Attempt to click with retry (takes snapshot if element not found)
	err := h.client.ClickElementWithRetry(req.ElementID, req.Kind, req.URL)
	if err != nil {
		if e, ok := err.(*Error); ok {
			statusCode := http.StatusInternalServerError
			if e.Code == "ELEMENT_NOT_FOUND" {
				statusCode = http.StatusNotFound
			} else if e.Code == "SERVICE_UNAVAILABLE" {
				statusCode = http.StatusServiceUnavailable
			}
			c.JSON(statusCode, gin.H{
				"error": e.Message,
				"code":  e.Code,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// TakeSnapshotRequest represents the request body for taking a snapshot
type TakeSnapshotRequest struct {
	URL string `json:"url,omitempty"`
}

// TakeSnapshot handles POST /api/v1/openclaw/snapshot
func (h *Handler) TakeSnapshot(c *gin.Context) {
	var req TakeSnapshotRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check service health first
	if err := h.client.CheckServiceHealth(); err != nil {
		if e, ok := err.(*Error); ok && e.IsServiceUnavailable() {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"error": e.Message,
				"code":  "SERVICE_UNAVAILABLE",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	snapshot, err := h.client.TakeSnapshot(req.URL)
	if err != nil {
		if e, ok := err.(*Error); ok {
			statusCode := http.StatusInternalServerError
			if e.Code == "SERVICE_UNAVAILABLE" {
				statusCode = http.StatusServiceUnavailable
			}
			c.JSON(statusCode, gin.H{
				"error": e.Message,
				"code":  e.Code,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, snapshot)
}

// HealthCheck handles GET /api/v1/openclaw/health
func (h *Handler) HealthCheck(c *gin.Context) {
	if err := h.client.CheckServiceHealth(); err != nil {
		if e, ok := err.(*Error); ok && e.IsServiceUnavailable() {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"status": "unavailable",
				"error":  e.Message,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"status": "error",
			"error":  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "available"})
}
