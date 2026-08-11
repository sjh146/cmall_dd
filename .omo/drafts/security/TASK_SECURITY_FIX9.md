# TASK — Strix 9차 스캔 발견 1건 수정 (cmall_dd)

당신은 **Atlas - Plan Executor**입니다. `/home/dduckbeagy/cmall_dd` 저장소에서 아래 보안 취약점을 수정하라. **질문하지 말고 바로 진행**하라. 수정 후 **실행 검증 + 커밋 + push**까지 완료하라.

## 배경
Strix 9차 재스캔 (리포트: `/home/dduckbeagy/security/strix_runs/dispatch-dir-boxes-mas-trycloudf_8b32/vulnerabilities.json`). 8차에서 상품 목록/상세 응답의 `licenseKey`/`downloadUrl` 스트립을 적용했지만, **카트 응답(`GET /api/v1/cart`)에 임베드된 상품 객체**에서 같은 필드가 여전히 노출 — 구매 없이 카트에 담기만 해도 아무 인증 사용자가 다른 판매자의 라이선스 키/다운로드 URL 열람 가능.

## 수정 항목

### [MEDIUM, CWE-639] 카트 응답에서 판매자 민감 필드 노출 (licenseKey/downloadUrl)
- 문제: `GET /api/v1/cart`가 각 카트 아이템의 **전체 상품 객체**(licenseKey·downloadUrl 포함)를 반환 — 구매자 여부와 무관
- 수정: **공용 필드 스코핑 함수**를 만들어 일괄 적용 —
  1. 8차에서 쓴 스트립 로직을 **공용 헬퍼**(예: `sanitizePublicProduct(p)` — `licenseKey`/`downloadUrl` 제거)로 추출
  2. `GET /api/v1/cart` 응답의 상품 객체에 적용
  3. **상품 객체를 임베드하는 다른 모든 직렬화 경로 grep**(상품 목록/상세/검색/카트/주문/구매 내역 등)에서 판매자 본인·실구매자 컨텍스트가 아닌 곳은 전부 적용. **실구매자에게 구매 후 다운로드를 주는 정당한 경로**(구매 내역/주문 상세에서 구매자 본인에게)는 유지 — 코드 확인 후 보존
- 회귀 금지: 카트 추가/조회/삭제 200·201, 상품 목록/상세 200, 구매·다운로드 정상 흐름, 기존 403들

## 반드시 지킬 것
- 수정 범위: 필드 스코핑 적용 한정, 프론트엔드(src/) 수정 금지, 시크릿 커밋 금지
- docker 인프라/터널/Jenkins 미변경, `-v` 절대 금지, 재빌드 `docker compose up -d --build backend`

## 검증 (실제 실행, 로컬 API `http://localhost:8081`)
1. 사용자 A(판매자)가 `downloadUrl`/`licenseKey` 있는 상품 생성 → 사용자 B(다른 계정)가 그 상품을 카트에 추가 → B의 `GET /api/v1/cart` 응답의 상품에 `licenseKey`/`downloadUrl` **미포함**
2. A 본인이 자기 상품을 카트에 담았을 때도 (공개 컨텍스트라면) 미포함 — 정책 확인
3. 상품 목록/상세 여전히 미노출 (회귀), 정상 카트 흐름 200
4. `docker compose run --rm test-go` **그린**

## 산출물
- 커밋 1개: `fix(security): Strix 9차 — 카트 응답 상품 민감필드 스코핑(공용 헬퍼)`
- `git push origin master` (Jenkins 빌드 확인)
- 최종 응답: 수정 요약(파일/라인) + curl 검증 요약 + Jenkins 빌드 결과

지금 바로 진행해. 질문하지 마.
