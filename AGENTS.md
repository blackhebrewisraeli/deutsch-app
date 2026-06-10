# AGENTS.md — shared rules for every AI agent in this repo

This file is the **single source of truth** for any AI coding agent working on
deutsch-app: Cursor, Claude Code, Antigravity, or anything else. It is tracked
in git, so it follows the project to every machine and environment.

## Project

German-learning PWA being refactored into a language-agnostic engine +
swappable content packs (German = reference pack). React 18 + Vite 5, inline
styles only, Vitest + RTL, ESLint 10 flat config + Prettier.

**Linked environments:**
- **GitHub:** https://github.com/blackhebrewisraeli/deutsch-app (origin, `main` is protected truth)
- **Vercel:** auto-deploys `main` via the GitHub integration → https://deutsch-app-dusky.vercel.app
- **CI:** `.github/workflows/ci.yml` runs on every push/PR
- **Local checkout:** `~/Projects/deutsch-app` (the only working copy — do not create others)

## Division of labor

- **Claude Code (Pro, paid credits):** architecture and contract design, specs
  and implementation plans (`docs/superpowers/`), environment-specific
  debugging (Vercel, API keys), security, PR review, anything cross-cutting or
  ambiguous.
- **Cursor (free agent):** well-scoped, objectively verifiable missions —
  executing pre-written plans, tests, lint, a11y, docs, read-only audits,
  multi-file mechanical refactors, browser-verified UI checks, and scheduled
  automations. "Done" must be checkable by `npm test` / `npm run lint`.
- Mission briefs for Cursor live in `CURSOR_TASKS.md` (local-only file at repo
  root, written by Claude Code). Cursor only works from a Tier A brief there;
  Tier B items are blocked until Claude Code designs them.

## Coordination protocol

1. **One branch per mission**, branched from up-to-date `main`. Never commit
   directly to `main`; land work via PR.
2. **Commit (or stash) before switching tools** so the next agent starts from
   a clean tree. Don't let two tools edit the same file concurrently.
3. `.husky/pre-commit` runs lint-staged **and** the full test suite. Never
   bypass it (`--no-verify` is forbidden). A green commit is the passing signal.
4. After a Cursor mission lands, report back to Claude Code using the template
   at the bottom of `CURSOR_TASKS.md` so it reviews before merge.

## Code conventions

- **Tests:** Vitest with `globals: false` — every test file imports
  `{ describe, it, expect, vi, ... }` from `'vitest'`. jsdom env;
  `src/test-setup.js` provides jest-dom matchers, RTL auto-cleanup, and a
  localStorage shim. Co-locate tests next to sources (`*.test.js(x)`).
- **Styling:** inline styles only, tokens from `src/lib/theme.js`
  (COLORS / RADIUS / SHADOW / BUTTON / CARD). Never hardcode colors, radii, or
  shadows. UI primitives live in `src/components/ui/`.
- **Typography:** Fraunces serif for display words, JetBrains Mono for UI
  labels (uppercase). Don't change fonts.
- **Language-blind engine rule:** code in `src/lib/*` and `src/components/*`
  must not hardcode German specifics — no `card.de` keys in engine logic, no
  `if (language === 'de')`. German-specific behavior belongs in the pack
  (`src/packs/de/`), accessed via `activePack`. (`src/data/content.js` is
  legacy-allowed until Phase 1.5.)
- **Storage:** localStorage keys (`deutsch-app-state-v1` etc.) are NOT
  namespaced per language yet — do not rename or migrate any storage key.
  That is Phase 4, designed by Claude Code.
- **Installs:** always `npm install --legacy-peer-deps` (see `.npmrc`).
- **A11y baseline:** semantic elements, `aria-label` on icon-only buttons,
  visible focus states.

## Verification

`npm test`, `npm run lint`, `npm run format:check` — all three must pass
before any mission is "done". Don't modify files outside a mission's stated
file list; flag out-of-scope bugs with a `// BUG:` comment instead of fixing
silently.

## Secrets

`.env*` is git-ignored; only `.env.example` is tracked. Never commit API keys.
Production secrets (e.g. `ANTHROPIC_API_KEY`) live in Vercel project settings,
not in the repo.
