# TASK — Strix 재스캔 발견 2건 수정 (cmall_dd)

당신은 **Atlas - Plan Executor**입니다. `/home/dduckbeagy/cmall_dd` 저장소에서 아래 2건 보안 취약점을 수정하라. **질문하지 말고 바로 진행**하라. 수정 후 **실행 검증 + 커밋 + push**까지 완료하라.

## 배경
Strix 재스캔에서 2건 추가 발견 (리포트: `/home/dduckbeagy/security/strix_runs/dispatch-dir-boxes-mas-trycloudf_ec88/vulnerabilities.json`). 직전 수정(74c8e33)에서 4건은 해결됐고 이 2건은 새로 표면화됨.

## 수정 항목

### 1. [MEDIUM, CWE-863] admin-only 상품타입 게이트 우회
- 문제: `POST /api/v1/products` 서버가 `category == "program"` **리터럴 하나만** admin 전용으로 차단. UI는 `code`/`instruction` 타입도 admin-only로 표시·비활성화하지만 서버는 그 둘을 차단하지 않아 **seller가 code/instruction 상품 생성 가능**
- 수정: 서버측 **admin-only 타입 allowlist** 도입 — `program`, `code`, `instruction` (UI 라벨과 일치하는 실제 enum 값은 `server/internal/models/models.go`의 타입 정의를 직접 확인 후 확정) → non-admin이 이 타입들로 생성 시도 시 기존과 동일한 **403** `"Only admins can create ... products"` 패턴. admin은 계속 생성 가능(회귀 금지)

### 2. [LOW, CWE-639] `/api/v1/cart/merge` sessionId 소유권 미검증
- 문제: `POST /api/v1/cart/merge?sessionId=<id>`가 인증된 호출자와 무관한 sessionId의 익명 카트를 호출자 계정으로 **이전** — sessionId를 아는 사용자가 남의 익명 카트 탈취 가능
- 수정: merge를 **호출자 자신의 세션에만** 바인딩. 익명 카트 생성 시점(`POST /api/v1/cart`에 sessionId가 쓰이는 흐름)에 **서버가 해당 sessionId를 클라이언트 식별자(IP 또는 서버 발급 세션 토큰)와 함께 기록**하고, merge 시 호출자 IP/토큰과 sessionId의 기록이 일치할 때만 허용 — 불일치 시 **403**. 최소 침습으로 구현하되, **기존 정상 익명카트→로그인 merge 흐름은 유지**(같은 사용자가 자기 sessionId로 merge하는 정상 케이스 회귀 금지). 구현이 과도해지면(세션 레지스트리 신설 등) 대안: merge에 사용자 인증 직전의 동일 IP 검증 + 짧은 유효기간으로 제한.

## 반드시 지킬 것
- 수정 범위는 위 2건 한정, 프론트엔드(src/) 수정 금지
- 기존 정상 동작 회귀 금지: admin의 code/instruction 생성, 사용자 본인 카트 merge, 익명 카트 정상 흐름
- 시크릿 커밋 금지, docker 인프라/터널/Jenkins 건드리지 말 것

## 검증 (실제 실행)
로컬 API `http://localhost:8081` (또는 nginx `http://localhost`). 재빌드: `docker compose up -d --build backend` (`-v` 절대 금지).
1. **CWE-863**: seller 토큰으로 `POST /api/v1/products` `category:"code"` 및 `"instruction"` → **403** 둘 다. admin 토큰으로는 **201** (회귀). `"program"`도 여전히 403
2. **CWE-639**: 익명 카트 생성(sessionId) → **다른 IP에서 온 것처럼** merge 시도(다른 세션/프록시 없이 테스트 가능한 범위에서) → 403 또는 거부. **본인 정상 merge는 200** (회귀)
3. `docker compose run --rm test-go` **그린**
4. 회귀: register→login→product(정상가) 201

## 산출물
- 커밋 1개: `fix(security): Strix 재스캔 2건 — admin-only 타입 allowlist·카트 merge 세션 소유권`
- `git push origin master` (Jenkins 빌드 확인)
- 최종 응답: 수정 요약(파일/라인) + curl 검증 요약 + Jenkins 빌드 결과

지금 바로 진행해. 질문하지 마.
