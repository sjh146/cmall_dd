# TASK — Strix 8차 스캔 발견 3건 수정 (cmall_dd)

당신은 **Atlas - Plan Executor**입니다. `/home/dduckbeagy/cmall_dd` 저장소에서 아래 3건 보안 취약점을 수정하라. **질문하지 말고 바로 진행**하라. 수정 후 **실행 검증 + 커밋 + push**까지 완료하라.

## 배경
Strix 8차 재스캔 (리포트: `/home/dduckbeagy/security/strix_runs/dispatch-dir-boxes-mas-trycloudf_f7dc/vulnerabilities.json`) — 3건 모두 실취약점. 기존 15건 수정(74c8e33~f19f7b0)은 유지.

## 수정 항목

### 1. [MEDIUM, CWE-639] 공개 상품 목록/상세에서 `downloadUrl`·`licenseKey` 노출
- 문제: **인증 없는** `GET /api/v1/products`(목록)·`GET /api/v1/products/:id`(상세)가 모든 판매자 상품의 `downloadUrl`(디지털 상품 배포 URL)·`licenseKey`(라이선스 키)를 그대로 반환 — 구매자도 아닌 아무나 열람 가능
- 수정: 공개(비인증) 응답에서 `downloadUrl`·`licenseKey`(가능하면 `sellerId`도) **제거/빈 값으로**. 판매자 본인·관리자(인증+소유권)만 포함. 응답 직렬화(DTO/JSON 마스킹)에서 처리 — 핸들러에서 필드 스트립하는 방식 권장. 프론트엔드 계약이 깨지지 않게 **상세 페이지의 정상 구매 흐름**(구매자에게 구매 후 다운로드 제공하는 로직이 있다면 그 경로)은 유지 — 코드 확인 후 구매자 본인에게는 노출되도록 보존
- 회귀 금지: 상품 목록/상세 조회 200, 상품 생성 201, 구매/다운로드 정상 흐름

### 2. [MEDIUM, CWE-79] `downloadUrl` Stored XSS — `javascript:` 스킴 허용
- 문제: `POST /api/v1/products`의 `downloadUrl`에 `javascript:alert(1)` 저장 가능 → SPA가 `<a href={downloadUrl}>`로 렌더 → 클릭 시 XSS
- 수정: **서버측 URL 스킴 검증** — `downloadUrl` 필드가 http/https(`http:`,`https:`)만 허용, `javascript:`/`data:`/`vbscript:` 등 거부 → **400**. 생성(CreateProduct)·수정(UpdateProduct) 양쪽. (Go `net/url` 파싱 후 `u.Scheme` 검사)
- 회귀 금지: 정상 https 다운로드 URL 저장 201, 상품 정상 흐름

### 3. [MEDIUM, CWE-89] `/api/v1/cart/merge` sessionId **SQL 인젝션** (문자열 결합)
- 문제: merge 쿼리에서 sessionId가 **파라미터화 없이 SQL에 문자열 결합** → boolean blind oracle (행 존재 여부 유출)
- 수정: 해당 쿼리를 **전부 prepared statement/파라미터 바인딩**으로 교체 (`$1` 등). MergeCart의 모든 SQL(session 조회·복사·삭제) 점검 + **같은 패턴이 다른 핸들러에 있는지 grep**(`fmt.Sprintf`+SQL, 문자열 결합 쿼리) 일괄 교체. sessionId 길이/형식 상한 검증(예: 64자)도 추가
- 회귀 금지: 정상 merge 200, 기존 403들(무쿠키/타IP), 게스트 카트 흐름

## 반드시 지킬 것
- 수정 범위 3건 한정, 프론트엔드(src/) 수정 금지, 시크릿 커밋 금지
- docker 인프라/터널/Jenkins 미변경, `-v` 절대 금지, 재빌드 `docker compose up -d --build backend`

## 검증 (실제 실행, 로컬 API `http://localhost:8081`)
1. **필드 스트립**: 비인증 `GET /api/v1/products`·`/:id` 응답에 `downloadUrl`/`licenseKey` **미포함**; 판매자 본인 인증 조회 시 포함(또는 구매 흐름 보존 확인)
2. **XSS**: `POST /api/v1/products` `downloadUrl:"javascript:alert(1)"` → **400**; `"https://example.com/file.zip"` → **201**
3. **SQLi**: `POST /api/v1/cart/merge?sessionId=1' OR '1'='1` → 에러 없이 **400/403**(크래시·SQL 에러 미노출), 정상 sessionId merge → 200
4. `docker compose run --rm test-go` **그린**
5. 회귀: 상품 목록/생성, 카트, 일기 정상

## 산출물
- 커밋 1개: `fix(security): Strix 8차 3건 — 상품 민감필드 스트립·downloadUrl 스킴 검증·merge SQL 파라미터화`
- `git push origin master` (Jenkins 빌드 확인)
- 최종 응답: 수정 요약(파일/라인) + curl 검증 요약 + Jenkins 빌드 결과

지금 바로 진행해. 질문하지 마.
