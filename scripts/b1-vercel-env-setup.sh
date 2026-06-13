#!/usr/bin/env bash
# B1 Task 11 — wire Supabase + origin allow-list into Vercel env.
#
# Prerequisites:
#   - npx vercel login   OR   export VERCEL_TOKEN=<personal-access-token>
#   - export SUPABASE_SERVICE_ROLE_KEY=<from Supabase dashboard → Settings → API>
#
# Usage (from repo root):
#   export SUPABASE_SERVICE_ROLE_KEY='eyJ...'   # no leading/trailing spaces
#   ./scripts/b1-vercel-env-setup.sh
#
# Optional:
#   REMOVE_LEGACY_VITE_KEY=1  — also delete VITE_ANTHROPIC_API_KEY from preview+production
#   REDEPLOY=1                — trigger a production redeploy after env changes

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TEAM_SLUG="${VERCEL_TEAM_SLUG:-blackhebrewisraelis-projects}"
TEAM_ID="${VERCEL_TEAM_ID:-team_PEb41JdFtiVB6me1YMSNrpQC}"
PROJECT_NAME="${VERCEL_PROJECT_NAME:-deutsch-app}"
PROJECT_ID="${VERCEL_PROJECT_ID:-prj_SXWLzEnoTRHWVgi4Rw0FNyWC7aqu}"
SUPABASE_URL="${SUPABASE_URL:-https://xcnnlczvxmuwcqwychox.supabase.co}"
ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-https://deutsch-app-dusky.vercel.app}"

VERCEL="${VERCEL_CMD:-npx vercel --non-interactive}"

trim() {
  local v="$1"
  v="${v#"${v%%[![:space:]]*}"}"
  v="${v%"${v##*[![:space:]]}"}"
  printf '%s' "$v"
}

get_vercel_token() {
  if [[ -n "${VERCEL_TOKEN:-}" ]]; then
    printf '%s' "$VERCEL_TOKEN"
    return 0
  fi
  local auth_file
  for auth_file in \
    "${VERCEL_AUTH_FILE:-}" \
    "${HOME}/.local/share/com.vercel.cli/auth.json" \
    "${HOME}/Library/Application Support/com.vercel.cli/auth.json"; do
    [[ -n "$auth_file" && -f "$auth_file" ]] || continue
    python3 -c "import json; print(json.load(open('${auth_file}'))['token'])" && return 0
  done
  return 1
}

if ! get_vercel_token >/dev/null 2>&1 && ! $VERCEL whoami >/dev/null 2>&1; then
  echo "error: not logged in. Run: npx vercel login  OR  export VERCEL_TOKEN=..." >&2
  exit 1
fi

if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "error: SUPABASE_SERVICE_ROLE_KEY is required." >&2
  echo "  Do NOT create a new key named 'service_role' — that name is reserved." >&2
  echo "  Instead, open Settings → API Keys:" >&2
  echo "    https://supabase.com/dashboard/project/xcnnlczvxmuwcqwychox/settings/api-keys" >&2
  echo "  Option A (easiest): tab 'Legacy anon, service_role API keys' → Reveal service_role → Copy." >&2
  echo "  Option B: tab 'Publishable and secret API keys' → Create secret key named e.g. vercel_b1 → Copy sb_secret_..." >&2
  echo "  Then: export SUPABASE_SERVICE_ROLE_KEY='...'" >&2
  exit 1
fi

SUPABASE_SERVICE_ROLE_KEY="$(trim "$SUPABASE_SERVICE_ROLE_KEY")"

if [[ ! -d .vercel ]]; then
  echo "→ linking Vercel project ${PROJECT_NAME} (team ${TEAM_SLUG})"
  $VERCEL link --yes --project "$PROJECT_NAME" --scope "$TEAM_SLUG"
fi

# Preview env adds hang on a Git-branch prompt in Vercel CLI 54 even with --force.
# Use the REST API (upsert, all preview branches) instead.
upsert_preview_api() {
  local name="$1"
  local value="$2"
  local type="${3:-encrypted}"
  local token
  token="$(get_vercel_token)"
  echo "→ ${name} (preview, via API)"
  UPSERT_KEY="$name" UPSERT_VALUE="$value" UPSERT_TYPE="$type" UPSERT_TOKEN="$token" \
    UPSERT_PROJECT="$PROJECT_ID" UPSERT_TEAM="$TEAM_ID" python3 <<'PY'
import json, os, sys, urllib.error, urllib.request

key = os.environ["UPSERT_KEY"]
value = os.environ["UPSERT_VALUE"]
typ = os.environ["UPSERT_TYPE"]
token = os.environ["UPSERT_TOKEN"]
project = os.environ["UPSERT_PROJECT"]
team = os.environ["UPSERT_TEAM"]

url = f"https://api.vercel.com/v10/projects/{project}/env?teamId={team}&upsert=true"
body = json.dumps({"key": key, "value": value, "type": typ, "target": ["preview"]}).encode()
req = urllib.request.Request(
    url,
    data=body,
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    method="POST",
)
try:
    with urllib.request.urlopen(req) as resp:
        data = json.load(resp)
except urllib.error.HTTPError as e:
    print(e.read().decode(), file=sys.stderr)
    sys.exit(1)
created = data.get("created") or data.get("updated") or {}
print(f"✅  {created.get('key', key)} (preview)")
PY
}

# CLI upsert for production / development (no branch prompt).
upsert_cli() {
  local name="$1"
  local value="$2"
  local sensitive_flag="$3"
  shift 3
  local targets=("$@")

  for target in "${targets[@]}"; do
    echo "→ ${name} (${target})"
    $VERCEL env rm "$name" "$target" --yes 2>/dev/null || true
    $VERCEL env add "$name" "$target" --value "$value" --yes --force $sensitive_flag
  done
}

echo "→ setting SUPABASE_URL"
upsert_cli SUPABASE_URL "$SUPABASE_URL" "" production development
upsert_preview_api SUPABASE_URL "$SUPABASE_URL" encrypted

echo "→ setting SUPABASE_SERVICE_ROLE_KEY"
upsert_cli SUPABASE_SERVICE_ROLE_KEY "$SUPABASE_SERVICE_ROLE_KEY" --sensitive production
upsert_cli SUPABASE_SERVICE_ROLE_KEY "$SUPABASE_SERVICE_ROLE_KEY" --no-sensitive development
upsert_preview_api SUPABASE_SERVICE_ROLE_KEY "$SUPABASE_SERVICE_ROLE_KEY" sensitive

echo "→ setting ALLOWED_ORIGINS (production only)"
upsert_cli ALLOWED_ORIGINS "$ALLOWED_ORIGINS" "" production

if [[ "${REMOVE_LEGACY_VITE_KEY:-}" == "1" ]]; then
  echo "→ removing legacy VITE_ANTHROPIC_API_KEY from preview + production"
  $VERCEL env rm VITE_ANTHROPIC_API_KEY preview --yes 2>/dev/null || true
  $VERCEL env rm VITE_ANTHROPIC_API_KEY production --yes 2>/dev/null || true
fi

cat <<EOF

✓ Vercel env updated.

Next:
  1. Append to your local .env (vercel dev cannot pull sensitive values):
       SUPABASE_URL=${SUPABASE_URL}
       SUPABASE_SERVICE_ROLE_KEY=<same value you exported>

  2. Redeploy production so functions pick up the new vars:
       npx vercel redeploy deutsch-app-dusky.vercel.app --target production

  3. Verify:
       ./scripts/verify-b1-production.sh

Supabase dashboard (one-time, for B2):
  Authentication → Sign In / Up → enable Anonymous sign-ins
  https://supabase.com/dashboard/project/xcnnlczvxmuwcqwychox/auth/providers
EOF

if [[ "${REDEPLOY:-}" == "1" ]]; then
  echo "→ redeploying production"
  $VERCEL redeploy deutsch-app-dusky.vercel.app --target production
fi
