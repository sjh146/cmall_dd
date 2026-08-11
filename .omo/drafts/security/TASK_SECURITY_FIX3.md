# TASK — Strix 3차 스캔 발견 2건 수정 (cmall_dd)

당신은 **Atlas - Plan Executor**입니다. `/home/dduckbeagy/cmall_dd` 저장소에서 아래 2건 보안 취약점을 수정하라. **질문하지 말고 바로 진행**하라. 수정 후 **실행 검증 + 커밋 + push**까지 완료하라.

## 배경
Strix 3차 재스캔에서 새 2건 발견 (리포트: `/home/dduckbeagy/security/strix_runs/dispatch-dir-boxes-mas-trycloudf_fe93/vulnerabilities.json`). 기존 6건은 수정 완료(74c8e33, 53de306) — 이 2건은 **새로 노출된 건**.

## 수정 항목

### 1. [HIGH, CWE-639] `GET /api/v1/diaries` — 인증 없이 전 사용자 비공개 일기 노출
- 문제: `GET /api/v1/diaries`가 **인증/소유권 검증 없이** 모든 사용자의 일기 전체 내용(비공개 포함)을 반환. 익명 요청도 200
- 수정: ① 엔드포인트에 **인증 필수** (기존 auth 미들웨어 적용) ② 반환 결과를 **호출자 본인(userId) 소유 일기로 필터링** — `/api/v1/my-products` 패턴처럼 서버측에서 JWT userId로 스코프 제한. (일기 공유 기능이 있다면 비소유자에게는 공개(public) 일기만 허용 — 코드 확인 후 판단, 없으면 본인 것만)
- 회귀 금지: 본인이 자기 일기 조회/작성/수정/삭제는 정상 동작

### 2. [MEDIUM, CWE-639] 비인증 카트 아이템 DELETE/PUT — 세션 검증 우회
- 문제: 1차 수정에서 PUT/DELETE `/api/v1/cart/{id}`에 소유권 검증을 넣었지만 **인증된 호출자에 대해서만** 적용. 비인증(익명) 경로는 `?sessionId=임의값`만 넘기면 **계정 사용자의 카트 아이템도 삭제/수정 가능** (userId≠0인 아이템이 sessionId 경로로 삭제됨 — 200 확인)
- 수정: 익명 경로에서도 **아이템 소유권 검증** — ① cart item 로드 후 `item.userId != 0`(계정 소유)이면 익명 sessionId 경로로는 **403/404 거부** (계정 아이템은 반드시 인증 토큰으로만) ② `item.userId == 0`(순수 익명 아이템)이면 요청의 `sessionId`가 **아이템에 기록된 세션과 일치**할 때만 허용, 불일치 시 403/404
- 회귀 금지: 인증 사용자가 자기 아이템 수정/삭제(200), 익명 사용자가 **자기 세션** 아이템 수정/삭제(200), 카트 추가/조회 정상

## 반드시 지킬 것
- 수정 범위 2건 한정, 프론트엔드(src/) 수정 금지
- 시크릿 커밋 금지, docker 인프라/터널/Jenkins 건드리지 말 것
- `-v` 볼륨 삭제 절대 금지, 재빌드는 `docker compose up -d --build backend`

## 검증 (실제 실행)
로컬 API `http://localhost:8081` (또는 nginx `http://localhost`).
1. **CWE-639-일기**: (a) 익명 `GET /api/v1/diaries` → **401/403** (b) 사용자 A 로그인 후 일기 1개 작성 → 사용자 B 토큰으로 `GET /api/v1/diaries` → **A의 일기 미노출** (빈 목록 또는 B 소유만) (c) A 본인 조회 → **A 일기 보임** (회귀)
2. **CWE-639-카트**: (a) 사용자 A(계정) 카트 아이템 생성 → **비인증** `DELETE /api/v1/cart/{id}?sessionId=xxx` → **403/404** (b) 익명 세션 아이템 생성(sessionId=X) → 다른 sessionId(Y)로 DELETE → **403/404**, 같은 X로 → **200** (회귀)
3. `docker compose run --rm test-go` **그린**
4. 회귀: register→login→상품생성 201, 일기 작성/조회 정상

## 산출물
- 커밋 1개: `fix(security): Strix 3차 2건 — 일기 인증·소유권 스코프 + 카트 익명 경로 소유권 검증`
- `git push origin master` (Jenkins 빌드 확인)
- 최종 응답: 수정 요약(파일/라인) + curl 검증 요약 + Jenkins 빌드 결과

지금 바로 진행해. 질문하지 마.
