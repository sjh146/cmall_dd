#!/usr/bin/env bash
# =============================================================================
# re-register-webhook.sh — GitHub → Jenkins webhook 멱등 재등록 (cmall_dd Todo 7 산출물)
#
# cloudflared quick tunnel URL은 재시작 때마다 바뀌므로, 터널 재기동 후 이
# 스크립트로 {tunnel-url}/github-webhook/ 를 GitHub 저장소에 upsert한다.
# 같은 config.url 을 가진 기존 webhook이 있으면 삭제 후 재생성(멱등).
#
# Usage:
#   ./scripts/re-register-webhook.sh [tunnel-url]
#   GH_REPO=sjh146/cmall_dd GH_TOKEN=<pat> ./scripts/re-register-webhook.sh
#
# - tunnel-url 인자 생략 시 .omo/plans/cmall-dd-deploy.md 의 런타임 상태 기록
#   (Runtime registry) 섹션에서 trycloudflare URL을 자동 탐지한다.
# - GH_TOKEN 미설정 시 ~/.git-credentials 또는 git remote origin URL의 토큰을
#   런타임에 추출한다 (스크립트에 시크릿을 하드코딩하지 않는다).
# =============================================================================
set -euo pipefail

REPO="${GH_REPO:-sjh146/cmall_dd}"
TOKEN="${GH_TOKEN:-}"
TUNNEL_URL="${1:-}"

# --- token: env → ~/.git-credentials → git remote fallback (런타임 추출, 출력 금지) ---
if [[ -z "$TOKEN" && -f "$HOME/.git-credentials" ]]; then
  TOKEN="$(sed -nE 's#https://[^:]+:([^@]+)@github\.com[^[:space:]]*#\1#p' "$HOME/.git-credentials" | head -1 || true)"
fi
if [[ -z "$TOKEN" ]]; then
  REMOTE="$(git config --get remote.origin.url || true)"
  TOKEN="$(printf '%s' "$REMOTE" | sed -nE 's#https?://[^:]+:([^@]+)@github\.com/.*#\1#p' || true)"
fi
if [[ -z "$TOKEN" ]]; then
  echo "ERROR: GH_TOKEN 미설정 + ~/.git-credentials/git remote에 토큰 없음 (GH_TOKEN=... 로 실행)" >&2
  exit 1
fi

# --- tunnel url: 인자 → 계획서 런타임 레지스트리 → 오류 ---------------------------------
# 자동 탐지는 런타임 레지스트리의 "webhook 엔드포인트" 라인을 우선 사용한다
# (80 터널은 nginx(제품)라 webhook 도달 불가 — 반드시 Jenkins 8080 터널이어야 함,
#  Todo 9 실측: 잘못 등록된 80 터널 webhook #663307378 삭제).
if [[ -z "$TUNNEL_URL" ]]; then
  PLAN_FILE="$(git rev-parse --show-toplevel 2>/dev/null || echo .)/.omo/plans/cmall-dd-deploy.md"
  TUNNEL_URL="$(sed -nE 's#.*webhook 엔드포인트: `?https://([a-z0-9-]+\.trycloudflare\.com)/github-webhook/.*#https://\1#p' "$PLAN_FILE" 2>/dev/null | head -1 || true)"
fi
if [[ -z "$TUNNEL_URL" ]]; then
  PLAN_FILE="$(git rev-parse --show-toplevel 2>/dev/null || echo .)/.omo/plans/cmall-dd-deploy.md"
  TUNNEL_URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$PLAN_FILE" 2>/dev/null | head -1 || true)"
fi
if [[ -z "$TUNNEL_URL" ]]; then
  echo "ERROR: 터널 URL을 찾지 못함 — 인자로 전달하거나 .omo/plans/cmall-dd-deploy.md 런타임 레지스트리 갱신 필요" >&2
  exit 1
fi

WEBHOOK_URL="${TUNNEL_URL%/}/github-webhook/"
API="https://api.github.com/repos/${REPO}/hooks"
AUTH="Authorization: token ${TOKEN}"

echo "repo:        ${REPO}"
echo "webhook url: ${WEBHOOK_URL}"

# --- 기존 webhook 탐색 (config.url == WEBHOOK_URL) → 삭제 (멱등) ---------------
# WEBHOOK_URL은 export로 전달해 python 인라인에 셸 보간이 없게 한다.
# (주의: `VAR=x curl ... | python3` 형태는 VAR이 python3까지 전달되지 않아
#  os.environ 조회가 실패하므로, 반드시 export 후 별도 실행)
export WEBHOOK_URL
EXISTING_ID="$(curl -s -H "$AUTH" "$API" | python3 -c '
import sys, json, os
try:
    hooks = json.load(sys.stdin)
except Exception:
    sys.exit(0)
target = os.environ["WEBHOOK_URL"]
for h in hooks:
    if isinstance(h, dict) and h.get("config", {}).get("url") == target:
        print(h["id"])
        break
' 2>/dev/null || true)"

if [[ -n "$EXISTING_ID" ]]; then
  echo "existing webhook #${EXISTING_ID} (동일 URL) → 삭제"
  curl -s -X DELETE -H "$AUTH" "$API/${EXISTING_ID}"
fi

# --- webhook 생성 (push 이벤트, content_type=json) ------------------------------
PAYLOAD="$(printf '{"name":"web","active":true,"events":["push"],"config":{"url":"%s","content_type":"json"}}' "$WEBHOOK_URL")"
RESP="$(curl -s -X POST -H "$AUTH" -H "Content-Type: application/json" -d "$PAYLOAD" "$API")"

echo "$RESP" | python3 -c '
import sys, json
d = json.load(sys.stdin)
if d.get("id"):
    print("REGISTERED webhook id=%s url=%s events=%s" % (d["id"], d["config"]["url"], d.get("events")))
else:
    print("FAILED: %s" % json.dumps(d, ensure_ascii=False))
    sys.exit(1)
'
