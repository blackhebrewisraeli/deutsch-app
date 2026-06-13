# Backend B2 — Auth & Sync (welcome gate, magic links, local-first sync)

**Status:** Approved design (brainstormed and user-approved in session, 2026-06-13).
**Parent:** `2026-06-10-backend-architecture-design.md` (the two-lane backend).
**Depends on:** B1 (merged — schema, RLS, explicit Data API grants all deployed
and adversarially tested) and platform A6 (merged — language-neutral
`card.id`).

This sub-spec covers the B2 milestone: the authentication surface and the
sync engine. It **amends** the parent spec in four places (see Amendments).

---

## Decisions (user-approved)

| # | Decision | Choice |
|---|---|---|
| 1 | First-visit entry | **Welcome gate with a guest path** — Create account / Sign in / "Continue without an account →". Returning visitors (onboarding flag or live session) skip it |
| 2 | Sign-in method (B2) | **Email magic link only** (passwordless). Google OAuth deferred to B3 |
| 3 | Email infrastructure | **Resend SMTP** wired into Supabase auth (free tier: 3,000/month, 100/day). Supabase's built-in sender (~2/hour) is dev-only |
| 4 | Account surface | **Both**: minimal header chip (guest: "Sign in"; signed-in: initial-in-a-circle with pending-sync dot) + full "Account & Sync" section in the Stats tab above Goal/Sound settings |
| 5 | Identity architecture | **Local-first guests, sync-on-sign-in** (Approach 2). No anonymous Supabase sessions. First sync after sign-in *is* the merge |

## Amendments to the parent spec

1. **Entry flow:** the parent's "invisible-first" entry (no auth surface until
   the user seeks sync) is replaced by the welcome gate (Decision 1). The
   anonymous-first *promise* is preserved — guests reach the app in one tap
   and are never required to create an account.
2. **Lazy anonymous identity is dropped.** `signInAnonymously()`, the
   `linkIdentity()` upgrade path, and orphan-user cleanup are removed from
   the design. Guests are purely local (exactly today's behavior). The
   parent invented anonymous sessions to make sign-up zero-data-movement;
   with merge-on-first-sync the merge rules exist anyway, so the anonymous
   machinery would add a DB user per drive-by visitor and a cleanup job for
   no user-visible benefit. `enable_anonymous_sign_ins` stays **false**.
3. **`POST /api/v1/account/merge` is removed from B2.** Cross-device and
   guest-to-account merging happen client-side through the sync engine's
   normal per-record rules under RLS (the user can only ever touch their own
   rows). B3 still owns `GET /api/v1/account/export` and
   `DELETE /api/v1/account`.
4. **Initial provider set:** email magic link (B2); Google OAuth moves to B3
   as the first follow-up (the sign-in card layout reserves space for it).

---

## 1 · Entry flow

```
First visit ──► WelcomeGate ──► [Create account | Sign in] ──► MagicLinkForm ──► session
   │                │                                                              │
   │                └──► "Continue without an account →" ──► SplashScreen (level) ─┤
   │                                                                               ▼
Returning (onboarding flag or live session) ─────────────────────────────────► App
```

- Gate shows when there is **no** `deutsch-onboarded` flag **and no** Supabase
  session. Guest tap proceeds to the existing level-picker splash and sets the
  flag, exactly as today.
- "Create account" and "Sign in" lead to the same magic-link form; only the
  heading copy differs.
- A signed-in user on a fresh device: gate → sign in → first sync pulls their
  rows → level comes from synced settings (splash only if the account has no
  level yet).
- Signing out later does **not** resurface the gate (the flag exists); it
  returns the device to guest mode with local data intact.

## 2 · Auth module — `src/lib/auth.js` (engine, language-blind)

- New browser Supabase client (`@supabase/supabase-js`, already a dependency)
  configured from `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. Both are
  **public by design** (parent spec §env table); RLS is the authorization
  layer and the 30-test adversarial suite already proves it.
- Surface:
  - `signInWithMagicLink(email)` → `auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin } })`
  - `verifyCode(email, sixDigitCode)` → `auth.verifyOtp({ email, token, type: 'email' })` — the installed-PWA path
  - `signOut()` → `auth.signOut()` (local data untouched)
  - `useAuth()` React hook → `{ session, user, status }` via
    `onAuthStateChange`, exposed app-wide (module-level subscription; no new
    context provider unless App.jsx wiring demands it)
- **Every sign-in email carries both a link and a 6-digit code** (template
  includes `{{ .Token }}`). The link signs in whatever browser opens it; the
  code signs in the app it's typed into. This is the standard workaround for
  magic links opening in the browser instead of the installed PWA.

## 3 · Sync engine — `src/lib/sync.js` (engine, language-blind)

- Behind `VITE_SYNC_ENABLED` (build-time flag; rollback = flip + redeploy).
- `localStorage` remains the **offline source of truth**; existing storage
  keys are untouched (AGENTS.md constraint — namespacing is platform Phase 4).
- **Adapters** per store map local shape ↔ deployed tables:
  `srs ↔ srs_state` (per card), `daily ↔ stats_daily` (per day),
  custom decks ↔ `decks` (per deck; preset decks are content, never synced),
  settings-shaped state (level, goal, sound, achievements, learnedWords)
  ↔ `settings.data` (single jsonb), display name ↔ `profiles`.
  Exact field mapping is finalized in the implementation plan.
- Local mutations stamp `updated_at` (ms epoch) per record via a thin hook in
  the storage write path — no key renames.
- **Outbound:** 3-second debounced push of dirty records whenever a session
  exists. **Inbound:** pull on auth-ready and on `visibilitychange` resume.
- **First sync after sign-in is the merge:** pull → per-record merge → push
  local-newer. Rules: last-write-wins by `updated_at` for decks, settings,
  stats; SRS cards prefer the record with the **more recent review**
  (`lastReviewed`, falling back to `updated_at`); exact ties keep the server
  row. Client clocks are trusted (single-user scale; documented limitation).
- Signed out or offline: the engine is a **no-op**. Flag off or `VITE_SUPABASE_*`
  unset: module never initializes — the app is byte-identical to today.

## 4 · UI components (inline styles, theme tokens, a11y baseline)

| Component | Purpose |
|---|---|
| `src/components/WelcomeGate.jsx` | Brand + three actions (Decision 1). Shown per §1 logic in App.jsx |
| `src/components/auth/MagicLinkForm.jsx` | Email input → "check your inbox" state → 6-digit code input + resend (30 s cooldown). Surfaces auth errors plainly |
| Header account chip (App header) | Guest: quiet "Sign in" (opens MagicLinkForm modal). Signed-in: initial-in-a-circle; dot = pending sync; tap → sheet (email · sync status · sign out · "manage in Stats") |
| `src/components/stats/AccountSection.jsx` | Above Goal/Sound. Signed-in: email, last-synced time, sign out. Guest: "Sign in to sync your progress across devices →" |

## 5 · Configuration (no new API endpoints)

Owner setup, documented step-by-step in the implementation plan:

1. **Resend**: account → verified sender → API key → Supabase Auth SMTP
   settings.
2. **Supabase Auth**: Site URL = production domain; redirect allow-list =
   production + `http://localhost:5173`. Email template includes the
   `{{ .Token }}` code alongside the link. (Previews sign in via the code
   path — no wildcard redirect needed.)
3. **Vercel env**: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in all three
   environments (public by design); `.env.example` documents them.
4. **Local stack**: `supabase/config.toml` `site_url` →
   `http://localhost:5173` (currently `:3000`); `enable_anonymous_sign_ins`
   stays false.

Schema, RLS, and explicit grants need **zero changes** — B1 deployed exactly
the surface this consumes (`authenticated`: own-row CRUD; `anon`: nothing).

## 6 · Edge cases & errors

- **Link opened elsewhere** (different browser/device): session lands there;
  the in-app "check your inbox" screen says to use the code if the app didn't
  sign in.
- **Email missing**: resend with cooldown; Supabase auth rate-limit errors
  surface as "Too many attempts — try again in a minute."
- **Sign out**: local data remains (stated in the confirmation), server rows
  remain; next sign-in re-merges.
- **Multiple tabs**: supabase-js broadcasts session changes; concurrent
  debounced pushes are safe under per-record LWW.
- **No conflict UI in B2** — per-record LWW is the policy, by design.

## 7 · Testing

- **Merge rules**: pure functions with table-driven unit tests — the heart of
  the milestone (clock order, SRS-review preference, tie-to-server, empty
  sides, partial stores).
- **Adapters**: round-trip tests (`fromRows(toRows(x)) ≅ x`).
- **Auth module**: unit tests against a mocked supabase client.
- **Components**: RTL tests for gate routing, form states (input → inbox →
  code → error), chip states, AccountSection.
- **Authorization**: already covered by the 30-test adversarial RLS suite; it
  stays green untouched.
- **Manual checklist** (plan): real magic link on production; code entry in an
  installed PWA; two-device merge (guest progress on A, account history on B).

## 8 · Rollout

Three PR-sized stages, each green through branch → CI → review:

1. **B2.1** — `auth.js`, WelcomeGate, MagicLinkForm, header chip,
   AccountSection (UI works end-to-end against Supabase auth; sync flag off).
2. **B2.2** — `sync.js` engine: adapters, `updated_at` stamping, merge,
   debounced push / pull-on-resume, wired behind `VITE_SYNC_ENABLED`.
3. **B2.3** — owner config (Resend, redirect URLs, Vercel env), production
   verification (extend `scripts/verify-b1-production.sh` pattern), flag on.

Division per AGENTS.md: Claude Code owns the sync engine, merge rules, and
config; Cursor takes well-scoped UI/component-test missions via
`CURSOR_TASKS.md` briefs.

**Success criteria:** a fresh device restores progress within seconds of
sign-in; guest progress survives sign-up; signed-out experience is
byte-identical to today; `npm test` and the RLS suite stay green at every
stage.

## Open questions routed to the implementation plan

- Exact `settings.data` field mapping (level / goal / sound / achievements /
  learnedWords) and the `updated_at` stamping hook in `storage.js`.
- Resend sender domain (e.g. `auth@<domain>`) — owner picks during B2.3.
- Whether the header chip's pending-sync dot ships in B2.2 or B2.3 (cosmetic).
