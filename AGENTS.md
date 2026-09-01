# AGENTS.md — shared rules for every AI agent in this repo

This file is the **single source of truth** for any AI coding agent working on
deutsch-app: Cursor, Claude Code, Antigravity, or anything else. It is tracked
in git, so it follows the project to every machine and environment.

## Project

German-learning PWA on a language-agnostic engine + swappable content packs
(German = the only pack). React 18 + Vite 5, inline styles only, Vitest + RTL,
ESLint 10 flat config + Prettier.

**Product decision (2026-08-15) — German stays the only pack.** The multi-pack
engine work (Phases 1.2–1.5, 3a) is kept and still valuable: it is why the
engine is clean. But shipping a second language is _not_ the goal. Phases 3b/3c
(content) and Phase 4 (picker + storage namespacing) are shelved, and the ~25
German chrome/gamification strings in `src/lib/gamification.js` stay hardcoded —
the German flavour **is** the brand. Effort goes into the German app itself.
Recorded here because the fuller write-up lives in `CURSOR_TASKS.md`, which is
git-excluded and therefore absent from CI and fresh checkouts.

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
- **Typography:** Fraunces serif for display words, Plus Jakarta Sans for body
  prose, JetBrains Mono for UI labels (uppercase) **and for IPA**. Don't change
  fonts without the owner's say-so; all three are vendored under `public/fonts/`
  and declared in `src/packs/de/theme.js`.
  - **Body was Fraunces until 2026-09-01**, when the owner moved prose to the
    sans that had been vendored in advance for exactly that decision. Display
    stayed Fraunces — the serif is the brand at headword scale. If you are
    reading an older doc that says "Fraunces for display and body", this is the
    line that supersedes it.
  - **IPA on the mono face is a constraint, not a preference.** Phonetics borrow
    θ and χ from the `greek` subset, and of the three vendored families only
    JetBrains Mono ships it — the sans is deliberately latin-only, so setting a
    sans on IPA renders those glyphs as tofu. Phonetics render through
    `TEXT.ipa`, which pins the face; `fontCoverage.test.js` guards the subset
    and `theme.test.js` guards the recipe.
  - `fontCoverage.test.js` resolves each role from the pack's font _stack_, not
    from a position in the `families` array. Keep it that way: the positional
    version audited whichever family happened to be first, which silently
    stopped matching the body face the moment body and display diverged.
- **Grid tracks:** always `minmax(0, 1fr)`, never a bare `1fr`. A `1fr` track
  keeps `min-width: auto`, so it refuses to shrink below its content and pushes
  the page wider than the viewport instead. This caused mobile overflow in four
  separate places (see `docs/DEMO_READINESS.md` #15–#17).
- **Narrow viewports:** verify at 375px _and_ 320px (`bp.tiny`), and with a
  populated account — a fresh one hides elements that only exist with real
  progress (freeze chip, high level, long rank names).
- **Language-blind engine rule:** code in `src/lib/*` and `src/components/*`
  must not hardcode German specifics — no `if (language === 'de')`, no German
  values, strings, or grammar baked into engine logic. German-specific behavior
  belongs in the pack (`src/packs/de/`), accessed via `activePack`.
- **The `de` field name is a recorded exception to that rule.** Pack cards ship
  as `{ de, en, ipa, … }`, and the translate exercises, chat message rendering,
  and the vocab drill/card layer read `card.de` directly. This is a _field name_
  in the pack's own data contract, not a German branch: nothing reads it to
  decide German behaviour, and `src/lib/*` does not read it at all (`srsKey`
  keys on `card.id`, `speech.js` reads `activePack`). Renaming it to `term`
  — proposed as `docs/AUDIT_GERMAN_COUPLING.md` #2 — only pays off with a second
  pack, and there will not be one (see the product decision under **Project**).
  **So: don't "fix" `card.de`, and don't file it as a violation.**
  If a second pack is ever greenlit, the rename is part of that work, designed by
  Claude Code — it touches pack data, the components above, and their tests.
- **Storage:** localStorage keys (`deutsch-app-state-v1` etc.) are NOT
  namespaced per language yet — do not rename or migrate any storage key.
  That is Phase 4, designed by Claude Code.
- **Installs:** always `npm install --legacy-peer-deps` (see `.npmrc`).
- **A11y baseline:** semantic elements, `aria-label` on icon-only buttons,
  visible focus states.

## Where things are written down

- **`AGENTS.md`** (this file) — rules and product decisions that constrain the
  architecture. Tracked.
- **`docs/BACKLOG.md`** — work deliberately not started and why, plus the owner
  actions nobody with repo access can do. Tracked.
- **`docs/superpowers/specs|plans/`** — per-mission designs and implementation
  plans, written by Claude Code. Tracked.
- **`CURSOR_TASKS.md`** — the scratch queue of in-flight mission briefs.
  **Git-excluded, so it exists on one machine only.** Never let it be the sole
  home of a decision or a queued plan: promote those to one of the tracked files
  above. This has bitten twice — a product decision and a visual spec each lived
  only there.

## Verification

`npm test`, `npm run lint`, `npm run format:check` — all three must pass
before any mission is "done". Don't modify files outside a mission's stated
file list; flag out-of-scope bugs with a `// BUG:` comment instead of fixing
silently.

## Secrets

`.env*` is git-ignored; only `.env.example` is tracked. Never commit API keys.
Production secrets (e.g. `ANTHROPIC_API_KEY`) live in Vercel project settings,
not in the repo.

## Cursor Cloud specific instructions

Standard commands and setup live in the README "Quick Start" / "Available
scripts" sections and `package.json`; this section only records the non-obvious
caveats for running in the cloud VM. Dependencies are refreshed automatically
by the startup update script (`npm install --legacy-peer-deps`).

- **Node version:** `.nvmrc` pins Node 20, but the VM's default `node`
  (`/exec-daemon/node`, currently v22) takes PATH priority over nvm and works
  fine for the whole toolchain (install, `npm test`, `npm run build`, `vite`).
  No need to fight the PATH to force Node 20.
- **Which dev server:** use `npm run dev` (Vite only, port 5173) for UI and any
  offline-first feature. `npm run dev:full` (`vercel dev`) is only needed for
  the AI lane and requires `npx vercel link` **plus** `ANTHROPIC_API_KEY` — not
  present in the VM by default, so prefer `npm run dev` unless you have those.
- **What works without the AI backend / secrets:** Vocab multiple-choice
  (preset decks + lexicon), Alphabet, A1 translate tiles, A2 fill-the-blanks,
  Stats, streak/XP/SRS — all run fully under `npm run dev`. AI-dependent flows
  (Chat tutor replies, B1 free-typing grading, custom deck generation, on-demand
  sentence generation when a bank is exhausted) need `dev:full` + the key.
- **A good no-secrets smoke test:** onboard (continue without account → pick a
  level) → Vocab tab → start the "Greetings" preset deck → answer cards → watch
  XP/level/Stats update. This exercises the core engine end to end.
- **Sign-in / sync / leagues** are off unless the `VITE_SUPABASE_*` and
  `VITE_*_ENABLED` flags in `.env` are set (see `.env.example`); the app is
  anonymous-first, so their absence is expected, not a bug.
- **RLS suite** (`npm run test:rls`) needs Docker + `supabase start` and is
  intentionally excluded from `npm test` and the pre-commit hook.
- **Pre-commit hook** (`.husky/pre-commit`) runs `lint-staged` **and the full
  `npm test`**, so commits take ~30s; never bypass with `--no-verify`.
