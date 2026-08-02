#!/usr/bin/env bash
# Verify kit files before they are applied to GitHub.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0

ok() { echo "OK  $1"; }
bad() { echo "FAIL $1"; FAIL=1; }

PROFILE="$ROOT/profile-repo/README.md"
JOURNEY="$ROOT/skills-journey/README.md"
ROADMAP="$ROOT/skills-journey/ROADMAP.md"
METRICS="$ROOT/profile-repo/.github/workflows/metrics.yml"
LINKEDIN="$ROOT/LINKEDIN_KIT.md"

[[ -f "$PROFILE" ]] && ok "profile README exists" || bad "profile README missing"
[[ -f "$JOURNEY" ]] && ok "journey README exists" || bad "journey README missing"
[[ -f "$ROADMAP" ]] && ok "roadmap exists" || bad "roadmap missing"
[[ -f "$METRICS" ]] && ok "metrics workflow exists" || bad "metrics workflow missing"
[[ -f "$LINKEDIN" ]] && ok "LinkedIn kit exists" || bad "LinkedIn kit missing"

grep -qi 'linkedin.com/in/shimon-esterkin' "$PROFILE" && ok "profile links LinkedIn" || bad "profile missing LinkedIn"
grep -qi 'github-skills-journey' "$PROFILE" && ok "profile links Skills Journey" || bad "profile missing Skills Journey"
grep -qi 'instagram' "$PROFILE" && bad "profile still has Instagram CTA" || ok "Instagram removed from profile CTA"
grep -qiE 'mailto:' "$PROFILE" && bad "profile has mailto:" || ok "no mailto in profile"
grep -qiE '\+[0-9]{8,}' "$PROFILE" && bad "profile looks like it has a phone" || ok "no phone-like tokens in profile"
grep -qi 'deutsch-app' "$PROFILE" && bad "profile mentions private WIP deutsch-app" || ok "WIP deutsch-app not mentioned"

grep -qi '30-second summary' "$JOURNEY" && ok "journey has recruiter skim" || bad "journey missing 30-second summary"
grep -qi 'Progress dashboard' "$JOURNEY" && ok "journey has progress dashboard" || bad "journey missing progress dashboard"
grep -qi 'GitHub Actions' "$JOURNEY" && grep -qi 'CodeQL' "$JOURNEY" && ok "journey skills LinkedIn-aligned" || bad "journey skills table incomplete"
grep -qi 'Codespaces quota exhausted' "$ROADMAP" && bad "roadmap still has account ops noise" || ok "roadmap ops noise trimmed"

grep -qi 'plugin_isocalendar' "$METRICS" && ok "metrics: isocalendar" || bad "metrics missing isocalendar"
grep -qi 'plugin_repositories_featured' "$METRICS" && ok "metrics: featured repos" || bad "metrics missing featured repos"
grep -qi 'METRICS_TOKEN' "$METRICS" && ok "metrics uses METRICS_TOKEN secret" || bad "metrics token missing"

grep -qi 'Open to Junior Roles' "$LINKEDIN" && ok "LinkedIn headline present" || bad "LinkedIn kit incomplete"
grep -qi 'github.com/blackhebrewisraeli/github-skills-journey' "$LINKEDIN" && ok "LinkedIn features Skills Journey" || bad "LinkedIn missing journey link"
grep -qiE "publish a personal phone|not publish a phone" "$LINKEDIN" && ok "LinkedIn privacy guidance" || bad "LinkedIn missing privacy guidance"

if [[ "$FAIL" -ne 0 ]]; then
  echo "Local verification failed."
  exit 1
fi
echo "Local kit verification passed."
