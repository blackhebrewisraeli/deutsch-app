#!/usr/bin/env bash
# B1 Task 11 — wire Supabase + origin allow-list into Vercel env.
#
# Prerequisites:
#   - vercel login   OR   export VERCEL_TOKEN=<personal-access-token>
#   - export SUPABASE_SERVICE_ROLE_KEY=<from Supabase dashboard → Settings → API>
#
# Usage (from repo root):
#   export SUPABASE_SERVICE_ROLE_KEY='eyJ...'
#   ./scripts/b1-vercel-env-setup.sh
#
# Optional:
#   REMOVE_LEGACY_VITE_KEY=1  — also delete VITE_ANTHROPIC_API_KEY from preview+production
#   REDEPLOY=1                — trigger a production redeploy after env changes

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TEAM_SLUG="${VERCEL_TEAM_SLUG:-blackhebrewisraelis-projects}"
PROJECT_NAME="${VERCEL_PROJECT_NAME:-deutsch-app}"
SUPABASE_URL="${SUPABASE_URL:-https://xcnnlczvxmuwcqwychox.supabase.co}"
ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-https://deutsch-app-dusky.vercel.app}"
ENVS=(production preview development)

if ! command -v vercel >/dev/null 2>&1; then
  echo "error: vercel CLI not found. Run: npm i -g vercel  OR  npx vercel <cmd>" >&2
  exit 1
fi

if [[ -z "${VERCEL_TOKEN:-}" ]] && ! vercel whoami >/dev/null 2>&1; then
  echo "error: not logged in. Run: vercel login  OR  export VERCEL_TOKEN=..." >&2
  exit 1
fi

if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "error: SUPABASE_SERVICE_ROLE_KEY is required." >&2
  echo "  Copy it from: https://supabase.com/dashboard/project/xcnnlczvxmuwcqwychox/settings/api" >&2
  echo "  Then: export SUPABASE_SERVICE_ROLE_KEY='...'" >&2
  exit 1
fi

if [[ ! -d .vercel ]]; then
  echo "→ linking Vercel project ${PROJECT_NAME} (team ${TEAM_SLUG})"
  vercel link --yes --project "$PROJECT_NAME" --scope "$TEAM_SLUG"
fi

upsert_env() {
  local name="$1"
  local value="$2"
  shift 2
  local targets=("$@")
  local sensitive="${SENSITIVE:-0}"

  for target in "${targets[@]}"; do
    echo "→ ${name} (${target})"
    vercel env rm "$name" "$target" --yes 2>/dev/null || true
    if [[ "$sensitive" == "1" ]]; then
      printf '%s' "$value" | vercel env add "$name" "$target" --sensitive
    else
      printf '%s' "$value" | vercel env add "$name" "$target"
    fi
  done
}

echo "→ setting SUPABASE_URL (all environments)"
upsert_env SUPABASE_URL "$SUPABASE_URL" "${ENVS[@]}"

echo "→ setting SUPABASE_SERVICE_ROLE_KEY (all environments, sensitive)"
SENSITIVE=1 upsert_env SUPABASE_SERVICE_ROLE_KEY "$SUPABASE_SERVICE_ROLE_KEY" "${ENVS[@]}"

echo "→ setting ALLOWED_ORIGINS (production only)"
upsert_env ALLOWED_ORIGINS "$ALLOWED_ORIGINS" production

if [[ "${REMOVE_LEGACY_VITE_KEY:-}" == "1" ]]; then
  echo "→ removing legacy VITE_ANTHROPIC_API_KEY from preview + production"
  vercel env rm VITE_ANTHROPIC_API_KEY preview --yes 2>/dev/null || true
  vercel env rm VITE_ANTHROPIC_API_KEY production --yes 2>/dev/null || true
fi

cat <<EOF

✓ Vercel env updated.

Next:
  1. Append to your local .env (vercel dev cannot pull sensitive values):
       SUPABASE_URL=${SUPABASE_URL}
       SUPABASE_SERVICE_ROLE_KEY=<same value you exported>

  2. Redeploy production so functions pick up the new vars:
       vercel redeploy deutsch-app-dusky.vercel.app --prod
     Or push any commit to main.

  3. Verify:
       ./scripts/verify-b1-production.sh

Supabase dashboard (one-time, for B2):
  Authentication → Sign In / Up → enable Anonymous sign-ins
  https://supabase.com/dashboard/project/xcnnlczvxmuwcqwychox/auth/providers
EOF

if [[ "${REDEPLOY:-}" == "1" ]]; then
  echo "→ redeploying production"
  vercel redeploy deutsch-app-dusky.vercel.app --prod --yes
fi
