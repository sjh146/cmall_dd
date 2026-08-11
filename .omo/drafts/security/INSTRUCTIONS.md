# INSTRUCTIONS — cmall_dd 배포 + Jenkins/Docker 테스트-수정 루프 계획서

당신은 **Prometheus - Plan Builder**입니다. 아래 지시사항을 그대로 수행하고, **질문하지 말고 바로 진행**하세요. 필요한 파일을 직접 읽고 조사하세요. 되묻지 마세요.

## 0. 작업 목표

`/home/dduckbeagy/cmall_dd` (DevMall: 소프트웨어/이북 마켓플레이스 웹서버)를 **인터넷에 배포**하고, **git webhook + Jenkins + docker 기반 테스트/수정 루프**를 구축하기 위한 **실행 가능한 계획서(plan) + 심층 분석**을 작성하라. 이후 승인 시 실행 단계로 넘어간다.

최종 산출물: `.omo/plans/cmall-dd-deploy.md` (기존 `.omo/plans/seo-ml-competition.md` 형식 준수: TL;DR, Scope, Verification strategy, Execution strategy(waves/todos), Dependency matrix, Commit strategy, Success criteria + 심층분석 섹션)

## 1. 프로젝트/인프라 현황 (직접 확인하고 이해하라)

### cmall_dd (이미 /home/dduckbeagy/cmall_dd에 클론됨, master)
- **스택**: Go+Gin 백엔드(`server/`, 포트 8081) / Vite+React+TS 프론트(`src/`, 컨테이너 내 80) / PostgreSQL 16 + pgvector / Nginx 리버스 프록시(80/443)
- `docker-compose.yml` 서비스: backend(8081) / frontend(3000→80) / postgres(5432) / nginx(80/443). `Dockerfile`(Go 빌드), `Dockerfile.frontend`, `nginx.conf` 존재
- 보안 약점(계획에 반영): compose에 `DB_PASSWORD=postgres`, `JWT_SECRET=cmall_dd_secret_key_change_in_production` 하드코딩 — **.env + Jenkins credential로 분리 필요**
- `server/ENV_SETUP.md`에 .env 가이드 존재 (DB_HOST/PORT/USER/PASSWORD/NAME, PORT, CORS_ORIGINS)
- 깃 이력은 전부 로컬 커밋 상태 (master, remote는 github.com/sjh146/cmall_dd)

### 호스트 인프라 (실측 확인됨)
- **포트 사용 중**: 8080(Jenkins), 5432(selling_dd postgres `selling_dd_db`, 실행 중·healthy) → **cmall_dd postgres는 5432를 호스트에 바인딩하면 충돌** (5433으로 변경 or 내부 네트워크 전용)
- **비어있는 포트**: 80, 443, 3000, 8081
- **Jenkins**: `jenkins` 컨테이너 Up, `http://localhost:8080` 로그인 200, 관리자 `admin:***REDACTED***`, 크레덴셜 스토어에 `github-token`(PAT) 등 5종 등록됨. 기존 job: finance_dd-pipeline, survey-auto-extensions
- **cloudflared**: Jenkins용 quick tunnel 실행 중 (`https://currently-heights-participated-chemicals.trycloudflare.com` → 8080, 200 확인). **cmall_dd용으로 두 번째 터널 프로세스 필요** (예: `cloudflared tunnel --url http://localhost:80`)
- **GitHub webhook 패턴**: selling_dd에 webhook id=663028305 등록됨(`{터널URL}/github-webhook/`, push 이벤트)

### ⚠️ selling_dd 교훈 (이번 계획에 반드시 반영)
selling_dd는 Jenkinsfile+webhook까지 만들었지만 **Jenkins JOB을 실제로 생성하지 않아** push가 와도 트리거될 job이 없었다(현재 `~/jenkins/jenkins_home/jobs/`에 selling_dd job 없음). **cmall_dd 계획은 "Jenkins job 생성(실제 REST API/CLI로) + push→빌드→그린 E2E 검증"을 명시적 todo로 포함**해야 한다. webhook 등록 ≠ job 생성.

## 2. 계획서 포함 내용 (Must have)

### A. 배포 (인터넷 노출)
- docker compose 수정: postgres 호스트 포트 충돌 해결(5433 or 내부 전용), `VITE_API_URL`/`CORS_ORIGINS`를 공개 URL로 (프론트 빌드 시 주입 방식 결정 — Dockerfile.frontend/build 인자 or nginx proxy), 시크릿(.env + Jenkins credential 참조, 커밋 금지)
- `docker compose up -d --build` → 로컬 검증 (backend /api/v1 health, frontend 200, nginx 80 라우팅)
- cloudflared 두 번째 터널로 공개 URL 확보 + 터널 재시작 시 URL 변동 리스크/대안(재등록 스크립트, Named Tunnel 후속)
- nginx 80/443: 80은 터널이 받고 443은 (인증서 없으면) 후속 — 이번 범위 결정 명시

### B. Jenkins + git webhook 테스트/수정 루프
- 루트 `Jenkinsfile`: checkout → 테스트(Go 단위테스트 `go test ./...`, 프론트 `npm ci && tsc --noEmit && vite build`) → docker compose smoke → 리포트. **Jenkins 컨테이너에 Go/Node 없음 → 테스트 실행 경로 결정**(compose `test` 서비스 or docker-in-docker — selling_dd 패턴 참고: `docker compose run --rm test`)
- **Jenkins JOB 생성 (핵심)**: REST API로 pipeline job 생성 방법(config.xml 업로드 or multibranch) 명시 + 인증(admin 크레덴셜, crumb) — selling_dd 실패 반복 금지
- GitHub webhook 등록(두 번째 터널 URL로 `/github-webhook/`) + **재등록 스크립트 `scripts/re-register-webhook.sh`** (멱등, selling_dd에도 재사용 가능하게)
- E2E 검증: feature 브랜치 push → webhook → Jenkins 빌드 트리거 → 그린 확인 → master 머지 (또는 master push 직접)

### C. 테스트 전략 (현재 테스트 상태 먼저 조사)
- `server/`에 Go 테스트 있는지 확인(`go test ./...` 실행해보고 결과 반영), 프론트 테스트/빌드 체크
- 없는 부분은 최소 스모크(빌드 성공 + 헬스체크)로 계획

### D. 가드레일 (Must NOT have)
- 기존 인프라(젠킨스 터널, selling_dd postgres, selling_dd 파이프라인) 비파괴
- 시크릿(JWT_SECRET, DB_PASSWORD, PAT) 커밋 금지
- 5432 재바인딩 금지(충돌)
- 이번 산출물은 **계획서+심층분석만** (구현은 승인 후)

## 3. 형식 (seo-ml-competition.md 템플릿 준수)
- TL;DR(사람용+machine용), Scope(Must have/Must NOT), Verification strategy(명령어 명시), Execution strategy(waves+dependency matrix), Todos(구현+테스트=1, What to do/References/Acceptance(정확한 명령어)/QA/Commit), Final verification wave, Commit strategy, Success criteria, **심층분석**(포트 충돌 해법, 터널 URL 변동 리스크, Jenkins job 생성 방법 비교, 시크릿 관리, 테스트 현황)

## 4. 제약
- 저장 위치: `.omo/plans/cmall-dd-deploy.md` (한국어)
- 참조 줄 번호는 실제 확인한 것만
- Acceptance는 실행 가능한 명령어로 (docker, curl, jenkins REST API 예시 포함)
- 완료 후 최종 응답에 파일 경로 + 요약(투두 수/웨이브 수) 알려줘

지금 바로 진행해. 질문하지 마.
