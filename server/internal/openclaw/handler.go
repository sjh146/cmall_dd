package openclaw

import (
	"database/sql"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"

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

// validateOpenClawURL — SSRF 방지: http/https 스킴 + 내부 IP/링크로컬 차단 (CWE-918)
func validateOpenClawURL(raw string) (string, error) {
	if raw == "" {
		return "", nil // URL 미지정은 허용 (현재 페이지 대상)
	}
	u, err := url.Parse(raw)
	if err != nil {
		return "", err
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return "", fmt.Errorf("only http/https URLs are allowed")
	}
	if u.Host == "" {
		return "", fmt.Errorf("URL host is required")
	}

	host := u.Hostname()
	// Reject non-canonical numeric-only hosts (integer/octal/0x IP forms)
	// that net.ParseIP does not recognize but resolvers still interpret.
	if isNumericIPEncoding(host) {
		return "", fmt.Errorf("non-canonical IP encodings are not allowed")
	}
	// Reject canonical literal internal IPs.
	if ip := net.ParseIP(host); ip != nil {
		if isInternalIP(ip) {
			return "", fmt.Errorf("internal/private IP addresses are not allowed")
		}
	} else if strings.EqualFold(host, "localhost") {
		return "", fmt.Errorf("localhost is not allowed")
	} else {
		// Resolve the hostname server-side and reject if ANY resolved address
		// is internal/loopback/link-local/unspecified. Blocks DNS-rebinding
		// and multi-answer hosts that sneak an internal IP into the set.
		ips, err := net.LookupIP(host)
		if err != nil {
			return "", fmt.Errorf("URL host cannot be resolved")
		}
		for _, ip := range ips {
			if isInternalIP(ip) {
				return "", fmt.Errorf("internal/private IP addresses are not allowed")
			}
		}
	}
	return u.String(), nil
}

// isInternalIP reports whether the address is private, loopback,
// link-local unicast, or unspecified.
func isInternalIP(ip net.IP) bool {
	return ip.IsPrivate() || ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsUnspecified()
}

// isNumericIPEncoding reports whether the host is a pure numeric-only string
// (optionally 0x-prefixed), i.e. a non-canonical IP encoding such as
// 2130706433 (integer) or 017700000001 (octal).
func isNumericIPEncoding(host string) bool {
	h := strings.ToLower(host)
	switch {
	case strings.HasPrefix(h, "0x"):
		// hex: 0x[0-9a-f]+
		if len(h) < 3 {
			return false
		}
		for _, r := range h[2:] {
			if !((r >= '0' && r <= '9') || (r >= 'a' && r <= 'f')) {
				return false
			}
		}
		return true
	default:
		// decimal or octal digits only
		for _, r := range h {
			if r < '0' || r > '9' {
				return false
			}
		}
		return h != ""
	}
}

// ClickElement handles POST /api/v1/openclaw/click
func (h *Handler) ClickElement(c *gin.Context) {
	var req ClickElementRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// SSRF 방지 (CWE-918)
	cleanURL, err := validateOpenClawURL(req.URL)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.URL = cleanURL

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
	err = h.client.ClickElementWithRetry(req.ElementID, req.Kind, req.URL)
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

	// SSRF 방지 (CWE-918)
	cleanURL, err := validateOpenClawURL(req.URL)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.URL = cleanURL

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
