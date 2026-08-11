# TASK — Strix 4차 스캔 발견 3건 수정 (cmall_dd)

당신은 **Atlas - Plan Executor**입니다. `/home/dduckbeagy/cmall_dd` 저장소에서 아래 3건 보안 취약점을 수정하라. **질문하지 말고 바로 진행**하라. 수정 후 **실행 검증 + 커밋 + push**까지 완료하라.

## 배경
Strix 4차 재스캔에서 3건 발견 (리포트: `/home/dduckbeagy/security/strix_runs/dispatch-dir-boxes-mas-trycloudf_4d8a/vulnerabilities.json`). 기존 8건 수정 완료(74c8e33, 53de306, df5ba8a). HIGH는 이번에 없음.

## 수정 항목

### 1. [MEDIUM, CWE-639] `POST /api/v1/diary-comments` — 타 사용자 **비공개** 일기에 댓글 작성 가능
- 문제: 댓글 생성 핸들러가 대상 diaryId의 **소유권/공개 여부를 검증하지 않음** → 아무 인증 사용자가 남의 비공개 일기에 댓글 작성 가능 (불법 쓰기)
- 수정: 댓글 저장 전 대상 일기 로드 후 **`diary.user_id == 호출자` OR `diary.is_public(공개)`** 인 경우에만 허용, 아니면 **403/404**. (기존 일기 삭제/수정 핸들러의 소유권 패턴 참고)
- 회귀 금지: 본인 일기 댓글, 공개 일기 댓글, 일기 댓글 조회는 정상

### 2. [MEDIUM, CWE-20] `POST /api/v1/cart` — 음수/0 수량 허용
- 문제: quantity가 음수/0이어도 수락 → (userId, productId) 집계 라인에서 **주문 합계를 깎는** 조작 가능
- 수정: add-to-cart와 update-quantity(PUT `/api/v1/cart/{id}`) 양쪽에서 **`quantity >= 1` 정수 검증**, 위반 시 **400**. (구조체 binding 태그 `gte=1` 또는 핸들러 검증)
- 회귀 금지: 정상 수량(1 이상) 추가/수정 200, 기존 장바구니 흐름 정상

### 3. [LOW, CWE-639] 익명 카트 sessionId 탈취 — 클라이언트 생성·IP 미바인딩
- 문제: sessionId가 클라이언트 `Math.random()` 기반(localStorage)이라 예측 가능 + 서버가 임의 sessionId를 그대로 수락 → 남의 익명 카트 조회/이전 가능
- 수정 (**프론트엔드 수정 없이 서버측 완화**): 기존 `cart_sessions` 테이블(session_id, client_ip, created_at — merge 수정 때 신설됨)을 활용해 **익명 카트 접근을 IP에 바인딩** — 익명 경로의 cart 조회/수정/삭제/merge 시 해당 sessionId의 기록 IP와 호출자 IP(`c.ClientIP()`)가 일치해야 허용, 불일치/기록 없음 → **403**. 첫 접근 시 upsert로 기록. (같은 사용자가 같은 기기/네트워크에서 쓰는 정상 흐름은 IP 동일 → 회귀 없음. NAT/모바일 전환 시 IP 변경으로 익명 카트가 끊기는 부작용은 인지하되 LOW 대응으로 수용 — 코드에 주석 명시)
- 회귀 금지: 같은 IP에서 익명 카트 추가/조회/merge 정상, 인증 사용자 카트 흐름 정상

## 반드시 지킬 것
- 수정 범위 3건 한정, **프론트엔드(src/) 수정 금지** (3번은 서버측 완화로)
- 시크릿 커밋 금지, docker 인프라/터널/Jenkins 건드리지 말 것, `-v` 절대 금지
- 재빌드: `docker compose up -d --build backend`

## 검증 (실제 실행)
로컬 API `http://localhost:8081` (또는 nginx `http://localhost`).
1. **댓글**: (a) A가 비공개 일기 작성 → B 토큰으로 `POST /api/v1/diary-comments` {diaryId: A의 것} → **403/404** (b) A 본인 댓글 → **201** (c) 공개 일기에 B 댓글 → **201** (회귀)
2. **수량**: `POST /api/v1/cart` {quantity: -1} → **400**, {quantity: 0} → **400**, {quantity: 2} → **201/200** (회귀). PUT 수량 -1 → **400**
3. **세션IP**: 익명 세션으로 카트 추가(sessionId=X, IP 기록) → `X-Forwarded-For: 다른IP`로 GET/merge → **403**, 같은 IP → **200** (회귀)
4. `docker compose run --rm test-go` **그린**
5. 회귀: register→login→상품생성 201, 일기 작성/댓글 조회 정상

## 산출물
- 커밋 1개: `fix(security): Strix 4차 3건 — 일기 댓글 소유권·카트 수량 검증·익명 세션 IP 바인딩`
- `git push origin master` (Jenkins 빌드 확인)
- 최종 응답: 수정 요약(파일/라인) + curl 검증 요약 + Jenkins 빌드 결과

지금 바로 진행해. 질문하지 마.
