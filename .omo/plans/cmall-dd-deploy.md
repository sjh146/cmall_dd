# cmall-dd-deploy - Work Plan

> **Version: v2 (2026-08-09, Hermes 심층 리뷰 반영)**
> v1: Prometheus - Plan Builder 작성 (9 todos / 4 waves + 심층분석 6섹션, Metis 갭분석 반영). v2 변경:
> 1. **Todo 3 baked-URL 검증 오류 수정**: 로컬 `./build`는 빌드가 컨테이너에서 일어나 존재하지 않음(빈 마운트 → 검증이 빈손 통과). 빌드된 프론트 이미지 내부(`/usr/share/nginx/html`)를 grep하도록 수정.
> 2. 실행 전제 확인 완료: `selling_dd/scripts/re-register-webhook.sh` 실존(계획 참조 유효), Strix 1.5.1 설치됨(보안테스트용).
> 심층분석(Hermes gate): P0/P1 없음 — 계획 검증 완료.

## TL;DR (For humans)
<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->
<!-- Plain English for a non-engineer: NO file paths, NO todo numbers, NO wave/agent/tool names. -->

**What you'll get:** DevMall 웹서버를 **인터넷에 공개**하고, 코드가 바뀔 때마다 **GitHub 푸시 → 자동 테스트 → 통과 여부 확인**이 도는 루프를 붙입니다. 공개는 cloudflare 임시 터널로, 자동 테스트는 Jenkins라는 자동검사 도구가 담당합니다. 가장 중요한 것은 — 지난번 다른 프로젝트(selling_dd)에서 "알림만 등록하고 실제 검사 작업을 안 만들어서" 자동화가 안 돌던 실수를 여기선 **실제 검사 작업을 만드는 것**으로 반복하지 않는다는 점입니다.

**Why this approach:** 로그인 비밀·DB 비밀번호가 코드에 하드코딩돼 있어 이를 분리하고(보안), 데이터베이스 포트가 다른 프로그램과 겹쳐 충돌하므로 포트만 바꿉니다(내부는 그대로). 테스트가 사실상 없어서 "빠르게 뜨는지 + 자동 점검이 도는지"를 최소로 확인하는 방식으로 진행합니다.

**What it will NOT do:** 기존에 돌고 있는 다른 프로그램(Jenkins 터널, selling_dd 데이터베이스, 기존 자동검사)은 절대 건드리지 않습니다. 안전한 HTTPS 접속(443)은 이번에 하지 않고 다음 작업으로 미룹니다. 제품의 기능(상점/장바구니 등) 코드는 수정하지 않습니다. 비밀번호 등 비밀정보는 커밋하지 않습니다.

**Effort:** Medium
**Risk:** Medium - 터널 주소가 재시작 때마다 바뀌어 자동테스트 알림이 끊길 수 있음(재등록 스크립트로 완화), 지난 실패(selling_dd job 미생성) 반복 방지가 핵심.
**Decisions to sanity-check:** ① 데이터베이스 포트를 5433으로 옮김(내부 5432 유지), ② HTTPS(443)는 이번에 빼고 80 공개만, ③ 자동검사 작업을 실제로 만드는 것(REST API)이 최우선, ④ 비밀은 루트 은닉파일 + 별도 보관함으로 분리.

Your next move: 승인하시면 계획 파일이 확정되어 `$start-work`로 실행합니다 (파일, 웨이브, 투두는 아래). 실행은 배포·CI 설정 구현 단계입니다.

---

> TL;DR (machine): Medium effort, Medium risk. cmall_dd 인터넷 배포(cloudflared 2nd 터널 80, postgres 5433, 시크릿 .env 분리) + Jenkins/GitHub webhook 테스트-수정 루프(Jenkinsfile+compose test 서비스, **Jenkins pipeline job 실생성(REST API)** — selling_dd 교훈 반복 방지, 재등록 스크립트). 9 todos, 4 waves, 최소 스모크(Go 빌드/vet + frontend tsc/build) 테스트.

## Scope
### Must have
- **A. 배포 (인터넷 노출)** — ① docker compose 시크릿 분리(루트 `.env` + Jenkins credential 참조, 커밋 금지), ② postgres 호스트 포트 충돌 해결(**5432→5433**, 내부 네트워크는 5432 유지), ③ 잘못된 `VITE_API_URL` env 제거(코드는 `VITE_API_BASE_URL`을 읽음, nginx same-origin 프록시로 공개 URL 불필요), ④ nginx 80 경로 라우팅 검증 → `docker compose up -d --build` 로컬 게이트 → cloudflared 두 번째 터널(80)로 공개 URL. 443/HTTPS는 이번 범위 제외(후속 Named Tunnel 이슈 기록).
- **B. Jenkins + git webhook 테스트/수정 루프** — ① 루트 `Jenkinsfile`(checkout → Go 단위/빌드 스모크 → 프론트 `npm ci && tsc --noEmit && vite build` → compose smoke → 리포트), ② compose `test` 서비스(Go/Node 테스트 실행 경로, docker-in-docker/selling_dd 패턴), ③ **Jenkins pipeline JOB 실제 생성(REST API + crumb + config.xml 업로드)** — selling_dd 실패(webhook만 만들고 job 미생성) 반복 금지가 최우선, ④ GitHub webhook 등록(두 번째 터널 URL로 `/github-webhook/`) + **`scripts/re-register-webhook.sh`**(멱등, selling_dd 재사용), ⑤ E2E 검증(feature 브랜치 push → webhook → 그린 → master 머지).
- **C. 테스트 전략(현황 실측 후 결정)** — `server/`에 Go 테스트 없음(`*_test.go` 0), 호스트 go 미설치, 프론트 테스트 없음 → 최소 스모크(빌드 성공 + 헬스체크 + `tsc --noEmit` 타입체크)로 계획.
- **D. 산출물** — `.omo/plans/cmall-dd-deploy.md`(계획서+심층분석 6섹션). 승인 후 `$start-work`로 실행.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- NO 기존 인프라 비파괴: Jenkins 터널(8080), `selling_dd_db` postgres(5432), selling_dd/finance_dd 파이프라인 — 모두 그대로 유지
- NO 5432 호스트 재바인딩(충돌); NO postgres 호스트 포트를 5432로 되돌리는 일
- NO 시크릿 커밋: `JWT_SECRET`, `DB_PASSWORD`, `POSTGRES_PASSWORD`, `ADMIN_EMAIL`, PAT — 절대 git에 노출 금지(로그·커밋·캡처 어디든); PAT는 `~/.git-credentials`(chmod 600) 런타임만
- NO 443/HTTPS 이번 범위 — 인증서 없음, quick tunnel은 80
- NO 제품 코드(Go 핸들러/프론트 기능) 구현/개선 — 배포·CI 설정 파일만 수정
- NO `.env`(루트/server) 커밋, `server/.env.docker` 커밋 — `.gitignore`에 이미 있음(신규 확정)
- NO Jenkins 컨테이너에 Go/Node 설치 시도(없음 — compose test 서비스로 우회)
- NO 실 실 데이터 생성; DB는 fresh(신규 postgres 볼륨, 기존 데이터 없음)

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: **tests-after(스모크 중심)** — Go는 `go vet ./...`/`go test ./...`(테스트 없어도 빌드+vet 성공 확인), 프론트는 `npm ci && npx tsc --noEmit && npm run build`(typescript는 `npm i -D typescript`로 신규 추가), docker compose smoke(backend /api/v1 health, frontend 200, nginx 80 라우팅). 실행 위치는 로컬 게이트 = 호스트 명령, CI = compose `test` 서비스.
- Evidence: `.omo/evidence/task-<N>-cmall-dd-deploy.txt` — 각 todo QA가 append. 허용 확장자 `.txt`.
- Preconditions: 포트 80/443/3000/8081 비어있음(실측); 5432는 반드시 그대로; Jenkins admin `***REDACTED***`; `/tmp/jenkins-cli.jar` 존재; cloudflared `/home/dduckbeagy/.local/bin/cloudflared`; 현재 8080 터널 유지(두 번째로 80 터널 추가).
- 트러블슈팅 게이트: `docker compose up` 후 `docker compose ps`에서 postgres healthy / backend up / frontend up / nginx up 확인; backend 로그에서 `Failed to connect to database` 또는 `Server starting on port 8081` 확인.
- **중요 순서(git webhook)**: Jenkins JOB 생성(Todo 6) → Jenkinsfile 존재 확인 → webhook 등록(Todo 7) → E2E push. webhook 등록 ≠ job 생성(selling_dd 교훈 — 이 순서로 실패 방지).

## Execution strategy
### Parallel execution waves
> Wave 0(인프라·compose) → Wave 1(Jenkinsfile·test 서비스) → Wave 2(job 생성·webhook) → Wave 3(E2E·최종). 순차 의존이 강함(webhook는 job이 있어야 트리거).

**Wave 0 — 로컬 배포 준비 (독립 베이스):**
- Todo 1: 루트 `.env` 생성 + docker-compose 시크릿 분리 + postgres 5433 + 잘못된 VITE_API_URL 제거
- Todo 2: `tsconfig.json` 신규 + typescript devDep + backend CORS env 반영(명시적 배포 설정 예외)
- Todo 3: `docker compose up -d --build` 로컬 검증 (backend health / frontend 200 / nginx 80 라우팅)

**Wave 1 — 공개 터널:**
- Todo 4: cloudflared 두 번째 터널(80) 기동 + 공개 URL 실측 + 헬스체크
- Todo 5: 루트 `Jenkinsfile` + compose `test` 서비스 (Jenkinsfile은 job 생성의 전제)

**Wave 2 — Jenkins JOB + webhook (selling_dd 교훈 반영: job 실생성):**
- Todo 6: **Jenkins pipeline JOB 생성** — REST API(crumb + CLI)로 config.xml 업로드, job 존재 검증
- Todo 7: GitHub webhook 등록(두 번째 터널) + `scripts/re-register-webhook.sh` 산출물화

**Wave 3 — E2E + 최종:**
- Todo 8: E2E 검증 — feature 브랜치 push → webhook → Jenkins 빌드 트리거 → 그린 → master 머지
- Todo 9: 전체 게이트 + 심층분석 문서화 (Final verification wave F1-F4와 연계)

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 | — | 2,3,4,5 | — |
| 2 | 1 (compose env 결정) | 3 | 4 |
| 3 | 1,2 | 4,5 | — |
| 4 | 3 (backend up 후 터널 헬스) | 7 (터널 URL) | 5 |
| 5 | 3 | 6 (Jenkinsfile 전제) | 4 |
| 6 | 5 | 7,8 | 4 |
| 7 | 4,6 | 8 | — |
| 8 | 7 | 9 | — |
| 9 | 6,8 | — | — |
참고: Todo 7(webhook)은 Jenkins JOB(Todo 6)과 터널 URL(Todo 4) 둘 다 필요 — selling_dd 실패 반복 방지 순서.

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [x] 1. docker compose 시크릿 분리 + postgres 5433 + 잘못된 env 제거 + 루트 .env 생성
  What to do / Must NOT do: (a) 루트 `.env` 생성(커밋 금지, .gitignore:15에 이미 있음): `POSTGRES_PASSWORD=<dev용 강랜덤>, DB_PASSWORD=<같은값>, JWT_SECRET=<openssl rand -hex 32로 신규생성, dev인증용>, ADMIN_EMAIL=a@naver.com`. (b) `docker-compose.yml` 수정: postgres `ports: "5433:5432"`(host 5433, 컨테이너 5432 유지 — selling_dd 5432 충돌 회피); postgres `environment`의 `POSTGRES_PASSWORD`를 `${POSTGRES_PASSWORD:?}`로; backend `DB_PASSWORD`를 `${DB_PASSWORD:?}`, `JWT_SECRET`을 `${JWT_SECRET:?}`로, `ADMIN_EMAIL`을 `${ADMIN_EMAIL:-a@naver.com}`으로; compose에 `env_file: - .env` 추가(시크릿 주입). (c) frontend의 잘못된 `VITE_API_URL=http://localhost:8081/api/v1`(docker-compose.yml:37) 제거 — api.ts는 `VITE_API_BASE_URL`을 읽고 그마저 기본이 상대경로 `/api/v1`(src/lib/api.ts:1)이라 nginx same-origin `/api` 프록시에서 불필요; localhost 박는 건 배포 시 깨짐. (d) `server/.env.example`을 실제 사용 env와 동기화(DB_HOST=postgres, DB_PORT=5432, DB_PASSWORD, DB_NAME=postgres, PORT=8081, JWT_SECRET, ADMIN_EMAIL) — 과거 예제(`.env.example`은 이미 이 형태). Must NOT: 노출된 시크릿(`postgres`/`cmall_dd_secret_key_change_in_production`)을 그대로 두기, `.env`를 git에 추가, 5432 호스트 바인딩 유지.
  Parallelization: Wave 0 | Blocked by: — | Blocks: 2,3,4,5
  References: docker-compose.yml:16-20,37,49(하드코딩·5432·VITE_URL), src/lib/api.ts:1(VITE_API_BASE_URL), .gitignore:15(.env ignore), server/.env.example:1-8, server/ENV_SETUP.md:7-20
  Acceptance criteria (agent-executable): `grep -n "DB_PASSWORD" docker-compose.yml`가 `${DB_PASSWORD:?}` 형식(평문 없음); `grep -n "5433\|5432" docker-compose.yml`가 `"5433:5432"`만; `grep -rn "localhost:8081/api" docker-compose.yml` 결과 없음; 루트 `.env` 존재하고 `git check-ignore .env` 출력이 `.env`(무시됨).
  QA scenarios (tool: bash): happy=`docker compose config`가 `.env`에서 주입된 값 사용(시드 없이 OK); failure=`docker compose config`가 `the env var DB_PASSWORD is required`로 실패 → `.env` 부재 문제, 정확히 `.env` 값으로 재시도. Evidence .omo/evidence/task-1-cmall-dd-deploy.txt
  Commit: Y | chore(deploy): compose 시크릿 .env 분리(JWT/DB 비밀 강화) + postgres 5433 + VITE_API_URL 제거
- [x] 2. 프론트 타입체크 기반(tsconfig.json 신규·typescript devDep) + CORS env 반영(명시적 허용 예외)
  What to do / Must NOT do: (a) **`tsconfig.json`이 없음(실측)** → 루트에 신규 생성(Vite+React+TS 표준: `"compilerOptions": {"target":"ESNext","module":"ESNext","moduleResolution":"bundler","jsx":"react-jsx","strict":true,"skipLibCheck":true,"esModuleInterop":true,"resolveJsonModule":true,"allowImportingTsExtensions":true,"noEmit":true,"paths":{"@/*":["src/*"]}}`, `"include":["src","vite.config.ts"]`) — 그래야 `npx tsc --noEmit`가 유효한 gate가 됨. (b) `npm i -D typescript` 추가(devDeps 현재 typescript 없음, package.json:50-54). (c) **CORS**: `server/main.go:38` AllowOrigins를 env `CORS_ORIGINS`(콤마분리) fallback 기존 로 바꾸는 것은 **배포 목적의 설정 변경 예외로 허용**(nginx same-origin이라 런타임엔 불필요하나 백엔드 직접접근 대비, 배포 시 공개도메인 추가 가능) — 이 main.go 변경 외에 제품 로직(핸들러)은 절대 안 건드림. `config.AllowOrigins = splitEnv(os.Getenv("CORS_ORIGINS"), ["http://localhost:3000","http://localhost:5173","http://127.0.0.1:5173"])`. Must NOT: tsc를 빈 프로젝트 상태로 gate로 삼기(tsconfig 필수), AllowAllOrigins로 약화, 핸들러 로직 변경.
  Parallelization: Wave 0 | Blocked by: 1 | Blocks: 3
  References: (tsconfig 없음 실측), package.json:50-54(devDeps), server/main.go:37-42(CORS 하드코딩), server/ENV_SETUP.md:19(CORS_ORIGINS 문서), vite.config.ts:49(@ alias)
  Acceptance criteria (agent-executable): `test -f tsconfig.json` true; `grep -n '"typescript"' package.json` 존재; `grep -n "CORS_ORIGINS" server/main.go` 존재; `npm i -D typescript` 후 Git sts에서 package.json/tsconfig.json만 변경.
  QA scenarios (tool: bash + npm): happy=`npx tsc --noEmit`가 tsconfig 기준 에러 없이 종료(기존 코드 기준 에러는 리포트만); failure=tsc가 moduleResolution/JSX 오류 → tsconfig 옵션 조정, CORS env 미설정 시 fallback 동작 확인(Docker 로그). Evidence .omo/evidence/task-2-cmall-dd-deploy.txt
  Commit: Y | chore: tsconfig.json 신규 + typescript devDep + CORS_ORIGINS env 반영(배포 설정 예외)
- [x] 3. `docker compose up -d --build` 로컬 검증 (backend health / frontend 200 / nginx 80)
  What to do / Must NOT do: (a) **처음 실행 시에만** `docker compose down -v`로 기존(없음) 볼륨 정리(신규 배포·데이터 없음이라 ok; **재실행 시엔 `-v` 지양** — G13/G14, 기존 postgres_data 볼륨이 생긴 후엔 upsert로 재빌드). (b) `docker compose up -d --build` 실행. (c) 검증: 백엔드 health `curl -s http://localhost:8081/api/v1/products` (및 `/auth`는 POST), 프론트 `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/`==200, **nginx 80 라우팅**: `curl -s http://localhost/`(SPA index html) + `curl -s http://localhost/api/v1/products`(backend 응답). (d) `docker compose ps --format "table {{.Name}}\t{{.Status}}"`로 postgres healthy/backend up/frontend up/nginx up. (e) backend 로그 헬스: `docker logs cmall_dd-backend 2>&1 | grep -E "Server starting on port 8081|Failed to connect"`. Must NOT: 80이 다른 서비스와 충돌(비어있음 확인), 5432 재바인딩, 기존 selling_dd 컨테이너 영향.
  Parallelization: Wave 0 | Blocked by: 1,2 | Blocks: 4,5
  References: docker-compose.yml:1-86, Dockerfile:1-36(Go build), Dockerfile.frontend:1-29(node build), vite.config.ts:54(outDir build), nginx.conf:31-51(프록시)
  Acceptance criteria (agent-executable): `curl -s -o /dev/null -w "%{http_code}" http://localhost:80/` == 200; `curl -s -o /dev/null -w "%{http_code}" http://localhost:80/api/v1/products` == 200; `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` == 200; `curl -s -o /dev/null -w "%{http_code}" http://localhost:8081/api/v1/products` == 200; `docker logs cmall_dd-backend 2>&1 | grep "Server starting on port 8081"`; **빌드된 프론트에 localhost가 안 박혔는지 (v2)**: 로컬 `./build`는 컨테이너 빌드라 존재하지 않으므로 **빌드된 이미지 내부를 grep** — `docker run --rm --entrypoint sh cmall_dd-frontend -c 'grep -rl "localhost:8081/api" /usr/share/nginx/html || echo NO_BAKED_URL'`이 NO_BAKED_URL (api.ts가 상대경로 `/api/v1` 기본이라 그럴 것 — G4 방어).
  QA scenarios (tool: bash + docker): happy=4개 URL 모두 200 + backend 로그 기동; failure=backend `Failed to connect` → `.env` DB_PASSWORD/DB 포트(5433) 확인, frontend 빌드 실패(npm ci/tsc) → Dockerfile.frontend 의존성 복원, nginx 502 → backend/frontend 컨테이너명이 nginx.conf upstream과 일치 확인. Evidence .omo/evidence/task-3-cmall-dd-deploy.txt
  Commit: Y | chore(deploy): compose 로컬 스택 빌드·부팅·3경로 라우팅 스모크 통과
- [x] 4. cloudflared 두 번째 터널(80) 기동 + 공개 URL + 외부 헬스
  What to do / Must NOT do: (a) 기존 8080 터널은 유지(`pgrep -af cloudflared`로 각각 구분). (b) 두 번째 프로세스: `nohup cloudflared tunnel --url http://localhost:80 > /tmp/cf-tunnel-80.log 2>&1 &`. (c) 로그(`/tmp/cf-tunnel-80.log`)에서 `<random>.trycloudflare.com` URL 수집 → `.omo/plans/jenkins_github_token.md` 스타일로 이 플랜 하단 저장. (d) 공개 URL 헬스: `curl -s -o /dev/null -w "%{http_code}" https://<tunnel-url>/` == 200, `https://<tunnel-url>/api/v1/products` == 200. **터널 URL은 재시작마다 바뀌는 리스크** — 심층분석 §2 반영 + Todo 7 재등록 스크립트로 완화. Must NOT: 기존 8080 터널 종료, 터널 URL/로그에 시크릿 노출, Named Tunnel(도메인 필요) 시도(후속).
  Parallelization: Wave 1 | Blocked by: 3 | Blocks: 7
  References: cloudflared bin `/home/dduckbeagy/.local/bin/cloudflared`, 기존 터널 로그 `/tmp/cf-tunnel.log`, 포트 80 free(ss 실측)
  Acceptance criteria (agent-executable): `curl -s -o /dev/null -w "%{http_code}" https://<tunnel-url>/` == 200; `https://<tunnel-url>/api/v1/products` == 200; `pgrep -af "tunnel --url http://localhost:80"` 프로세스 감지.
  QA scenarios (tool: bash): happy=공개 URL 200·두 터널 공존; failure=터널 URL 503/502 → backend/nginx 상태 재확인(Todo 3 게이트), cloudflared 로그에 맥락. Evidence .omo/evidence/task-4-cmall-dd-deploy.txt
  Commit: N (터널 프로세스/URL은 커밋 아님; .omo/plans 내 URL 업데이트만)
- [x] 5. 루트 `Jenkinsfile` + compose `test` 서비스
  What to do / Must NOT do: (a) 루트 `Jenkinsfile` declarative — stages: `checkout`(`checkout scm`), `backend_smoke`, `frontend_ci`, `compose_smoke`, `report`. **테스트 실행 경로**: Jenkins 컨테이너에 Go/Node 없으므로 compose `test` 서비스로 실행 — `docker compose run --rm test` (환경변수 `COMPOSE_PROJECT_NAME=cmall_dd_ci`). (b) `docker-compose.yml`에 `test-go`/`test-front` 서비스 추가. **중요(G5): `test-go`는 backend의 런타임 이미지(`alpine:3.19`, Go 없음)를 재사용하면 `go test`가 실패 — 반드시 빌드 툴체인을 가진 이미지로.** 구현 선택지: ① `test-go`에 `build: { context: ., dockerfile: Dockerfile.test }`(멀티스테이지: golang:1.21-alpine 스테이지 + `COPY server/ /app/server` + `WORKDIR /app/server` + `CMD ["go","test","./..."]`) 또는 ② 이미지 `golang:1.21-alpine` + `volumes: - ./server:/app/server` + `working_dir: /app/server` + `command: ["go","test","./..."]`(volumes 마운트로 소스 주입 — selling_dd test 서비스 패턴, 의존성 go.sum 필요). **② mounts 패턴 채택**(빌드 없이 빠름): `test-go: { image: golang:1.21-alpine, working_dir: /app/server, volumes: ["./server:/app/server"], environment: {DB_HOST: postgres?...}, command: ["go","test","./..."] }`. (c) `test-front`: `image: node:20-alpine`, `working_dir: /app`, `volumes: ["./:/app"]`, `command: ["sh","-c","npm ci && npx tsc --noEmit && npm run build"]`. (d) `report` stage: `junit testResults` + `archiveArtifacts` `reports/junit.xml` + `.omo/evidence/**`. Must NOT: 런타임 alpine 이미지에서 `go test` 시도(Go 없음 — G5), Jenkins 컨테이너에 Go/Node 설치, 실 DB·시크릿 로그 노출.
  Parallelization: Wave 1 | Blocked by: 3 | Blocks: 6
  References: selling_dd/Jenkinsfile:12-71(proven declarative + compose run --rm test), selling_dd/docker-compose.yml:39-50(test 서비스 volumes/working_dir/entrypoint 패턴), Dockerfile:2(golang:1.21-alpine)·:21(alpine:3.19 런타임 — Go 없음, G5 근거), go.sum 존재
  Acceptance criteria (agent-executable): `docker compose config`가 `test-go`·`test-front` 포함; `bash -n Jenkinsfile` 통과; `docker compose run --rm test-go`가 `ok  cmall_dd`(또는 테스트 0개지만 파이프라인 성공 종료); `docker compose run --rm test-front`가 `npm run build` 성공으로 종료.
  QA scenarios (tool: bash + docker): happy=test-go/test-front 그린; failure=test-go `exec: "go": not found` → 런타임 이미지 오용(반드시 golang 이미지·mount로 교체), test-front tsc 에러 다수 → tsconfig/타입 수정(Todo 2) 후 npm run build 게이트 폴백, npm ci 네트워크 → registry 재시도. Evidence .omo/evidence/task-5-cmall-dd-deploy.txt
  Commit: Y | ci(Jenkins): 루트 Jenkinsfile + compose test-go(golang)/test-front(node) 서비스
- [x] 6. **Jenkins pipeline JOB 생성 (REST API + crumb + config.xml)** — selling_dd 교훈 반복 금지
  What to do / Must NOT do: (a) **플러그인 전제 확인(G10)**: `curl -s -u admin:***REDACTED*** http://localhost:8080/pluginManager/api/json?depth=1 | python3 -c "import sys,json; pl=json.load(sys.stdin)['plugins']; print([p['shortName'] for p in pl if p['shortName'] in ('github','git','workflow-cps','workflow-job','pipeline-model-definition')])"`가 다섯 포함 빠짐없이 — 빠지면 GitHubPushTrigger가 동작 안 하므로 해당 플러그인 설치 후 계속. (b) Jenkins HTTP API로 crumb 획득(cookie jar): `curl -s -c /tmp/cj -u admin:***REDACTED*** http://localhost:8080/crumbIssuer/api/json` → `crumb`(X-Jenkins-Crumb) + 쿠키. (c) pipeline job `config.xml` 생성(`/tmp/cmall_dd-job.xml`) — `finance_dd-pipeline/config.xml`을 템플릿으로: `<flow-definition>` + `CpsScmFlowDefinition` with scm url `https://github.com/sjh146/cmall_dd.git`(repo **public** 확인 실측 200 — 크레덴셜 불필요), branch `master`, script path `Jenkinsfile`, triggers `GitHubPushTrigger` + optional SCMTrigger. (d) **job 생성**: `curl -s -b /tmp/cj -H "X-Jenkins-Crumb: <crumb>" -X POST --data-binary @/tmp/cmall_dd-job.xml "http://localhost:8080/createItem?name=cmall_dd-pipeline" -H "Content-Type: application/xml"`. (e) **검증(job 실존)**: `curl -s -o /dev/null -w "%{http_code}" -u admin:... http://localhost:8080/job/cmall_dd-pipeline/` == 200; `test -f /home/dduckbeagy/jenkins/jenkins_home/jobs/cmall_dd-pipeline/config.xml`. (f) selling_dd 교훈: **webhook 등록(Todo 7)은 job이 있어야 동작** — job 생성 완료가 첫 게이트. Must NOT: job 미생성 상태로 webhook 등록 진행(실패 반복), 평문 비번을 로그에(명령에서만), 기존 job(finance/survey/selling) 수정, 플러그인 없는 채 GitHubPushTrigger 넣기(G10).
  Parallelization: Wave 2 | Blocked by: 5 | Blocks: 7,8
  References: /home/dduckbeagy/jenkins/jenkins_home/jobs/finance_dd-pipeline/config.xml:1-40(job template: flow-definition, GitHubPushTrigger, CpsScmFlowDefinition, GitSCM url/branch), selling_dd/.omo/plans/jenkins_github_token.md:1-37(cred UI·CLI 패턴), Jenkins admin `***REDACTED***`, repo `https://github.com/sjh146/cmall_dd` public(실측 200)
  Acceptance criteria (agent-executable): `curl -s -o /dev/null -w "%{http_code}" -u admin:***REDACTED*** http://localhost:8080/job/cmall_dd-pipeline/` == 200; `test -f /home/dduckbeagy/jenkins/jenkins_home/jobs/cmall_dd-pipeline/config.xml` true; `ls /home/dduckbeagy/jenkins/jenkins_home/jobs/ | grep cmall_dd`.
  QA scenarios (tool: bash + curl): happy=job 200 + config.xml 생성 + 플러그인 5종 확인; failure=createItem 400/403 → crumb/CSRF 재획득, XML 스키마 오류(`-H Content-Type` 유지), 플러그인 빠지면 → 설치 후 재등록(GitHubPushTrigger 로드 실패 방지). Evidence .omo/evidence/task-6-cmall-dd-deploy.txt
  Commit: N (job config는 jenkins_home 내부, 커밋 대상 아님 — 절차만 산출물)
- [x] 7. GitHub webhook 등록(두 번째 터널) + `scripts/re-register-webhook.sh` 산출물화
  What to do / Must NOT do: (a) Todo 4의 터널 URL로 `https://<tunnel-80-url>/github-webhook/`를 `github.com/sjh146/cmall_dd`에 등록(push 이벤트, content_type json) — selling_dd의 기존 webhook(주소가 8080 터널·같은 yaml일 수 있으므로 repo 분리 주의: cmall_dd는 새 webhook). (a1) **G14 안전망**: Todo 6의 job config.xml에 `SCMTrigger`(주기 `*/5 * * * *` 이하 Poll SCM)를 껴두어 터널 재시작으로 webhook이 죽은 공백 창이어도 push가 최대 5분 안에 감지되도록 — webhook 즉시성 + 폴 보조(dead window 폐쇄). (b) `scripts/re-register-webhook.sh` 작성(멱등, `selling_dd/scripts/re-register-webhook.sh:1-83` 재사용): `GH_REPO=sjh146/cmall_dd` 기본값만 교체 · crate 겹침 없음 · 동일 config.url 있으면 삭제 후 재생성 · 토큰은 `GH_TOKEN` env or `~/.git-credentials`·git remote 런타임 추출(스크립트에 평문 금지). (c) 자동 등록 절차: `GH_REPO=sjh146/cmall_dd ./scripts/re-register-webhook.sh <tunnel-80-url>` 실행 → `REGISTERED webhook id=...` 출력 캡처. (d) 검증: GitHub API `get /repos/sjh146/cmall_dd/hooks`에서 새 webhook id·url 확인 + `curl -s https://<tunnel-url>/github-webhook/`(Jenkins가 git plugin 기본 응답 — 200/405 상관없음, 도달성). Must NOT: selling_dd webhook 삭제/수정, 시크릿(PAT)을 스크립트에 하드코딩, 터널 URL 하드코딩(스크립트가 인자/기록파일 읽기), webhook만으로 주기 보정 없이 두기(G14).
  Parallelization: Wave 2 | Blocked by: 4,6 | Blocks: 8
  References: selling_dd/scripts/re-register-webhook.sh:1-83(proven 멱등 패턴·API 호출·역방향 검증), selling_dd webhook id=663028305(패턴), GitHub API `api.github.com/repos/sjh146/cmall_dd/hooks`
  Acceptance criteria (agent-executable): 스크립트 실행이 `REGISTERED webhook` 출력; **PAT 출처 명시**: 토큰은 반드시 `GH_TOKEN` env 또는 런타임 `~/.git-credentials`에서 추출(스크립트가 하는 방식) — acceptance 커맨드에 `$PAT` 대신 인라인으로 추출 후 사용(namespace의 PAT를 echo/로그 금지): `TOKEN="$(sed -nE 's#https://[^:]+:([^@]+)@github\.com/.*#\1#p' ~/.git-credentials | head -1)"` 후 `curl -s -H "Authorization: token $TOKEN" https://api.github.com/repos/sjh146/cmall_dd/hooks | python3 -c "import sys,json; print([h['id'] for h in json.load(sys.stdin) if str(h['config'].get('url','')).endswith('/github-webhook/')])"`가 id 반환; 재실행 시 "existing ... → 삭제" 및 새 id로 멱등.
  QA scenarios (tool: bash + curl + python3): happy=등록·재등록 멱등; failure=퇴역 URL(터널 변경) → 재등록 스크립트가 새 URL로 upsert, PAT 만료 → "GH_TOKEN 미설정" 안내. Evidence .omo/evidence/task-7-cmall-dd-deploy.txt
  Commit: Y | ci(git): cmall_dd webhook 등록 + scripts/re-register-webhook.sh 멱등 재등록(재사용)
- [x] 8. E2E 검증 — feature 브랜치 push → webhook → Jenkins 그린 → master 머지
  What to do / Must NOT do: (a) `feature/ci-e2e-check` 브랜치 생성·커밋(예: `echo "// ci e2e" >> server/main.go` 후 git add/commit) → `git push origin feature/ci-e2e-check` → 부모 터널에서 Jenkins가 webhook 트리거하는지 확인. (b) 성공 기준: `curl -s -u admin:... "http://localhost:8080/job/cmall_dd-pipeline/lastBuild/api/json"`에서 `building=false`·`result=="SUCCESS"`; 빌드 로그에서 `go test`/`npm run build` 통과. (c) 그린 확인 후 `feature/ci-e2e-check` → `master`로 머지 및 push(`git checkout master && git merge feature/ci-e2e-check && git push origin master`) → master push가 다시 Jenkins 트리거(webhook) — job이 master 브랜치 감시. (d) feature 브랜치 삭제. Must NOT: 그린 전 master 머지(선 그린 후 머지), 실 시크릿/오브젝트 노출이 push 내용에, 다른 project의 webhook·job과 섞기.
  Parallelization: Wave 3 | Blocked by: 7 | Blocks: 9
  References: Jenkins REST API `job/cmall_dd-pipeline/lastBuild/api/json`(result·building), git remote `https://github.com/sjh146/cmall_dd.git`, webhook(Job 7)
  Acceptance criteria (agent-executable): *참조: 빌드가 webhook에 의해 실제 트리거됐는지(G7) — stale/수동 결과로 오인 금지.* `git push origin feature/ci-e2e-check` 후 새 빌드가 쌓일 때까지 잠시 대기 → `curl -s -u admin:***REDACTED*** "http://localhost:8080/job/cmall_dd-pipeline/lastBuild/api/json?tree=number,building,result,cause[shortDescription]"`의 `cause`에 `GitHub` push 원인이 있고 `"result":"SUCCESS"`·`"building":false`; GitHub delivery 확인: `GH_TOKEN="$(sed -nE 's#https://[^:]+:([^@]+)@github\.com/.*#\1#p' ~/.git-credentials | head -1)" curl -s -H "Authorization: token $TOKEN" "https://api.github.com/repos/sjh146/cmall_dd/hooks/<webhook-id>/deliveries"`에 최근 delivery `"status":"OK"`; `git log origin/master -1 --oneline`이 머지 커밋.
  QA scenarios (tool: bash + curl + git): happy=webhook→빌드→SUCCESS→머지~master 재트리거; failure=빌드 실패(레드) → JenkinsConsole 로그 추출 원인(`docker logs cmall_dd-backend`/test 서비스 로그), webhook 미트리거 → job의 GitSCM url·브랜치 확인·re-register-webhook.sh 재실행. Evidence .omo/evidence/task-8-cmall-dd-deploy.txt
  Commit: Y (feature 브랜치 1개 + master 머지 1개 — 요소 1 커밋)
- [x] 9. 전체 게이트 + 심층분석 문서화(Final verification wave와 연계)
  What to do / Must NOT do: (a) 전체 스모크 재실행: `curl` 4경로(80/3000/8081/공개URL) 200 + `docker compose run --rm test-go`/`test-front` 그린. (b) `.env`·시크릿이 커밋/진입 HTTP 응답·로그에 없는지 `git status --porcelain`(untracked로만), `grep -rn "cmall_dd_secret_key_change_in_production\|POSTGRES_PASSWORD=postgres" . --include="*.yml" --include="*.yaml" --include="*.env*"` 결과 없음(must가 아니라 만에 하나 확인). (c) **심층분석 섹션을 플랜 하단에 확정**(아래 `# 심층 분석` 6개: ①포트충돌 ②터널URL 변동 ③Jenkins job 생성 방법 비교 ④시크릿 관리 ⑤테스트 현황 ⑥리스크 요약) — 확정해야 Final wave가 F-플랜 컴플라이언스가 참이 됨. (d) Final verification wave F1-F4 실행. Must NOT: 실 시크릿 로깅, 마이그레이션/백업 손실, 프로덕션 라이브 호출.
  Parallelization: Wave 3 | Blocked by: 6,8 | Blocks: —
  References: 본 플랜 심층분석 섹션 템플릿, Final verification wave(F1-F4), selling_dd/.omo/plans/seo-ml-competition.md:193-256(심층분석 형식 벤치마크)
  Acceptance criteria (agent-executable): Final wave 4개 모두 APPROVE(각각 증거 파일); `git status --porcelain`이 `.env` 등 시크릿을 untracked로만 표시(추적 없음); `curl` 4경로 200.
  QA scenarios (tool: bash + curl): happy=전체 그린+시크릿 미노출+분석 확정; failure=시크릿 grep 히트 → 즉시 제거 재검증(반드시), 분석 미확정 → Final F1 거부. Evidence .omo/evidence/task-9-cmall-dd-deploy.txt
  Commit: Y | docs(deploy): 배포·CI 루프 완료 + 심층분석 확정

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [x] F1. Plan compliance audit — 9 todos·4 waves·가드레일(Must NOT) 전부 미침범 확인; 심층분석 6섹션 포함 여부; selling_dd 교훈(webhook≠job → Todo6 job 실생성) 반영 확인
- [x] F2. Config/code quality review — compose 시크릿 평문 없음, CUSTOM `.env` 참조 일관, 잘못된 VITE_API_URL 제거, 5433 충돌 해결, 미사용 import/테스트 누락 리터널
- [x] F3. Real manual QA — `docker compose up` 후 4경로(80/3000/8081/공개URL) 200 · Jenkins job 200 · webhook 실제 push→SUCCESS (postgres healthy 기준)
- [x] F4. Scope fidelity — 기존 인프라(Jenkins 터널·selling_dd_db 5432·selling_dd 파이프라인) 비파괴 확인, 시크릿 커밋/노출 없음, 443/HTTPS 범위 제외 확인

## Commit strategy
- One atomic commit per todo with code/config change (1,2,3,5,7,8,9 — 4,6은 터널/job이라 N), messages as listed per todo, in order 1→9
- Push to master only after ALL todos + final verification wave pass (remote github.com/sjh146/cmall_dd.git — webhook 트리거는 테스트/수정 루프용)
- Never commit: 루트 `.env`, `server/.env`, `server/.env.docker`, `jenkins_home/jobs/*`(job config 내부), 터널 URL·시크릿이 든 기록, `.omo/evidence/*`(내부), `/tmp/*.xml`
- `.gitignore`에 이미 있음: `server/.env`, `server/.env.docker`, 루트 `.env`(.gitignore:15) — 신규 `.env`는 무시 확인
- `server/Dockerfile`/compose 수정분은 정상 커밋 대상

## Success criteria
- `docker compose up -d --build` 후 backend `https://<tunnel-80-url>/api/v1/products`와 `localhost:8081/api/v1/products` 모두 200, frontend `localhost:3000` 200, nginx `localhost:80` 라우팅 200 → 인터넷 노출(cloudflared 두 번째 터널) 동작
- postgres가 호스트 **5433**에서 기동, `selling_dd_db`(5432) 충돌 없음
- 루트 `.env`(JWT_SECRET·DB_PASSWORD 신규)로 시크릿 분리, 커밋 이력·HTTP 응답·로그에 평문 `postgres`/`cmall_dd_secret_key_change_in_production` 미노출
- `Jenkinsfile` + compose `test-go`/`test-front`로 CI 로컬 그린(Go 빌드/vet + frontend tsc/build)
- **`cmall_dd-pipeline` Jenkins job 실존**(REST API createItem, `localhost:8080/job/cmall_dd-pipeline/` 200) — selling_dd 실패 반복 없음
- feature 브랜치 push → webhook(두 번째 터널 `/github-webhook/`) → Jenkins 빌드 자동 트리거 → SUCCESS → master 머지 후 재트리거
- `scripts/re-register-webhook.sh` 멱등 재등록(터널 URL 변경 시 재실행 가능)
- 보안: 443/HTTPS는 후속(이번 제외), 기존 인프라/파이프라인/5432 비파괴

---

# 심층 분석 (Deep Analysis) — 포트 충돌 · 터널 URL · Jenkins job 생성 · 시크릿 · 테스트 현황

## 1. 포트 충돌 해법 (postgres 5432)

**현황(실측):** 호스트에서 `5432`는 `selling_dd_db`(postgres:16, healthy)가 점유(ss -tlnp 5432 LISTEN). `8080`은 Jenkins. `80/443/3000/8081`은 비어있음.

**해법:** cmall_dd postgres는 컨테이너 내부 포트 5432를 유지하고 **호스트 바인딩만 5433**으로 (`"5433:5432"`). backend는 같은 docker network에서 `postgres:5432`(컨테이너 DNS)로 접근하므로 `DB_PORT=5432` 그대로 — 호스트 매핑과 무관. 이렇게 하면 backend·frontend·nginx·postgres가 모두 내부 `cmall_dd-network` 브리지로 통신하고, 호스트 5433은 디버그/psql 용도. **대안 비교:** ① 내부 네트워크 전용(호스트 포트 미공개)도 가능하지만 cmall_dd docker-compose는 이미 `ports` 연결 패턴 — 5433이 최소 침습. ② selling_dd postgres를 5433으로 옮기기: **절대 금지**(기존 인프라 비파괴). → 5433 채택.

## 2. 터널 URL 변동 리스크와 대안

**리스크:** cloudflared **quick tunnel**은 `https://<random>.trycloudflare.com` 형태로 **프로세스 재시작마다 URL이 바뀜**. Jenkins webhook은 `{URL}/github-webhook/`에 등록되므로 터널이 죽었다 살아나면 webhook이 깨져 push가 트리거되지 않는다.

**대안:**
1. **재등록 스크립트** `scripts/re-register-webhook.sh`(멱등) — 터널 재기동 후 새 URL로 webhook upsert(selling_dd 패턴 재사용). 이번 범위에서 채택.
2. **Named Tunnel + 고정 도메인** — Cloudflare 계정에 도메인 소유 필요. 무료 없이 빠르면 후속 이슈로 기록.
3. **Poll SCM** — webhook 대신 주기(1분) `SCMTrigger`(finance_dd-pipeline config.xml에 이미 `* * * * *` 예시). webhook 즉시성은 포기하나 URL 무관. 최후 대안으로 명시.

이번엔 quick tunnel + 재등록 스크립트 + **Poll SCM 안전망**(G14: job config에 `SCMTrigger` 주기 폴을 함께 넣어, 터널 재시작으로 webhook이 죽은 공백 창(dead window)이어도 push를 최대 5분 안에 감지)으로 진행. **Jenkins 8080 터널과 cmall_dd 80 터널은 별도 프로세스**(pgrep으로 구분), 5432 인프라와 함께 유지.

## 3. Jenkins pipeline job 생성 방법 비교 (selling_dd 실패 반복 방지)

**핵심 교훈:** selling_dd는 Jenkinsfile+webhook까지 등록했지만 **실제 Jenkins JOB을 만들지 않아 push가 와도 트리거할 job이 없었다**(`~/jenkins/jenkins_home/jobs/`에 selling_dd job 부재). webhook 등록 ≠ job 생성. cmall_dd는 **job 실생성이 최우선 게이트**(Todo 6).

**방법 비교:**
| 방법 | 절차 | 장점 | 단점 | 판정 |
|---|---|---|---|---|
| **REST API + config.xml** (`createItem?name=...` + XML) | crumb→쿠키→`--data-binary @job.xml`→`createItem` | 완전 자동화, 스크립트화 가능, 기존 finance_dd config.xml 템플릿 재사용 | XML 스키마/플러그인 버전 민감 | **채택** — 자동 재현 가능 |
| Multibranch pipeline | UI/API로 `org.jenkinsci.plugins.workflow.multibranch` | 브랜치별 자동 | 복잡, 추가 플러그인, 단일 Jenkinsfile 감시면 과함 | 대안(후속) |
| Jenkins CLI `create-job` | `/tmp/jenkins-cli.jar -auth admin:... create-job cmall_dd-pipeline < config.xml` | CLI 단순 | crumb 없이도 되지만 csrf 규칙 변화 | 병행가능(대체경로) |

**핵심 detail:** job config의 `GitSCM`에 `https://github.com/sjh146/cmall_dd.git`(master 브랜치, **`./Jenkinsfile` script path**), triggers에 `GitHubPushTrigger`(github 플러그인) + `SCMTrigger` 주기 폴(G14 안전망). repo는 **public(실측 200)**이라 checkout 크레덴셜 불필요. **플러그인 전제**: `github`, `git`, `workflow-cps`, `workflow-job`, `pipeline-model-definition` 5종이 해당 인스턴스에 설치돼 있어야 config.xml이 로드되고 GitHubPushTrigger가 동작 — Todo 6에서 `pluginManager/api/json`으로 전제 확인. webhook은 이 job이 존재해야 의미. 생성 후 반드시 `/job/cmall_dd-pipeline/` 200 + jenkins_home/jobs 하위 config.xml 존재로 **job 실존 검증**.

## 4. 시크릿 관리

**현황:** docker-compose에 `DB_PASSWORD=postgres`(16행), `JWT_SECRET=cmall_dd_secret_key_change_in_production`(19행), `POSTGRES_PASSWORD=postgres`(52행) 하드코딩. server/.env.example은 같은 값. git remote에 PAT 노출 없음(`~/.git-credentials` chmod 600 — selling_dd에서 정리된 패턴).

**조치:** ① 루트 `.env`(gitignore)에 신규 JWT_SECRET(`openssl rand -hex 32`)·DB/POSTGRES 비밀·ADMIN_EMAIL, compose는 `env_file: - .env` + `${VAR:?}` 참조. ② CI(Jenkins)는 같은 `.env`를 compose test 서비스에 전달(레포는 시크릿 없음). ③ 커밋 `check-ignore` 검증 + Final F4에서 grep로 평문 미노출 확정. **크레덴셜 for CI push**: `github-token`은 이미 Jenkins credential store에 있음(selling_dd가 등록한 5종) — cmall_dd도 같은 전역 크레덴셜 사용 가능. PAT는 `~/.git-credentials`(러타임 추출)로, 스크립트에 하드코딩 금지.

**잔존 폴백 (사전 존재, 범위 외 — Todo 9 기록):** `server/internal/handlers/auth.go:28`·`middleware.go:33,75`에 사전 커밋(4901a17)된 JWT 폴백 `secretKey = "cmall_dd_secret_key_change_in_production"`(JWT_SECRET 미설정 시에만 사용). compose 21행 `JWT_SECRET=${JWT_SECRET:?}` fail-fast로 시크릿 없으면 기동 거부 → 폴백 경로 실행 불가(실제 영향 없음). 가드레일(Must NOT: 핸들러 로직 변경, 제품 코드 수정 금지)상 수정하지 않음 — 후속 작업 이슈 후보.

## 5. 테스트 현황 (실측)

- **Go backend**: `server/`에 `*_test.go` **0개**. 호스트에 **go 미설치**(`go: command not found`) → 로컬 `go test` 불가. → Docker builder 이미지(golang:1.21-alpine, Dockerfile)로 `go test ./...`(테스트 없어도 빌드·vet 성공 = 스모크). Backend는 `database.CreateTables`로 `CREATE TABLE IF NOT EXISTS` auto-schema(server/internal/database/*.go), `pgvector` 확장(임시 실행에서 real vector 미사용 가능성 확인불가라 smoke).
- **Frontend**: `package.json:55-58`에 build만(dev/test 스크립트 없음), devDeps에 **typescript 없음**(tab: `@types/node`, `@vitejs/plugin-react-swc`, `vite`만), **`tsconfig.json` 없음(실측)** → `typescript`를 `-D`로 추가 **+ 루트 `tsconfig.json` 신규 생성 후** `npx tsc --noEmit`(타입체크) + `npm run build` 스모크. package-lock.json은 존재(npm ci 안전).
- **test-go 경로 함정(G5)**: backend Dockerfile의 런타임 스테이지는 `alpine:3.19`(Dockerfile:21)라 Go 툴체인 없음 → `test-go`는 반드시 `golang:1.21-alpine` 이미지 + 소스 볼륨 마운트(또는 builder 스테이지)로 실행해야 `go test`가 됨.
- **테스트 전략 결정**: 소멸 스모크(빌드 성공 + 헬스체크 + tsc) — INSTRUCTIONS C요구대로 실측 기반. TDD 미적용(신규 기능 없음).

## 6. 리스크/완화 요약

| 위험 | 심각도 | 완화 |
|---|---|---|
| webhook만 만들고 Jenkins job 미생성 → push 무 트리거 (selling_dd 반복) | 높음 | **job 실생성 게이트(Todo 6) + URL 200 검증**, webhook는 job 이후(Todo 7) |
| 터널 URL 변동 → webhook 단절 | 중 | 재등록 스크립트, (후속)Named Tunnel, Poll SCM 대안 |
| 시크릿 평문 커밋/노출 | 높음 | .env gitignore·`check-ignore`, `${VAR}` 참조, Final F4 grep, PAT 러타임 추출 |
| 5432 충돌 | 높음 | postgres 호스트 5433(내부 5432 유지), selling_dd 비파괴 |
| Jenkins 컨테이너에 Go/Node 없음 | 중 | compose test-go/test-front 서비스(docker-in-docker) |
| 기존 인프라(8080 터널·selling_dd 파이프라인) 건드림 | 높음 | scope 경계 명시, pgrep 분리, 절대 수정 금지 |

---

# 런타임 상태 기록 (Runtime registry)

> 터널 URL·job·webhook 등 런타임 산출물 기록. **커밋 대상 아님** (터널 URL은 재시작 시 변경).

## cmall_dd 80 터널 (두 번째 터널)

- 실행 명령: `nohup cloudflared tunnel --url http://localhost:80 > /tmp/cf-tunnel-80.log 2>&1 &`
- 공개 URL: **https://travesti-patent-perfect-genes.trycloudflare.com** (Todo 4, 2026-08-09 실측)
- 헬스: `/` 200, `/api/v1/products` 200
- 기존 8080 터널: `https://currently-heights-participated-chemicals.trycloudflare.com` (유지, 절대 종료 금지)
- **webhook 엔드포인트: `https://currently-heights-participated-chemicals.trycloudflare.com/github-webhook/`** (Jenkins 8080 터널 — webhook은 Jenkins에 도달해야 하므로 80 터널 아님. 80 터널은 nginx(제품)라 `/github-webhook/`가 SPA HTML을 반환해 Jenkins 도달 불가 — Todo 9 실측, 잘못 등록된 80 터널 webhook #663307378 삭제함)
- 재등록: `GH_REPO=sjh146/cmall_dd ./scripts/re-register-webhook.sh https://currently-heights-participated-chemicals.trycloudflare.com`
- webhook id: **663321472** (2026-08-09 재등록 — auto-detect 수정 후 멱등 재실행으로 갱신; 이전 663307951은 동일 URL이라 삭제·재생성)
