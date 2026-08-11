---
slug: cmall-dd-deploy
status: awaiting-approval
intent: clear
pending-action: write .omo/plans/cmall-dd-deploy.md
approach: cmall_dd를 인터넷 배포(docker compose 수정 + cloudflared 두 번째 터널) + Jenkins/GitHub webhook 테스트-수정 루프 구축. Jenkins pipeline job 실제 생성(REST API) 포함. selling_dd 교훈(webhook≠job) 반영.
---

# Draft: cmall-dd-deploy

## Components (topology ledger)
| id | outcome | status | evidence |
| --- | --- | --- | --- |
| A | docker compose 시크릿 분리 + 포트 충돌 해결(5433) + 로컬 검증 | active | docker-compose.yml:1-86, server/ENV_SETUP.md |
| B | cloudflared 두 번째 터널(80) -> 공개 URL | active | 포트 80/443 비어있음(ss 실측) |
| C | 루트 Jenkinsfile + compose test 서비스 | active | selling_dd/Jenkinsfile (proven 패턴) |
| D | Jenkins pipeline JOB 생성(REST API config.xml) — selling_dd 실패 반복 금지 | active | jenkins jobs엔 cmall_dd job 없음 |
| E | GitHub webhook 등록 + 재등록 스크립트 | active | selling_dd/scripts/re-register-webhook.sh |

## Open assumptions (announced defaults)
| assumption | adopted default | rationale | reversible? |
| --- | --- | --- | --- |
| Go/Node 테스트 없음 확인 (go 미설치, *_test.go 0, frontend test 0) | 테스트 전략 = 최소 스모크(빌드+헬스체크) + tsc --noEmit 타입체크 | INSTRUCTIONS C요구 real-check | Y |
| postgres 호스트 포트 | 5433으로 변경(내부 네트워크에는 그대로 5432) | selling_dd 5432 점유 충돌 | Y |
| 443 HTTPS | 이번 범위 제외(80 터널만) | 인증서 없음, INSTRUCTIONS "이번 범위 결정 명시" | Y |
| VITE_API_URL vs VITE_API_BASE_URL | api.ts는 VITE_API_BASE_URL 읽음(기본 '/api/v1' 상대경로) — nginx same-origin 프록시라 공개 URL 불필요. compose의 VITE_API_URL는 미사용 버그 | src/lib/api.ts:1 | Y |
| Jenkins 테스트 실행 경로 | docker compose run --rm test (docker-in-docker, selling_dd 패턴) | Jenkins 컨테이너에 Go/Node 없음 | Y |
| Jenkins job | pipeline job (CpsScmFlowDefinition config.xml) via REST API + crumb | selling_dd에서 만들어졌던 방식, webhook 663028305 참조 | Y |

## Findings (cited - path:lines)
- docker-compose.yml:16,19 DB_PASSWORD=postgres, JWT_SECRET 하드코딩 (보안약점)
- docker-compose.yml:49 postgres 5432:5432 → 호스트 충돌 위험
- docker-compose.yml:37 VITE_API_URL=http://localhost:8081/api/v1 (미사용 버그)
- src/lib/api.ts:1 `const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';` — 상대경로 기본, nginx /api 프록시로 same-origin 동작
- nginx.conf:31-40 /api/ → backend:8081 프록시, 41-51 / → frontend:80 프록시
- main.go:38 CORS AllowOrigins = localhost:3000/5173 하드코딩 — CORS_ORIGINS env 미사용 (ENV_SETUP.md:19는 CORS_ORIGINS 문서화했으나 코드반영 안됨)
- server에 *_test.go 0개, 호스트 go 미설치 (go: command not found)
- package.json:55-58 build 스크립트만, test 스크립트 없음; tsc 미설치(devDeps에 typescript 없음) → tsc 타입체크는 typescript 설치 필요
- 포트 실측: 8080(Jenkins), 5432(selling_dd_db) 사용중; 80/443/3000/8081 비어있음
- cloudflared: `/home/dduckbeagy/.local/bin/cloudflared`, 현재 8080 터널 1개 (log /tmp/cf-tunnel.log)
- Jenkins: admin ***REDACTED***, 크레덴셜 store에 github-token 5종, 기존 job finance_dd-pipeline/survey-auto-extensions, cmall_dd job 없음 (selling_dd 교훈)
- /tmp/jenkins-cli.jar 존재, java 있음
- git remote https://github.com/sjh146/cmall_dd.git (PAT은 ~/.git-credentials, chmod600, remote에 미노출)
- Dockerfile Go 1.21 alpine, CGO_ENABLED=1(gcc/musl-dev), alpine:3.19 런타임
- Dockerfile.frontend node:18-alpine, npm run build → outDir 'build' (vite.config.ts:54)
- vite.config.ts:54 build.outDir = 'build' → Dockerfile.frontend:22 COPY /app/build

## Decisions (with rationale)
- D1: postgres 호스트 바인딩 5433(내부 5432 유지) — selling_dd 충돌 회피
- D2: 시크릿은 루트 `.env` + Jenkins credential 참조로, 커밋 금지 — compose는 env_file + ${VAR} 참조로
- D3: 프론트 VITE_API_BASE_URL은 기본 '/api/v1' 상대경로 유지(npx 통해 same-origin) → 공개 URL 빌드주입 불필요. compose의 잘못된 VITE_API_URL 제거
- D4: CORS는 nginx same-origin 프록시 하에서 필요없음(브라우저가 같은 origin으로 호출), 但 백엔드 CORS에 공개 도메인 추가 필요(직접 접근 대비) — main.go CORS_ORIGINS env 반영 or nginx 경유로 무력화
- D5: 테스트 전략 = 최소 스모크: Go `go vet`/`go test`(없으면 빌드 성공), frontend `npm ci && npm run build`(+npm i -D typescript 후 npx tsc --noEmit). Jenkins는 compose test 서비스
- D6: Jenkins job 생성은 REST API: crumb + manager(Jenkins CLI)로 config.xml(UUID 리젠) 업로드 — selling_dd 실패 반복 금지가 최우선
- D7: 443/HTTPS 제외 — 이번은 80 quick tunnel 공개 + 후속 Named Tunnel 이슈 기록
- D8: 앱 DB auto-create: backend가 CreateTables로 스키마 자동 생성 (database.go)

## Scope IN
- docker compose 수정(postgres 5433, 시크릿 .env+credential, 잘못된 VITE_API_URL 제거, CORS env)
- 루트 .env 생성(미커밋) + .env.example 갱신
- docker compose up -d --build 로컬 검증(backend /api/v1 health, frontend 200, nginx 80 라우팅)
- cloudflared 두 번째 터널(80) + 공개 URL + 테스트
- Jenkinsfile + compose test 서비스 + Jenkins pipeline JOB 생성(REST API)
- GitHub webhook 등록(2번째 터널) + scripts/re-register-webhook.sh(멱등, selling_dd 재사용)
- E2E: feature 브랜치 push→webhook→빌드→그린→master 머지
- 심층분석: 포트충돌/터널URL변동/job생성방법비교/시크릿관리/테스트현황

## Scope OUT (Must NOT have)
- 기존 인프라 비파괴: Jenkins 터널, selling_dd postgres(5432), selling_dd 파이프라인
- 5432 재바인딩 금지(충돌)
- 시크릿(JWT_SECRET/DB_PASSWORD/PAT) 커밋 금지
- 443/HTTPS 이번 범위 제외
- 제품코드(Go 핸들러/프론트 기능) 구현 없음 — 산출물은 계획서+심층분석 + 승인 후 배포 실행

## Open questions
- 사용자 발급 대기 항목 기록(승인 후 필요): GitHub 새 PAT(repo+admin:public_key) — 현재 ~/.git-credentials의 유효성. ADMIN_EMAIL/JWT_SECRET 새 값? 최소한 JWT_SECRET 신규생성. (개방 — 실행 전 출력 전용)

## Approval gate
status: plan-written
<!-- 이 계획은 INSTRUCTIONS.md의 "질문하지 말고 바로 진행" 지시로 작성 완료. 실행은 $start-work 시 시작. -->
- [x] 탐색 완료(포트·Jenkins·터널·테스트 실측)
- [x] Metis 갭 분석 반영(G1-G14: tsconfig 신규, test-go golang 이미지, CORS scope 예외, Poll SCM 안전망, 플러그인 전제, PAT 런타임 추출, webhook delivery 검증)
- [x] .omo/plans/cmall-dd-deploy.md 작성 완료 (9 todos / 4 waves / 심층분석 6섹션)
