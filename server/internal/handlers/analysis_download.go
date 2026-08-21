package handlers

import (
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

// DownloadAnalysisResult — GET /api/v1/analysis/:requestId/download (JWT, 소유자만)
// 고객이 결제해 실행한 분석 결과(result_json)를 CSV 또는 JSON 파일로 내려받는다.
// 보안:
//  - 소유권: analysis_requests.user_id == JWT userId 아니면 403 (CWE-862 IDOR)
//  - CSV 인젝션: 셀이 = + - @ 로 시작하면 ' 이스케이프 (CWE-1236)
func DownloadAnalysisResult(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userId")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		requestID := c.Param("requestId")
		format := strings.ToLower(strings.TrimSpace(c.DefaultQuery("format", "csv")))
		if format != "csv" && format != "json" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "format must be csv or json"})
			return
		}

		var rec struct {
			UserID      int
			RequestType string
			Status      string
			ResultJSON  string
		}
		err := db.QueryRow(`
			SELECT user_id, request_type, status, COALESCE(result_json, '')
			FROM analysis_requests WHERE id = $1
		`, requestID).Scan(&rec.UserID, &rec.RequestType, &rec.Status, &rec.ResultJSON)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "analysis request not found"})
			return
		}
		if err != nil {
			respondDBError(c, err)
			return
		}
		if rec.UserID != userID.(int) {
			c.JSON(http.StatusForbidden, gin.H{"error": "본인 분석 결과만 다운로드할 수 있습니다"})
			return
		}
		if rec.Status != "done" || strings.TrimSpace(rec.ResultJSON) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "분석이 아직 완료되지 않았습니다"})
			return
		}

		base := fmt.Sprintf("analysis_%s_%s", requestID, rec.RequestType)
		if format == "json" {
			c.Header("Content-Type", "application/json; charset=utf-8")
			c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", base+".json"))
			c.String(http.StatusOK, rec.ResultJSON)
			return
		}

		// CSV: result_json의 candidates 배열 → 동적 컬럼 (우선순위 순)
		csvBody, err := candidatesToCSV(rec.ResultJSON)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.Header("Content-Type", "text/csv; charset=utf-8")
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", base+".csv"))
		c.String(http.StatusOK, csvBody)
	}
}

// candidatesToCSV — result_json의 candidates 배열을 CSV 문자열로 변환 (순수 함수 — 테스트 용이)
func candidatesToCSV(resultJSON string) (string, error) {
	var payload map[string]interface{}
	if err := json.Unmarshal([]byte(resultJSON), &payload); err != nil {
		return "", fmt.Errorf("결과 데이터를 읽을 수 없습니다")
	}
	rawCandidates, _ := payload["candidates"].([]interface{})
	if len(rawCandidates) == 0 {
		return "", fmt.Errorf("다운로드할 후보 데이터가 없습니다 (CSV는 후보 목록 전용 — JSON 형식으로 받아보세요)")
	}

	// 컬럼 우선순위 + 나머지 키는 사전순
	priority := []string{"stock_code", "stock_name", "sector", "score", "confidence", "expected_return", "reason"}
	colSet := map[string]bool{}
	var columns []string
	for _, p := range priority {
		colSet[p] = true
	}
	var rest []string
	for _, raw := range rawCandidates {
		m, ok := raw.(map[string]interface{})
		if !ok {
			continue
		}
		for k := range m {
			if !colSet[k] {
				colSet[k] = true
				rest = append(rest, k)
			}
		}
	}
	for _, p := range priority {
		if colSet[p] {
			columns = append(columns, p)
		}
	}
	columns = append(columns, rest...)

	var sb strings.Builder
	w := csv.NewWriter(&sb)
	_ = w.Write(columns)
	for _, raw := range rawCandidates {
		m, ok := raw.(map[string]interface{})
		if !ok {
			continue
		}
		row := make([]string, 0, len(columns))
		for _, col := range columns {
			row = append(row, csvSafeCell(m[col]))
		}
		_ = w.Write(row)
	}
	w.Flush()
	return sb.String(), nil
}

// csvSafeCell — CSV 인젝션 방어 (CWE-1236): = + - @ 로 시작하면 ' 접두
func csvSafeCell(v interface{}) string {
	var s string
	switch t := v.(type) {
	case string:
		s = t
	case float64:
		s = strconv.FormatFloat(t, 'f', -1, 64)
	case json.Number:
		s = t.String()
	case bool:
		s = strconv.FormatBool(t)
	case nil:
		s = ""
	default:
		s = fmt.Sprintf("%v", t)
	}
	if len(s) > 0 {
		first := s[0]
		if first == '=' || first == '+' || first == '-' || first == '@' {
			return "'" + s
		}
	}
	return s
}
