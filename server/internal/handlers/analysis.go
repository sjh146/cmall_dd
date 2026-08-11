package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"cmall_dd/internal/models"
	"github.com/gin-gonic/gin"
)

// ── 분석 (M3) ─────────────────────────────────────────────────────────────
// 결제된 사용자만 분석을 요청할 수 있다 (M1: 유료 결제 이력 1건 이상).
// 실제 분석 실행은 analyist_dd 내부 API(M4)에 위임. 미연동 시 graceful 실패.

// analyistURL — analyist_dd api-gateway 베이스 URL
func analyistURL() string {
	return os.Getenv("ANALYIST_API_URL") // e.g. http://analyist-api:8000
}

// callAnalyistInternal — analyist_dd 내부 API 호출 (X-Internal-Api-Key)
func callAnalyistInternal(method, path string, payload interface{}) (map[string]interface{}, error) {
	base := analyistURL()
	if base == "" {
		return nil, fmt.Errorf("ANALYIST_API_URL not set")
	}
	var body io.Reader
	if payload != nil {
		b, _ := json.Marshal(payload)
		body = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, base+path, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Api-Key", internalKey("ANALYIST_INTERNAL_KEY"))

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("analyist returned %d: %s", resp.StatusCode, string(respBody))
	}
	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// userHasPaid — 사용자에게 결제 완료 이력이 있는지
func userHasPaid(db *sql.DB, userID interface{}) bool {
	var id int
	err := db.QueryRow(
		"SELECT id FROM payments WHERE user_id = $1 AND status = 'paid' LIMIT 1", userID,
	).Scan(&id)
	return err == nil
}

// CreateAnalysis — POST /api/v1/analysis (JWT, 결제 필수)
func CreateAnalysis(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userId")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		var req models.CreateAnalysisRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// 결제 게이트 (M1: 유료 이력 1건 이상)
		if !userHasPaid(db, userID) {
			c.JSON(http.StatusPaymentRequired, gin.H{"error": "payment required — paid order needed"})
			return
		}

		// 요청 레코드 생성
		var reqRec models.AnalysisRequest
		err := db.QueryRow(`
			INSERT INTO analysis_requests (user_id, request_type, symbol, status)
			VALUES ($1, $2, $3, 'queued')
			RETURNING id, user_id, request_type, symbol, status, COALESCE(result_json, '') AS result_json, COALESCE(internal_request_id, '') AS internal_request_id, COALESCE(error, '') AS error, created_at, updated_at
		`, userID, req.RequestType, req.Symbol).Scan(
			&reqRec.ID, &reqRec.UserID, &reqRec.RequestType, &reqRec.Symbol, &reqRec.Status,
			&reqRec.ResultJSON, &reqRec.InternalRequestID, &reqRec.Error,
			&reqRec.CreatedAt, &reqRec.UpdatedAt,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create analysis request"})
			return
		}

		// analyist_dd 내부 API 호출 (M4 연동 시 활성화)
		// request_type → 내부 엔드포인트 매핑 (M6 상품: 스윙/백테스트/팩터 리포트)
		if analyistURL() != "" {
			var internalResult map[string]interface{}
			var callErr error

			switch req.RequestType {
			case "swing_screener":
				internalResult, callErr = callAnalyistInternal(http.MethodGet, "/internal/swing-screener", nil)
			case "backtest":
				internalResult, callErr = callAnalyistInternal(http.MethodGet, "/internal/backtest", nil)
			case "factor_report":
				internalResult, callErr = callAnalyistInternal(http.MethodGet, "/internal/factor-report", nil)
			default: // stock_report 등 — 온디맨드 분석 합성
				internalResult, callErr = callAnalyistInternal(http.MethodPost, "/internal/analysis", map[string]string{
					"symbol":       req.Symbol,
					"request_type": req.RequestType,
				})
			}

			if callErr == nil {
				internalID, _ := internalResult["request_id"].(string)
				resultJSON, _ := json.Marshal(internalResult)
				_, _ = db.Exec(`
					UPDATE analysis_requests SET status = 'done', result_json = $1, internal_request_id = $2, updated_at = NOW()
					WHERE id = $3
				`, string(resultJSON), internalID, reqRec.ID)
				reqRec.Status = "done"
				reqRec.ResultJSON = string(resultJSON)
				reqRec.InternalRequestID = internalID
			} else {
				_, _ = db.Exec(
					"UPDATE analysis_requests SET status = 'failed', error = $1, updated_at = NOW() WHERE id = $2",
					callErr.Error(), reqRec.ID,
				)
				reqRec.Status = "failed"
				reqRec.Error = callErr.Error()
			}
		}

		c.JSON(http.StatusCreated, reqRec)
	}
}

// GetAnalysis — GET /api/v1/analysis/:requestId (JWT, 소유자 확인)
func GetAnalysis(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userId")
		requestID := c.Param("requestId")

		var rec models.AnalysisRequest
		err := db.QueryRow(`
			SELECT id, user_id, request_type, symbol, status, COALESCE(result_json, '') AS result_json, COALESCE(internal_request_id, '') AS internal_request_id, COALESCE(error, '') AS error, created_at, updated_at
			FROM analysis_requests WHERE id = $1
		`, requestID).Scan(
			&rec.ID, &rec.UserID, &rec.RequestType, &rec.Symbol, &rec.Status,
			&rec.ResultJSON, &rec.InternalRequestID, &rec.Error,
			&rec.CreatedAt, &rec.UpdatedAt,
		)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "analysis request not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load analysis request"})
			return
		}
		if rec.UserID != userID {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		c.JSON(http.StatusOK, rec)
	}
}
