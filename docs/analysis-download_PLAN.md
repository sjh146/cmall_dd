# 분석 결과 다운로드 기능 (2026-08-22)

## 개요
고객이 결제해 실행한 분석 결과(`analysis_requests.result_json`)를 고객 PC로 파일 다운로드.
My Products 페이지에서 CSV(후보 목록) / JSON(원문) 형식 지원.

## API
- `GET /api/v1/analysis/:requestId/download?format=csv|json` (JWT 필수)
- 소유권: `analysis_requests.user_id` == JWT userId 아니면 **403** (CWE-862 IDOR 방지)
- 미완료(done 아님) 또는 결과 없음 → 400
- `format=csv`: result_json의 `candidates` 배열 → 동적 컬럼 CSV
  (우선순위: stock_code, stock_name, sector, score, confidence, expected_return, reason + 나머지 사전순)
- `format=json`: result_json 원문 (Content-Disposition attachment)
- 파일명: `analysis_<id>_<request_type>.csv|json`

## 보안
- **CSV 인젝션 (CWE-1236)**: 셀 값이 `= + - @`로 시작하면 `'` 이스케이프 (`csvSafeCell`)
- 소유권 403 — 타인 결과 열람/다운로드 불가

## 구현
- `server/internal/handlers/analysis_download.go` — 핸들러 + `candidatesToCSV` 순수 함수 + `csvSafeCell`
- `server/main.go` — protected 라우트 등록
- `src/lib/api.ts` — `downloadAnalysisResult(requestId, format)` (blob 다운로드)
- `src/pages/MyProducts.tsx` — 결과 있는 항목에 CSV/JSON 다운로드 버튼

## 테스트
- `analysis_download_test.go`: `TestCSVSafeCell` (인젝션 6종) + `TestCandidatesToCSV` (헤더/이스케이프/에러 3종)
- 실행: `docker run --rm -v <repo>/server:/srv -w /srv golang:1.25 go test ./internal/handlers/`
- E2E (라이브): 본인 CSV 200 (21행) / 본인 JSON 200 (6.8KB) / 타인 403 / 미완료 400 / 잘못된 format 400

## 참고
- opencode 위임 시도 → 에이전트가 파일 읽기만 하고 조용히 종료(exit 0, 산출물 0건) →
  결정적 파일 작성은 Hermes 직접 구현 (opencode 스킬 함정 §문서화된 패턴)
