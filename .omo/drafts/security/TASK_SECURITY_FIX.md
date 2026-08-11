# TASK — Strix 보안 취약점 수정 (cmall_dd)

당신은 **Atlas - Plan Executor**입니다. `/home/dduckbeagy/cmall_dd` 저장소에서 아래 4건의 보안 취약점을 수정하라. **질문하지 말고 바로 진행**하라. 수정 후 **실행 검증 + 커밋 + push**까지 완료하라.

## 배경
Strix AI 펜테스트가 라이브 배포 URL(`https://dispatch-dir-boxes-mas.trycloudflare.com`)에서 4건 발견 (PoC 검증됨, 리포트: `/home/dduckbeagy/security/strix_runs/dispatch-dir-boxes-mas-trycloudf_03b3/vulnerabilities.json`). 전부 **실제 취약점** — 수정 대상.

## 수정 항목 (CWE별)

### 1. [HIGH, CWE-862] `/api/v1/admin/set-admin` — 관리자 자가승격
- 문제: Bearer 인증된 **아무 사용자**가 `POST /api/v1/admin/set-admin` 호출로 자신을 admin으로 승격 (재로그인 시 role=admin JWT 발급)
- 수정: 핸들러 진입 시 **서버 DB의 호출자 레코드**를 조회해 `role == "admin"`인 경우에만 승격 허용, 아니면 **403**. (JWT의 role 클레임만 믿지 말고 서버측 user 레코드로 검증 — admin 체크 미들웨어가 이미 있다면 그것 재사용)

### 2. [MEDIUM, CWE-639 IDOR] `/api/v1/cart/{id}` PUT/DELETE — 타 사용자 카트 조작
- 문제: PUT/DELETE가 `{id}`의 cart item이 **호출자 소유**인지 검증 안 함 → User B가 User A의 카트 항목 수정/삭제 가능
- 수정: PUT/DELETE 핸들러에서 cart item 로드 후 `cartItem.userId == 호출자 id` 검증, 불일치 시 **403 또는 404** (products/diaries 삭제 핸들러의 기존 소유권 패턴과 동일하게)

### 3. [MEDIUM, CWE-204] `/api/v1/auth/register` — 이메일 존재 여부 노출 (enumeration oracle)
- 문제: `"Email already registered"` 응답으로 미가입 이메일과 구분됨
- 수정: 중복 이메일 시에도 **통일된 응답** 반환 (예: 항상 동일한 오류 메시지/코드 — `"Registration failed"` 또는 동일 409 메시지). 단, **정상 회원가입 흐름은 유지** (프론트 UX 깨지 않게: 성공 시 201 + 토큰 그대로)

### 4. [MEDIUM, CWE-20] `POST /api/v1/products` — 음수 가격 허용
- 문제: `price: -50`도 저장되어 공개 리스팅에 노출
- 수정: 서버측 검증 추가 — `price >= 0` (그리고 합리적 상한, 예: 1억 원 이하) 위반 시 **400**. Go 구조체 validation(`required` 태그)에 최소값 조건 추가하는 방식 권장

## 반드시 지킬 것 (가드레일)
- 수정 범위는 위 4건의 핸들러/검증 로직으로 한정 — **그 외 기능(상점/결제/장바구니 정상 동작) 변경 금지**
- 프론트엔드(src/)는 **수정 금지** (백엔드 검증만으로 충분)
- 시크릿 커밋 금지, 기존 동작(회원가입/로그인/상품생성 성공 케이스) 회귀 금지
- docker compose 인프라/터널/Jenkins 건드리지 말 것

## 검증 (수정 후 반드시 실제 실행)
로컬 API는 `http://localhost:8081` (백엔드 직접) 또는 `http://localhost` (nginx). 컨테이너 재빌드 필요 시 `docker compose up -d --build backend` (postgres/nginx/frontend는 유지, `-v` 절대 금지).
1. **CWE-862**: 신규 seller 등록 → 그 토큰으로 `POST /api/v1/admin/set-admin` → **403** 확인. (기존 admin 계정 없으면: DB에 직접 admin 레코드 생성 또는 최초 admin만 통과하는 bootstrap 경로가 있는지 코드 확인 후 검증)
2. **CWE-639**: 사용자 A 장바구니 항목 생성 → 사용자 B 토큰으로 `PUT/DELETE /api/v1/cart/{id}` → **403/404** 확인
3. **CWE-204**: 같은 이메일 2회 register → **두 응답 동일** 확인
4. **CWE-20**: `price: -100`으로 product 생성 → **400** 확인
5. `docker compose run --rm test-go` (go vet/build) **그린**
6. 기존 성공 케이스 회귀: register→login→product 생성(정상가) 201

## 산출물
- 수정 커밋 1개 (메시지: `fix(security): Strix 발견 4건 수정 — set-admin 권한검증·카트 소유권·이메일 오라클·음수가격`)
- `git push origin master` (webhook → Jenkins 자동 빌드 #6 확인)
- 완료 후 최종 응답: 각 CWE 수정 요약(파일/라인) + curl 검증 출력 요약 + Jenkins 빌드 결과

지금 바로 진행해. 질문하지 마.
