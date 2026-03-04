package openclaw

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client represents an OpenClaw browser control client
type Client struct {
	baseURL    string
	httpClient *http.Client
}

// NewClient creates a new OpenClaw client
func NewClient(baseURL string) *Client {
	if baseURL == "" {
		baseURL = "http://localhost:8081" // Default OpenClaw gateway URL
	}
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Element represents a browser element
type Element struct {
	ID       string `json:"id"`
	Selector string `json:"selector,omitempty"`
	Text     string `json:"text,omitempty"`
}

// ClickRequest represents a click action request
type ClickRequest struct {
	ElementID string `json:"elementId"`
	Kind      string `json:"kind,omitempty"` // e.g., "click", "kind click"
}

// SnapshotRequest represents a snapshot request
type SnapshotRequest struct {
	URL string `json:"url,omitempty"`
}

// SnapshotResponse represents the response from a snapshot
type SnapshotResponse struct {
	Elements []Element `json:"elements"`
	Error    string    `json:"error,omitempty"`
}

// ClickResponse represents the response from a click action
type ClickResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

// Error represents an OpenClaw error
type Error struct {
	Message string
	Code    string
}

func (e *Error) Error() string {
	return e.Message
}

// IsServiceUnavailable checks if the error indicates the service is unavailable
func (e *Error) IsServiceUnavailable() bool {
	return e.Code == "SERVICE_UNAVAILABLE" || 
		   e.Message == "Can't reach the openclaw browser control service"
}

// TakeSnapshot takes a snapshot of the current page
func (c *Client) TakeSnapshot(url string) (*SnapshotResponse, error) {
	reqBody := SnapshotRequest{URL: url}
	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	resp, err := c.httpClient.Post(
		c.baseURL+"/snapshot",
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return nil, &Error{
			Message: fmt.Sprintf("Can't reach the openclaw browser control service: %v", err),
			Code:    "SERVICE_UNAVAILABLE",
		}
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		var errResp struct {
			Error string `json:"error"`
		}
		if err := json.Unmarshal(body, &errResp); err == nil {
			return nil, &Error{
				Message: errResp.Error,
				Code:    "API_ERROR",
			}
		}
		return nil, &Error{
			Message: fmt.Sprintf("HTTP %d: %s", resp.StatusCode, string(body)),
			Code:    "HTTP_ERROR",
		}
	}

	var snapshot SnapshotResponse
	if err := json.Unmarshal(body, &snapshot); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &snapshot, nil
}

// ClickElement clicks on an element by ID
func (c *Client) ClickElement(elementID string, kind string) error {
	reqBody := ClickRequest{
		ElementID: elementID,
		Kind:      kind,
	}
	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	resp, err := c.httpClient.Post(
		c.baseURL+"/act",
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return &Error{
			Message: fmt.Sprintf("Can't reach the openclaw browser control service: %v", err),
			Code:    "SERVICE_UNAVAILABLE",
		}
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		var errResp struct {
			Error string `json:"error"`
		}
		if err := json.Unmarshal(body, &errResp); err == nil {
			// Check if element not found
			if errResp.Error != "" {
				return &Error{
					Message: errResp.Error,
					Code:    "ELEMENT_NOT_FOUND",
				}
			}
		}
		return &Error{
			Message: fmt.Sprintf("HTTP %d: %s", resp.StatusCode, string(body)),
			Code:    "HTTP_ERROR",
		}
	}

	var clickResp ClickResponse
	if err := json.Unmarshal(body, &clickResp); err != nil {
		return fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if !clickResp.Success {
		return &Error{
			Message: clickResp.Error,
			Code:    "CLICK_FAILED",
		}
	}

	return nil
}

// ClickElementWithRetry attempts to click an element, taking a snapshot first if needed
func (c *Client) ClickElementWithRetry(elementID string, kind string, url string) error {
	err := c.ClickElement(elementID, kind)
	if err != nil {
		// If element not found, try taking a snapshot first
		if e, ok := err.(*Error); ok && e.Code == "ELEMENT_NOT_FOUND" {
			_, snapshotErr := c.TakeSnapshot(url)
			if snapshotErr != nil {
				return fmt.Errorf("click failed: %v, snapshot also failed: %v", err, snapshotErr)
			}
			return fmt.Errorf("element %s not found or not visible. Run a new snapshot to see current page elements: %v", elementID, err)
		}
		return err
	}
	return nil
}

// CheckServiceHealth checks if the OpenClaw service is available
func (c *Client) CheckServiceHealth() error {
	resp, err := c.httpClient.Get(c.baseURL + "/health")
	if err != nil {
		return &Error{
			Message: fmt.Sprintf("Can't reach the openclaw browser control service. Start (or restart) the OpenClaw gateway (OpenClaw.app menubar, or `openclaw gateway`) and try again: %v", err),
			Code:    "SERVICE_UNAVAILABLE",
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return &Error{
			Message: fmt.Sprintf("OpenClaw service returned status %d", resp.StatusCode),
			Code:    "SERVICE_ERROR",
		}
	}

	return nil
}
