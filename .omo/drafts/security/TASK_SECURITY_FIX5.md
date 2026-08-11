# TASK — Strix 5차 스캔 발견 2건 수정 (cmall_dd)

당신은 **Atlas - Plan Executor**입니다. `/home/dduckbeagy/cmall_dd` 저장소에서 아래 2건 보안 취약점을 수정하라. **질문하지 말고 바로 진행**하라. 수정 후 **실행 검증 + 커밋 + push**까지 완료하라.

## 배경
Strix 5차 재스캔 (리포트: `/home/dduckbeagy/security/strix_runs/dispatch-dir-boxes-mas-trycloudf_990b/vulnerabilities.json`). 2건 모두 **기존 수정의 우회 변형** — 기존 11건 수정(74c8e33, 53de306, df5ba8a, 4a1d7d5)은 유지하고 아래 허점만 보강.

## 수정 항목

### 1. [MEDIUM, CWE-863] admin-only productType 게이트 — 대소문자/공백 우회
- 문제: 2차 수정의 allowlist(`program`/`code`/`instruction`) 비교가 **대소문자 구분·공백 미제거** → seller가 `"Program"`, `"PROGRAM"`, `" program "` 등으로 우회 가능
- 수정: `server/internal/handlers/products.go`의 admin-only 체크에서 **`strings.ToLower(strings.TrimSpace(req.ProductType))` 정규화 후** allowlist 비교. (DB 저장 값은 원본 유지 or 정규화 저장 — 제품 타입 enum과 충돌 없게 코드 확인 후 결정)
- 회귀 금지: admin의 정상 타입 생성 201, seller의 허용 타입(`diary` 등) 생성 201, seller의 정규 타입(`program`) 403 유지

### 2. [MEDIUM, CWE-639] 익명 카트 sessionId — IP 바인딩만으로 부족, 쿠키 바인딩 추가
- 문제: sessionId가 여전히 클라이언트 제어. IP 바인딩(4차)은 **같은 IP/네트워크의 공격자**(또는 스캐너처럼 같은 출발지)에게는 무력 — sessionId를 알면 타인 익명 카트 읽기/merge 탈취 가능
- 수정 (**프론트엔드 수정 없이 서버측 강화**): **서버 발급 HttpOnly 쿠키 바인딩**
  - 익명 카트 첫 접근 시 서버가 `cmall_guest=<crypto/rand 32바이트 hex>` **HttpOnly 쿠키를 Set-Cookie**로 발급하고, `cart_sessions` 테이블에 session_id + client_ip + **guest_cookie** 기록 (기존 테이블에 컬럼 추가 또는 해시 저장)
  - 이후 익명 경로(GET/PUT/DELETE/merge) 요청은 기존 IP 검증 **+** `cmall_guest` 쿠키가 해당 sessionId 기록과 일치해야 허용, 불일치/부재 → **403**
  - 브라우저(실제 프론트)는 same-origin nginx 경유라 쿠키 자동 유지 → 정상 흐름 무영향 (이 점을 코드 주석에 명시)
  - **검증 시 반드시 쿠키 세션 사용**: `requests.Session()`으로 첫 요청에서 Set-Cookie 수신 → 이후 요청에 자동 포함 (쿠키 없이 세션을 이어붙이는 테스트는 403이 정상)
  - 쿠키 바인딩 구현이 과도하거나 흐름을 깨는 것으로 판단되면: 대안으로 **익명 sessionId 조회 실패 시 IP당 레이트리밋(429)** + 잔여 위험 문서화 — 어느 쪽이든 403/429 동작과 정상 흐름 회귀 없음 확인 후 선택, 결정 근거를 응답에 명시
- 회귀 금지: **같은 브라우저/세션**에서 익명 카트 추가→조회→merge 정상(200/201), 인증 사용자 카트 흐름 정상

## 반드시 지킬 것
- 수정 범위 2건 한정, 프론트엔드(src/) 수정 금지, 시크릿 커밋 금지
- docker 인프라/터널/Jenkins 미변경, `-v` 절대 금지, 재빌드 `docker compose up -d --build backend`

## 검증 (실제 실행, 로컬 API `http://localhost:8081`)
1. **타입 우회**: seller로 `productType:"Program"`, `"PROGRAM"`, `" program "`, `"Code"` 생성 → 전부 **403** / 정규 `"diary"` → **201** / admin `"program"` → **201**
2. **쿠키 바인딩**: (a) `requests.Session()`으로 익명 카트 생성 → 쿠키 저장 → 같은 세션 조회 **200** (b) 새 세션(쿠키 없음)으로 같은 sessionId 조회 → **403** (c) 쿠키 있으나 다른 IP(X-Forwarded-For) → **403**
3. `docker compose run --rm test-go` **그린**
4. 회귀: register→login→상품생성 201, 일기/댓글 정상

## 산출물
- 커밋 1개: `fix(security): Strix 5차 2건 — productType 정규화·익명 카트 쿠키 바인딩`
- `git push origin master` (Jenkins 빌드 확인)
- 최종 응답: 수정 요약(파일/라인) + curl/세션 검증 요약 + Jenkins 빌드 결과 + (쿠키 vs 레이트리밋 결정 근거)

지금 바로 진행해. 질문하지 마.
