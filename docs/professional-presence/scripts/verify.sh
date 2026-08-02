#!/usr/bin/env bash
# Verify public professional-presence hygiene (no auth required for most checks).
set -euo pipefail

OWNER="${OWNER:-blackhebrewisraeli}"
API="https://api.github.com"
FAIL=0

check() {
  local name="$1"; shift
  if "$@"; then
    echo "OK  ${name}"
  else
    echo "FAIL ${name}"
    FAIL=1
  fi
}

echo "==> Profile README contact hygiene"
profile="$(curl -sS "https://raw.githubusercontent.com/${OWNER}/${OWNER}/main/README.md")"
check "no mailto:" bash -c "! grep -qiE 'mailto:|[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}' <<<\"\$profile\" || grep -qi 'open an issue\\|Open a GitHub issue\\|Contact-Open' <<<\"\$profile\""
# Allow certificate URLs / shields; flag obvious phone patterns
check "no phone-like numbers in profile" bash -c "! grep -E '\\+?[0-9]{2,3}[- .]?[0-9]{3}[- .]?[0-9]{4,}' <<<\"\$profile\""
check "links LinkedIn" bash -c "grep -q 'linkedin.com/in/shimon-esterkin' <<<\"\$profile\""
check "links Skills Journey" bash -c "grep -q 'github-skills-journey' <<<\"\$profile\""
check "Instagram not a primary CTA" bash -c "! grep -qi 'instagram' <<<\"\$profile\""

echo "==> Skills journey"
journey="$(curl -sS "https://raw.githubusercontent.com/${OWNER}/github-skills-journey/main/README.md")"
check "has 30-second summary" bash -c "grep -qi '30-second summary' <<<\"\$journey\""
check "has progress dashboard" bash -c "grep -qi 'Progress dashboard' <<<\"\$journey\""
check "skills table LinkedIn-aligned" bash -c "grep -qi 'GitHub Actions' <<<\"\$journey\" && grep -qi 'CodeQL' <<<\"\$journey\""

echo "==> Archived skills repos (sample)"
for repo in skills-introduction-to-github skills-hello-github-actions skills-deploy-to-azure; do
  archived="$(curl -sS "${API}/repos/${OWNER}/${repo}" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("archived", False))')"
  check "${repo} archived=${archived}" bash -c "[[ \"$archived\" == \"True\" ]]"
done

echo "==> WIP remains private"
deutsch="$(curl -sS -o /tmp/deutsch.json -w '%{http_code}' "${API}/repos/${OWNER}/deutsch-app")"
# Private repo returns 404 to anonymous
check "deutsch-app not publicly listed" bash -c "[[ \"$deutsch\" == \"404\" ]]"

echo "==> Metrics workflow present (profile repo)"
code="$(curl -sS -o /dev/null -w '%{http_code}' \
  "https://raw.githubusercontent.com/${OWNER}/${OWNER}/main/.github/workflows/metrics.yml")"
check "metrics.yml HTTP ${code}" bash -c "[[ \"$code\" == \"200\" ]]"

if [[ "$FAIL" -ne 0 ]]; then
  echo "Verification finished with failures."
  exit 1
fi
echo "All checks passed (or content not yet applied — re-run after apply.sh)."
