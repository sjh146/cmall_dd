# TASK — Strix 6차 스캔 발견 1건 수정 (cmall_dd)

당신은 **Atlas - Plan Executor**입니다. `/home/dduckbeagy/cmall_dd` 저장소에서 아래 보안 취약점을 수정하라. **질문하지 말고 바로 진행**하라. 수정 후 **실행 검증 + 커밋 + push**까지 완료하라.

## 배경
Strix 6차 재스캔 (리포트: `/home/dduckbeagy/security/strix_runs/dispatch-dir-boxes-mas-trycloudf_bb17/vulnerabilities.json`). 13건 수정 완료 상태에서 **1건만 남음**.

## 수정 항목

### [MEDIUM, CWE-209] PostgreSQL 드라이버 에러 노출 (cart API)
- 문제: `POST /api/v1/cart`에 존재하지 않는 `productId`(FK 위반)를 보내면 **HTTP 500 본문에 원본 드라이버 에러** 노출: `pq: insert or update on table "cart" violates foreign key constraint "cart_product_id_fkey"...` → DBMS 종류·내부 테이블명·제약조건명 유출
- 수정: **DB 오류를 클라이언트에 원본 그대로 반환하지 않기** —
  1. cart 추가(POST)에서 FK 위반 등 DB 오류 시 → **400/404 `"invalid product"` 같은 일반 메시지** 반환, 상세 에러는 **서버 로그에만** 기록 (`log.Printf` 등)
  2. 같은 패턴이 다른 엔드포인트(상품/일기/댓글 등)에도 있는지 **grep으로 확인 후 일괄 적용** (스코프: 드라이버 에러를 그대로 반환하는 곳 — 검색: `pq:` 문자열이 응답에 닿는 경로, `500` 반환하는 DB 에러 처리)
  3. 기존 성공 케이스·4xx 검증(권한 403 등)은 그대로 유지 — **에러 응답 텍스트만 일반화**
- 회귀 금지: 정상 카트 추가 201, 유효한 권한 검증(403)들 유지, 상품/일기 정상 동작

## 반드시 지킬 것
- 수정 범위: DB 에러 응답 일반화 한정 (기능 변경 금지), 프론트엔드(src/) 수정 금지, 시크릿 커밋 금지
- docker 인프라/터널/Jenkins 미변경, `-v` 절대 금지, 재빌드 `docker compose up -d --build backend`

## 검증 (실제 실행, 로컬 API `http://localhost:8081`)
1. `POST /api/v1/cart` `{productId: 999999999, quantity:1}` (유효 토큰) → **400 또는 404**, 응답 본문에 `pq:`/`postgres`/`constraint` **미포함**, 일반 메시지만
2. 서버 로그(`docker logs cmall_dd-backend`)에 상세 에러는 기록됨
3. 정상 `POST /api/v1/cart` (유효 productId) → **201** (회귀)
4. 기존 권한 검증 회귀: seller의 admin 타입 상품 생성 403, 카트 익명 무쿠키 403 등 스팟 체크
5. `docker compose run --rm test-go` **그린**

## 산출물
- 커밋 1개: `fix(security): Strix 6차 — DB 드라이버 에러 응답 일반화 (CWE-209)`
- `git push origin master` (Jenkins 빌드 확인)
- 최종 응답: 수정 요약(파일/라인) + curl 검증 요약 + Jenkins 빌드 결과

지금 바로 진행해. 질문하지 마.
