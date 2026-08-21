package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
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
// 연결 실패는 errAnalyistUnreachable로 구분 — 일시 다운과 실제 오류를 나눠
// cmall 웹이 분석 서비스 장애에 견고하도록 한다 (2026-08-13).
var errAnalyistUnreachable = errors.New("analyist unreachable")

func callAnalyistInternal(method, path string, payload interface{}) (map[string]interface{}, error) {
	base := analyistURL()
	if base == "" {
		return nil, errAnalyistUnreachable
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

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", errAnalyistUnreachable, err)
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

// allowedAnalysisRequestTypes — 서버 허용 분석 요청 유형 allowlist.
// 클라이언트가 임의의 request_type을 내부 분석 API로 전달하는 것을 차단한다.
var allowedAnalysisRequestTypes = map[string]bool{
	"stock_report":   true,
	"swing_screener": true,
	"backtest":       true,
	"factor_report":  true,
	"close_screener": true,
}

// userHasAnalysisEntitlement — 결제한 분석 상품이 요청한 request_type과 일치해야 함 (CWE-862:
// "아무 paid 결제"로 모든 분석 기능이 열리는 것 방지 — 백테스트 결제로 팩터 리포트 요청 불가).
// 주의: 상품의 product_type은 'software' 등으로 다양하므로 request_type 바인딩만으로 판별한다
// (products.request_type 기본값 'stock_report' — 유료 분석 상품은 crypto_price_usdc > 0).
//
// M6 (2026-08-15): 올액세스 구독(번들, billing_interval_days NOT NULL)이 활성이면
// 모든 request_type 허용 — 월 $5 구독 = 전 서비스 무제한.
func userHasAnalysisEntitlement(db *sql.DB, userID interface{}, requestType string) bool {
	// 1) 활성 구독 번들 검사 (subscriptions 테이블 — 기간 만료 시 자동 차단)
	var subID int
	subErr := db.QueryRow(`
		SELECT s.id FROM subscriptions s
		JOIN products pr ON pr.id = s.product_id
		WHERE s.user_id = $1 AND s.status = 'active'
		  AND pr.billing_interval_days IS NOT NULL
		  AND s.current_period_end > NOW()
		LIMIT 1`, userID,
	).Scan(&subID)
	if subErr == nil {
		return true
	}
	// 2) 기존: 결제 이력 + request_type 일치
	var id int
	err := db.QueryRow(`
		SELECT p.id FROM payments p
		JOIN products pr ON pr.id = p.order_id
		WHERE p.user_id = $1 AND p.status = 'paid'
		  AND pr.request_type = $2 AND pr.crypto_price_usdc > 0
		LIMIT 1`, userID, requestType,
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

		// request_type 서버 허용목록 검증 (임의 값이 내부 API로 전달되는 것 방지)
		if !allowedAnalysisRequestTypes[req.RequestType] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported request type"})
			return
		}

		// 결제 게이트 (M1: 분석 상품 유료 이력 — 요청한 request_type 상품 결제 필요, CWE-862)
		if !userHasAnalysisEntitlement(db, userID, req.RequestType) {
			c.JSON(http.StatusPaymentRequired, gin.H{"error": "payment required — paid order for this analysis type needed"})
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

		// analyist_dd 내부 API 호출 (M6 — 비동기 잡)
		// stock_report는 즉시 done(result 포함), 나머지는 queued/running → GetAnalysis에서 폴링
		if analyistURL() != "" {
			internalResult, callErr := callAnalyistInternal(http.MethodPost, "/internal/analysis/"+req.RequestType, map[string]string{
				"symbol": req.Symbol,
			})

			if callErr != nil {
				if errors.Is(callErr, errAnalyistUnreachable) {
					// 게이트웨이 일시 다운 — 실패로 끝내지 않고 queued 유지,
					// GetAnalysis 폴링에서 자동 재제출 (웹은 영향 없음)
					note := "제출 대기 중 (분석 서비스 재시작 중): " + callErr.Error()
					_, _ = db.Exec(
						"UPDATE analysis_requests SET status = 'queued', error = $1, updated_at = NOW() WHERE id = $2",
						note, reqRec.ID,
					)
					reqRec.Status = "queued"
					reqRec.Error = note
				} else {
					// 실제 오류 (잘못된 심볼 등) — 명확히 실패 처리
					_, _ = db.Exec(
						"UPDATE analysis_requests SET status = 'failed', error = $1, updated_at = NOW() WHERE id = $2",
						callErr.Error(), reqRec.ID,
					)
					reqRec.Status = "failed"
					reqRec.Error = callErr.Error()
				}
			} else {
				internalID, _ := internalResult["request_id"].(string)
				status, _ := internalResult["status"].(string)
				if status == "" {
					status = "queued"
				}

				if status == "done" {
					// 즉시 완료 (stock_report 등) — result를 result_json으로 저장
					if raw, ok := internalResult["result"]; ok {
						if b, err := json.Marshal(raw); err == nil {
							_, _ = db.Exec(
								"UPDATE analysis_requests SET status = 'done', result_json = $1, internal_request_id = $2, updated_at = NOW() WHERE id = $3",
								string(b), internalID, reqRec.ID,
							)
							reqRec.Status = "done"
							reqRec.ResultJSON = string(b)
							reqRec.InternalRequestID = internalID
						}
					} else {
						_, _ = db.Exec(
							"UPDATE analysis_requests SET status = 'done', internal_request_id = $1, updated_at = NOW() WHERE id = $2",
							internalID, reqRec.ID,
						)
						reqRec.Status = "done"
						reqRec.InternalRequestID = internalID
					}
				} else {
					// queued/running — 내부 잡 ID 저장, GetAnalysis에서 상태 폴링
					_, _ = db.Exec(
						"UPDATE analysis_requests SET status = $1, internal_request_id = $2, updated_at = NOW() WHERE id = $3",
						status, internalID, reqRec.ID,
					)
					reqRec.Status = status
					reqRec.InternalRequestID = internalID
				}
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

		// 'submitting' 고착 복구: 프로세스가 제출 중 죽었으면 2분 뒤 queued로 되돌림
	if rec.Status == "submitting" && time.Since(rec.UpdatedAt) > 2*time.Minute {
		_, _ = db.Exec("UPDATE analysis_requests SET status = 'queued', updated_at = NOW() WHERE id = $1", rec.ID)
		rec.Status = "queued"
	}

	// 지연 제출 복구 (2026-08-13): 생성 시 게이트웨이가 다운이었다면(queued + 내부 id 없음)
	// 폴링 시점에 자동 재제출 — cmall 웹은 분석 서비스 장애와 무관하게 동작.
	if rec.Status == "queued" && rec.InternalRequestID == "" && analyistURL() != "" {
		res, claimErr := db.Exec(
			"UPDATE analysis_requests SET status = 'submitting', updated_at = NOW() WHERE id = $1 AND status = 'queued' AND internal_request_id = ''",
			rec.ID,
		)
		claimed := claimErr == nil
		if n, _ := res.RowsAffected(); n == 1 {
			claimed = true
		}
		if claimed {
			internalResult, callErr := callAnalyistInternal(http.MethodPost, "/internal/analysis/"+rec.RequestType, map[string]string{
				"symbol": rec.Symbol,
			})
			if callErr != nil {
				if errors.Is(callErr, errAnalyistUnreachable) {
					// 여전히 다운 — queued 유지, 다음 폴링에서 재시도
					_, _ = db.Exec("UPDATE analysis_requests SET status = 'queued', updated_at = NOW() WHERE id = $1", rec.ID)
				} else {
					_, _ = db.Exec(
						"UPDATE analysis_requests SET status = 'failed', error = $1, updated_at = NOW() WHERE id = $2",
						callErr.Error(), rec.ID,
					)
				}
			} else {
				internalID, _ := internalResult["request_id"].(string)
				status, _ := internalResult["status"].(string)
				if status == "" {
					status = "queued"
				}
				if status == "done" {
					if raw, ok := internalResult["result"]; ok {
						if b, err := json.Marshal(raw); err == nil {
							_, _ = db.Exec(
								"UPDATE analysis_requests SET status = 'done', result_json = $1, internal_request_id = $2, error = '', updated_at = NOW() WHERE id = $3",
								string(b), internalID, rec.ID,
							)
						}
					} else {
						_, _ = db.Exec(
							"UPDATE analysis_requests SET status = 'done', internal_request_id = $1, error = '', updated_at = NOW() WHERE id = $2",
							internalID, rec.ID,
						)
					}
				} else {
					_, _ = db.Exec(
						"UPDATE analysis_requests SET status = $1, internal_request_id = $2, error = '', updated_at = NOW() WHERE id = $3",
						status, internalID, rec.ID,
					)
				}
			}
			// 갱신된 레코드 재조회
			_ = db.QueryRow(`
				SELECT id, user_id, request_type, symbol, status, COALESCE(result_json, '') AS result_json, COALESCE(internal_request_id, '') AS internal_request_id, COALESCE(error, '') AS error, created_at, updated_at
				FROM analysis_requests WHERE id = $1
			`, rec.ID).Scan(
				&rec.ID, &rec.UserID, &rec.RequestType, &rec.Symbol, &rec.Status,
				&rec.ResultJSON, &rec.InternalRequestID, &rec.Error,
				&rec.CreatedAt, &rec.UpdatedAt,
			)
		}
	}

	// 비동기 잡 폴링 (M6): queued/running + internal_request_id 있으면 job-runner 상태 조회
		if (rec.Status == "queued" || rec.Status == "running") && rec.InternalRequestID != "" && analyistURL() != "" {
			jobResult, pollErr := callAnalyistInternal(http.MethodGet, "/internal/analysis/"+rec.InternalRequestID, nil)
			if pollErr == nil {
				status, _ := jobResult["status"].(string)
				switch status {
				case "done":
					if raw, ok := jobResult["result"]; ok {
						if b, err := json.Marshal(raw); err == nil {
							_, _ = db.Exec(
								"UPDATE analysis_requests SET status = 'done', result_json = $1, updated_at = NOW() WHERE id = $2",
								string(b), rec.ID,
							)
							rec.Status = "done"
							rec.ResultJSON = string(b)
						}
					}
				case "failed":
					errMsg, _ := jobResult["error"].(string)
					_, _ = db.Exec(
						"UPDATE analysis_requests SET status = 'failed', error = $1, updated_at = NOW() WHERE id = $2",
						errMsg, rec.ID,
					)
					rec.Status = "failed"
					rec.Error = errMsg
				case "running", "queued":
					_, _ = db.Exec(
						"UPDATE analysis_requests SET status = $1, updated_at = NOW() WHERE id = $2",
						status, rec.ID,
					)
					rec.Status = status
				}
			}
		}

		c.JSON(http.StatusOK, rec)
	}
}
