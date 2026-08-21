package handlers

import (
	"strings"
	"testing"
)

func TestCSVSafeCell(t *testing.T) {
	cases := []struct {
		in   interface{}
		want string
	}{
		{"=cmd|' /C calc'!A0", "'=cmd|' /C calc'!A0"},
		{"+SUM(A1:A9)", "'+SUM(A1:A9)"},
		{"-2+3", "'-2+3"},
		{"@import", "'@import"},
		{"normal", "normal"},
		{123.45, "123.45"},
		{"036800", "036800"}, // 숫자로 시작하는 종목코드는 그대로
		{nil, ""},
		{"", ""},
	}
	for _, c := range cases {
		if got := csvSafeCell(c.in); got != c.want {
			t.Errorf("csvSafeCell(%v) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestCandidatesToCSV(t *testing.T) {
	// 정상 케이스 — 우선순위 컬럼 + 인젝션 이스케이프 + 추가 키
	jsonIn := `{
		"auc": 0.579,
		"candidates": [
			{"stock_code": "126640", "stock_name": "화신정공", "sector": "Unknown", "score": 85.0, "reason": "거래량 5.9배"},
			{"stock_code": "036800", "stock_name": "=EVIL", "sector": "게임", "score": 80.0, "extra_field": "x"}
		]
	}`
	csvOut, err := candidatesToCSV(jsonIn)
	if err != nil {
		t.Fatalf("candidatesToCSV err: %v", err)
	}
	lines := strings.Split(strings.TrimSpace(csvOut), "\n")
	if len(lines) != 3 {
		t.Fatalf("행 수 = %d, want 3 (헤더+2)", len(lines))
	}
	// 헤더: stock_code 우선 + extra_field 포함
	if !strings.HasPrefix(lines[0], "stock_code,stock_name,sector,score,confidence,expected_return,reason") ||
		!strings.Contains(lines[0], "extra_field") {
		t.Errorf("헤더 이상: %q", lines[0])
	}
	// 인젝션 셀 이스케이프
	if !strings.Contains(lines[2], "'=EVIL") {
		t.Errorf("CSV 인젝션 이스케이프 누락: %q", lines[2])
	}

	// 후보 없음 → 에러
	if _, err := candidatesToCSV(`{"auc": 0.5, "candidates": []}`); err == nil {
		t.Error("candidates 없음에도 에러 없음")
	}
	// 잘못된 JSON → 에러
	if _, err := candidatesToCSV(`{broken`); err == nil {
		t.Error("깨진 JSON에도 에러 없음")
	}
	// candidates 없음 → 에러
	if _, err := candidatesToCSV(`{"auc": 0.5}`); err == nil {
		t.Error("candidates 키 없음에도 에러 없음")
	}
}
