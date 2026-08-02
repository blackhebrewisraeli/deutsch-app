#!/usr/bin/env bash
# Apply the professional-presence kit to GitHub (profile + skills journey).
#
# Usage:
#   export GH_TOKEN=ghp_xxx   # classic PAT (repo) or fine-grained with Contents+Administration
#   ./docs/professional-presence/scripts/apply.sh
#
# Optional:
#   DRY_RUN=1 ./docs/professional-presence/scripts/apply.sh
#   SKIP_ARCHIVE=1 SKIP_PINS=1 ./docs/professional-presence/scripts/apply.sh
set -euo pipefail

OWNER="${OWNER:-blackhebrewisraeli}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS="$(cd "$(dirname "$0")" && pwd)"
API="https://api.github.com"
DRY_RUN="${DRY_RUN:-0}"
SKIP_ARCHIVE="${SKIP_ARCHIVE:-0}"
SKIP_PINS="${SKIP_PINS:-0}"

if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "ERROR: Set GH_TOKEN to a personal access token with access to ${OWNER}'s repos." >&2
  exit 1
fi

auth=(-H "Authorization: Bearer ${GH_TOKEN}" -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28")

echo "==> Authenticated as:"
login="$(curl -sS "${auth[@]}" "${API}/user" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("login",""))')"
echo "    ${login:-unknown}"
if [[ -n "$login" && "$login" != "$OWNER" ]]; then
  echo "WARN: token user (${login}) != OWNER (${OWNER}). Continuing anyway." >&2
fi

SKILLS_REPOS=(
  skills-agent-orchestration-build-your-ai-dream-team
  skills-agentic-workflows-that-read-the-room
  skills-ai-in-actions
  skills-change-commit-history
  skills-code-with-codespaces
  skills-communicate-using-markdown
  skills-configure-codeql-language-matrix
  skills-connect-the-dots
  skills-create-ai-powered-actions
  skills-create-applications-with-the-copilot-cli
  skills-deploy-to-azure
  skills-getting-started-with-github-copilot
  skills-github-pages
  skills-hello-github-actions
  skills-integrate-mcp-with-copilot
  skills-introduction-to-codeql
  skills-introduction-to-git
  skills-introduction-to-github
  skills-introduction-to-repository-management
  skills-introduction-to-secret-scanning
  skills-migrate-ado-repository
  skills-publish-docker-images
  skills-release-based-workflow
  skills-resolve-merge-conflicts
  skills-reusable-workflows
  skills-review-pull-requests
  skills-secure-code-game
  skills-secure-repository-supply-chain
  skills-test-with-actions
  skills-write-javascript-actions
)

if [[ "$SKIP_ARCHIVE" != "1" ]]; then
  echo "==> Archiving ${#SKILLS_REPOS[@]} skills-* repos (public + archived)"
  for repo in "${SKILLS_REPOS[@]}"; do
    echo "    archive ${OWNER}/${repo}"
    if [[ "$DRY_RUN" == "1" ]]; then
      continue
    fi
    code="$(curl -sS -o /tmp/arch_resp.json -w '%{http_code}' -X PATCH "${auth[@]}" \
      "${API}/repos/${OWNER}/${repo}" \
      -d '{"archived":true}')"
    if [[ "$code" != "200" ]]; then
      msg="$(python3 -c 'import json; print(json.load(open("/tmp/arch_resp.json")).get("message",""))' 2>/dev/null || true)"
      # 404 / already archived / missing repo should not hard-fail the whole run
      echo "      WARN: HTTP ${code} ${msg}" >&2
    fi
  done
else
  echo "==> Skipping archive (SKIP_ARCHIVE=1)"
fi

put_file() {
  local repo="$1"
  local path="$2"
  local local_file="$3"
  local message="$4"
  echo "    put ${OWNER}/${repo}:${path}"
  if [[ "$DRY_RUN" == "1" ]]; then
    return 0
  fi
  COMMIT_MESSAGE="$message" python3 "$SCRIPTS/lib_put_file.py" "$OWNER" "$repo" "$path" "$local_file"
}

echo "==> Updating profile repo (${OWNER}/${OWNER})"
put_file "$OWNER" "README.md" "$ROOT/profile-repo/README.md" \
  "docs: restructure profile README as networking landing page"
put_file "$OWNER" ".github/workflows/metrics.yml" "$ROOT/profile-repo/.github/workflows/metrics.yml" \
  "ci: add lowlighter/metrics dashboard workflow"

echo "==> Updating github-skills-journey"
put_file "github-skills-journey" "README.md" "$ROOT/skills-journey/README.md" \
  "docs: recruiter skim, progress dashboard, LinkedIn-aligned skills"
put_file "github-skills-journey" "ROADMAP.md" "$ROOT/skills-journey/ROADMAP.md" \
  "docs: trim public ops noise; keep as personal study log"

echo "==> Polishing github-skills-journey metadata"
if [[ "$DRY_RUN" != "1" ]]; then
  curl -sS -X PATCH "${auth[@]}" \
    "${API}/repos/${OWNER}/github-skills-journey" \
    -d '{"description":"Curated showcase of 28 completed GitHub Skills practices — GitHub Foundations prep. Featured from my profile landing page.","has_wiki":false,"has_projects":false}' \
    >/tmp/journey_meta.json
  curl -sS -X PUT "${auth[@]}" \
    "${API}/repos/${OWNER}/github-skills-journey/topics" \
    -H "Accept: application/vnd.github+json" \
    -d '{"names":["github-skills","github-foundations","portfolio","ci-cd","github-actions","codeql","devops","certification-prep"]}' \
    >/tmp/journey_topics.json
fi

PIN_REPOS=(
  "${OWNER}/github-skills-journey"
  "${OWNER}/C-Assembler-Simulator"
  "${OWNER}/Transportation-system-project"
  "${OWNER}/ebpf-bcc-tracing-lab"
  "${OWNER}/Python-SQL-Bank-Account-Database"
  "${OWNER}/Java-sorting-searching-templates"
)

if [[ "$SKIP_PINS" != "1" ]]; then
  echo "==> Profile pin targets (manual if GraphQL unavailable):"
  printf '    - %s\n' "${PIN_REPOS[@]}"
  echo "    Customize pins: https://github.com/${OWNER} → Customize your pins"
else
  echo "==> Skipping pins (SKIP_PINS=1)"
fi

cat <<EOF

==> Kit apply finished.

One-time manual follow-ups:
  1) Create a fine-grained PAT (Contents: R/W on ${OWNER}/${OWNER}) for metrics.
  2) Add repo secret METRICS_TOKEN:
     https://github.com/${OWNER}/${OWNER}/settings/secrets/actions
  3) Actions → "GitHub Metrics" → Run workflow
  4) Pin the 6 repos listed above (Profile → Customize your pins)
  5) Paste LinkedIn copy from:
     ${ROOT}/LINKEDIN_KIT.md

Privacy encoded in the READMEs:
  - No public email / phone
  - Contact via LinkedIn or GitHub issue only
  - WIP repos remain private and unmentioned
EOF
