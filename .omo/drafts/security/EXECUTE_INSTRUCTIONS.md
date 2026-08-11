# EXECUTE — cmall-dd-deploy 계획서 구현 지시

당신은 **Sisyphus - ultraworker**입니다. 아래 지시를 그대로 수행하고, **질문하지 말고 바로 진행**하세요. 되묻지 마세요.

## 1. 작업

`/home/dduckbeagy/cmall_dd` 저장소에서 **`.omo/plans/cmall-dd-deploy.md` (v2)** 계획서를 **Todo 1 → Todo 9 순서로 전부 구현**하라. 각 Todo는 What to do / Acceptance(정확한 명령어) / QA / Evidence / Commit 메시지를 포함한다. **구현+테스트=1 todo**. 각 Todo 완료 시:
1. Acceptance 명령어 실제 실행 → 통과 확인
2. 증거 파일 `.omo/evidence/task-<N>-cmall-dd-deploy.txt` 작성
3. 계획서 Commit 메시지로 **로컬 커밋 1개** (Todo 4·6은 Commit N — 터널/job은 커밋 대상 아님)
4. 계획서 해당 todo 체크박스 `[x]` 갱신

## 2. 이미 완료된 인프라 (검증만 하고 진행)

- **Jenkins**: `jenkins` 컨테이너 Up, `http://localhost:8080` 200, admin `admin:***REDACTED***`, 크레덴셜 5종 등록됨
- **8080 터널(기존)**: 실행 중 (`https://currently-heights-participated-chemicals.trycloudflare.com`) — **절대 종료 금지**
- **selling_dd postgres**: 5432 점유 중 — cmall_dd postgres는 **5433** (계획대로)
- **포트**: 80/443/3000/8081 비어있음 (실측)
- **`selling_dd/scripts/re-register-webhook.sh` 실존** — Todo 7에서 참조/재사용 (내용은 직접 읽고 이해하라)
- **Strix 1.5.1** 설치됨 (`~/.strix/bin/strix`) — 배포 완료 후 Hermes가 보안테스트 수행 (당신 범위 아님)

## 3. 필수 실행 환경

- Go/Node는 호스트에 미설치 — 빌드/테스트는 전부 **docker compose** 경로 (계획서 명령 그대로)
- `docker compose`는 `/home/dduckbeagy/cmall_dd`에서 실행
- cloudflared: `/home/dduckbeagy/.local/bin/cloudflared` (또는 PATH)
- Jenkins REST API: crumb + cookie jar 필요 (계획서 참조 — `curl -c /tmp/cj ...` 패턴)
- JWT_SECRET/DB_PASSWORD 생성: `openssl rand -hex 32`

## 4. 가드레일 (위반 금지)

- **기존 인프라 비파괴**: 8080 터널, selling_dd_db(5432), selling_dd/finance_dd Jenkins job — 절대 건드리지 말 것
- **5432 재바인딩 금지** (postgres는 5433만)
- 시크릿(JWT_SECRET/DB_PASSWORD/PAT) **커밋·로그·HTTP 응답 노출 금지**; PAT는 `~/.git-credentials` 런타임 추출만
- 443/HTTPS 이번 범위 제외
- 제품 로직(Go 핸들러/프론트 기능) 수정 금지 — CORS env 반영(main.go)만 계획서 명시 예외
- webhook 등록은 **job 생성(Todo 6) 이후** (Todo 7) — selling_dd 교훈
- Todo 3의 `docker compose down -v`는 **최초 1회만** — 그 후엔 절대 `-v` 금지

## 5. 완료 기준

- `docker compose ps`: postgres healthy/backend up/frontend up/nginx up
- 4경로 200: `localhost:80`, `localhost:80/api/v1/products`, `localhost:3000`, `localhost:8081/api/v1/products`
- **공개 URL 200** (두 번째 터널, Todo 4) — URL을 `.omo/plans/cmall-dd-deploy.md`에 기록
- **`cmall_dd-pipeline` Jenkins job 실존** (`localhost:8080/job/cmall_dd-pipeline/` 200) — Todo 6 게이트
- webhook 등록 + `scripts/re-register-webhook.sh` 산출물 (Todo 7)
- E2E: feature 브랜치 push → webhook → Jenkins 빌드 SUCCESS → master 머지 (Todo 8)
- 전체 게이트 + 심층분석 문서화 (Todo 9, Final F1-F4)
- 커밋 push: `git push origin master` (credential store 인증 — 그대로)

## 6. 완료 후 최종 응답

각 todo 상태 요약 + 테스트/검증 결과 + push 결과 + 공개 URL + 남은 리스크. (Strix 보안테스트는 Hermes가 별도 수행.)

지금 바로 시작해. 질문하지 마.
