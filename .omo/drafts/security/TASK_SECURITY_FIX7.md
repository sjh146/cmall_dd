# TASK — Strix 7차 스캔 발견 1건 수정 (cmall_dd)

당신은 **Atlas - Plan Executor**입니다. `/home/dduckbeagy/cmall_dd` 저장소에서 아래 보안 취약점을 수정하라. **질문하지 말고 바로 진행**하라. 수정 후 **실행 검증 + 커밋 + push**까지 완료하라.

## 배경
Strix 7차 재스캔 (리포트: `/home/dduckbeagy/security/strix_runs/dispatch-dir-boxes-mas-trycloudf_a851/vulnerabilities.json`). 14건 수정 완료, HIGH/MEDIUM 0건 — **LOW 1건만 남음**.

## 수정 항목

### [LOW, CWE-362 TOCTOU] `/api/v1/cart/merge` 동시성 레이스 — 수량 중복
- 문제: 동시에 merge 요청 N개가 같은 게스트 카트를 읽고 계정 카트에 append → 게스트 아이템이 N번 복제, 수량 N배 (검증: 12개 동시 merge → 12×200, 수량 6→72)
- 수정: **merge를 원자적·멱등으로** —
  1. `MergeCart` 핸들러에서 **단일 DB 트랜잭션** 안에서: ① 게스트 카트 아이템 조회 ② 계정 카트로 복사(또는 기존 라인 upsert) ③ **게스트 카트 아이템 삭제(소비)** — 같은 트랜잭션으로 커밋
  2. 동시 요청이 와도 첫 번째가 게스트 아이템을 소비하면 나머지는 **빈 게스트 카트**를 보게 됨 → 중복 없음
  3. 기존 DB 트랜잭션 패턴이 없다면 `db.BeginTx`(또는 프로젝트가 쓰는 SQLAlchemy/pgx 패턴 — 코드 확인 후 일관되게) 사용, 에러 시 롤백 + `respondDBError`(기존 errors.go 헬퍼 재사용)
- 회귀 금지: 정상 merge 200 + 아이템 이전 동작, 게스트 카트가 merge 후 비워지는 동작, 인증/쿠키/IP 검증(403들) 유지

## 반드시 지킬 것
- 수정 범위: MergeCart 원자화 한정, 프론트엔드(src/) 수정 금지, 시크릿 커밋 금지
- docker 인프라/터널/Jenkins 미변경, `-v` 절대 금지, 재빌드 `docker compose up -d --build backend`

## 검증 (실제 실행, 로컬 API `http://localhost:8081`)
1. **동시성**: 게스트 카트에 상품 1개(수량 1) → 동시 merge 10회(파이썬 `ThreadPoolExecutor` 또는 `xargs -P` curl) → 성공 1개 + 나머지 0/빈 카트 거부(200이어도 중복 없음) → 이후 계정 카트 확인 시 **해당 상품 수량 1·중복 행 없음**
2. 정상 merge(1회) → 200 + 아이템 이전 + 게스트 카트 비워짐
3. 기존 403 회귀: 무쿠키/타IP merge 403, 무쿠키 카트 조회 403
4. `docker compose run --rm test-go` **그린**

## 산출물
- 커밋 1개: `fix(security): Strix 7차 — 카트 merge 원자화(TOCTOU 방지)`
- `git push origin master` (Jenkins 빌드 확인)
- 최종 응답: 수정 요약(파일/라인) + 동시성 검증 출력 + Jenkins 빌드 결과

지금 바로 진행해. 질문하지 마.
