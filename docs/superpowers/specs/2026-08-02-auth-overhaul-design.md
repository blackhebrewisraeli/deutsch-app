# Auth overhaul — reliable email, Google OAuth, narrow guest trial

**Status:** Approved design (brainstormed and user-approved in session, 2026-08-02).
**Parent:** `2026-06-13-backend-b2-auth-sync-design.md` (auth surface + sync),
`2026-06-27-backend-b3-export-delete-design.md` (which deferred Google OAuth).
**Depends on:** B2.1–B2.3 (shipped — magic-link auth, sync engine, owner config)
and B3 (shipped — export/delete).

This spec **amends** B2 in two places: the sign-in email delivery becomes
version-controlled instead of dashboard-only, and the unlimited guest path is
replaced by a bounded trial. Everything else in B2 (local-first storage,
sync-on-sign-in, merge rules, RLS posture) stands unchanged.

---

## Why

Field experience with the shipped B2 flow surfaced three problems:

1. **Inconsistent sign-in emails.** B2 designed every email to carry both a
   magic link (`{{ .ConfirmationURL }}`) and a 6-digit code (`{{ .Token }}`),
   but the template lives only as a hand-edited Supabase dashboard setting —
   it is not in the repo. Dashboard drift produces link-only or code-only
   emails over time while the UI promises both. This is the root cause of
   "sometimes a code, sometimes a link, not consistent".
2. **Mixed UX copy.** The CTA says "Send me a sign-in link"; the next screen
   asks for a 6-digit code. Two stories for one flow.
3. **Unbounded guest mode undersells accounts.** Guests keep full access
   forever with device-local persistence; nothing ever converts them, and
   "guest doesn't save" confusion follows (guests *do* save locally — they
   just lose it with the browser profile and never sync).

## Decisions (user-approved)

| # | Decision | Choice |
|---|---|---|
| 1 | Email method | Keep **both** magic link and 6-digit code, made reliable: template committed to the repo, code-first copy |
| 2 | OAuth | **Google**, added **after** email is solid (Phase D). On the auth surfaces Google becomes the primary CTA, email secondary |
| 3 | Guest path | **Narrow** — bounded trial, then account required to keep earning progress. Trial data always merges into the account on sign-in; nothing is wiped |
| 4 | Trial cut point | Earlier of: (a) all four gameplay tabs sampled **and** first daily goal completed, or (b) 60 rounds hard cap |
| 5 | Phone/SMS OTP | Designed now (Phase E), **deferred until the project is public-ready** — it is the only auth component with hard per-use cost (SMS) |
| 6 | Paid components | None before the initial public version. Phases C and D are entirely free-tier (Resend email, Google Cloud OAuth) |

---

## 1 · Product flow

```
First visit ──► WelcomeGate ──► [Continue with Google*| Email me a code | Try it first]
                                        │                    │                │
                                        ▼                    ▼                ▼
                                     session            AuthSheet         guest trial
                                                             │                │ trial exhausted
                                                             │                ▼
                                                             │        TrialWall (blocking sheet)
                                                             │                │
                                                             ▼                ▼
                                                          session ◄──── AuthSheet
                                                             │
                                                             ▼
                                          first sync merges guest/trial data (existing engine)

* Google appears in Phase D; in Phase C the primary CTA is email.
```

- Returning users (onboarding flag or live session) skip the gate, as today.
- Sign-out still returns the device to local mode with data intact; the trial
  wall re-applies only if the trial was already exhausted and there is no
  session.

## 2 · Guest trial ("rounds" wall)

**Unit:** one answered exercise (one verdict event) = one round. All counters
derive from existing state — **no new storage keys, no migration**
(AGENTS.md constraint: storage keys are untouched until platform Phase 4).

**Trigger — earlier of:**

1. **Designed peak (normal path):** the user has answered ≥1 round in each of
   the four gameplay tabs (`chat`, `alphabet`, `vocab`, `translate` — from
   `daily[*].byTab`) **and** completed their first daily goal
   (`xpForDay ≥ goal` for any day). The goal celebration plays in full; the
   **next** round attempt shows the wall. Cut at maximum warmth: whole product
   sampled, celebration delivered, progress worth keeping.
2. **Hard cap (backstop):** lifetime `Σ daily[*].total ≥ 60` rounds,
   regardless of tab spread or goal. Stops single-tab grinding from extending
   the trial indefinitely.

**Mechanics:**

- Pure function `trialStatus(daily, gamification)` in a new
  `src/lib/trial.js` returns `{ exhausted, roundsUsed, tabsSampled,
  goalCompleted }`. Constants live in `src/lib/gameConfig.js` beside the
  other balance knobs: `TRIAL_ROUND_CAP = 60`,
  `TRIAL_REQUIRES = { allTabs: true, firstGoal: true }`.
- The wall is a **blocking sheet over the practice surface only**: earning new
  progress is gated; browsing Stats/settings stays open. Copy: "Save your
  progress — create a free account to keep going." Actions: primary sign-in
  CTA (email in C, Google in D) + secondary method.
- Wall check happens at round start (before a new exercise is issued), never
  mid-exercise and never over a running celebration.
- `status === 'authenticated'` bypasses everything; the wall is for
  `anonymous` only. When auth is not configured (`isAuthConfigured()` false —
  CI, local without env), the wall **never shows**: a wall with no working
  sign-in behind it is the dead-affordance bug of PR #79 again.
- WelcomeGate copy changes from "Continue without an account" to
  "Try it first — free", setting the expectation that a wall exists.
- Trial data is never wiped. On first sign-in the existing sync merge
  (`src/lib/sync/merge.js`) folds local rows into the account, exactly as it
  already does for guests.

## 3 · Phase C — make email bulletproof (free tier, build now)

1. **Email template into the repo.** Commit the sign-in template under
   `supabase/templates/` with **both** `{{ .ConfirmationURL }}` and
   `{{ .Token }}`, reference it from `supabase/config.toml`
   (`[auth.email.template.magic_link]`), and document the one-time dashboard
   sync for the hosted project. Every email then always carries link + code;
   drift becomes a diff, not a mystery.
2. **Code-first copy, one story.** CTA: "Email me a sign-in code". Next
   screen: "Enter the 6-digit code — or tap the link in the email." The code
   is primary because it works inside the installed PWA; the link is the
   browser convenience.
3. **In-app AuthSheet.** A single auth modal component used by WelcomeGate,
   the trial wall, AccountChip, and AccountSection. Removes the known wart
   where mid-app sign-in re-surfaces the whole WelcomeGate
   (comment at `src/App.jsx` ~line 292).
4. **Explicit magic-link landing.** Detect the Supabase auth callback on load
   and render "Signing you in…" → success/failure states instead of relying
   silently on supabase-js defaults. Config rides along: local
   `supabase/config.toml` `site_url` → `http://localhost:5173` (still
   `:3000`), redirect allow-list documented in the plan.
5. **Human error copy.** Rate-limit → "Too many attempts — try again in a
   minute." Expired code → "That code expired — resend." Resend keeps the
   existing 30 s cooldown.

## 4 · Phase D — Google OAuth (free tier, after C is merged)

- `signInWithGoogle()` in `src/lib/auth.js` via
  `auth.signInWithOAuth({ provider: 'google', options: { redirectTo:
  location.origin } })`. Supabase auto-links when the Google account's email
  matches an existing email-OTP user.
- "Continue with Google" becomes the **primary** button on WelcomeGate, the
  trial wall, and the AuthSheet; email drops to secondary. Guest trial
  unchanged.
- Owner config (documented step-by-step, B2.3-style): Google Cloud OAuth
  client (consent screen, authorized origins/redirects) + Supabase Google
  provider settings. No per-use cost.

## 5 · Phase E — phone OTP (deferred until public-ready; per-SMS cost)

Designed now so it is scheduled later, not re-litigated. **Do not build
before the initial public version** (Decision 6).

- **Provider:** Twilio (Verify) wired into Supabase phone auth — the
  best-documented path. Each OTP text costs ~$0.01–0.08 by country; Supabase's
  built-in rate limits plus Twilio geo-permissions are the SMS-pumping
  defenses. Claude Code reviews the abuse surface before enablement.
- **AuthSheet grows an Email | Phone method toggle.** Phone step 1: country
  dial-code picker (flag + prefix, searchable, default inferred from browser
  locale) + national-number input. Step 2: 6-digit SMS code, same verify UI
  as email.
- **Validation via `libphonenumber-js`** (the standard metadata-driven
  library — no hand-written per-country regexes):
  - Format-as-you-type with the selected country's grouping.
  - **Inline error the moment the pattern breaks** — e.g. with `+972`
    selected, a national number not starting with `5` immediately shows
    "Israeli mobile numbers start with 05…". Same logic for every country,
    driven by the library's numbering-plan metadata.
  - Leading-zero normalization: `054…` after `+972` becomes `+97254…`
    (users type national form; Supabase needs E.164).
  - Submit disabled until the number is valid for the selected country.
- **Known limitation:** phone-only accounts have no email, so Phase D's
  email↔Google auto-link cannot apply. A phone user who later uses Google
  gets a second account. Manual identity linking (phone↔Google) is an
  explicit follow-up, out of scope for E.

## 6 · Testing

- **Unit:** `trialStatus` table-driven over `daily` shapes (empty, one tab
  only, all tabs but no goal, goal but missing tab, cap reached, healed/partial
  day entries); new `auth.js` functions against the mocked client (pattern of
  `src/lib/auth.test.js`).
- **RTL:** wall renders exactly at the trigger and not before; wall absent
  when authenticated or when auth unconfigured; AuthSheet states
  (email → inbox → code → error); WelcomeGate copy; callback landing states.
- **Merge:** existing guest fold-in tests stand; add one case for
  "trial-exhausted guest signs in and keeps every round".
- **Manual checklist (plan):** production email contains link **and** code;
  code entry in installed PWA; magic link in an external browser; trial wall
  end-to-end on a fresh profile; (D) Google round trip incl. auto-link with a
  pre-existing email account.
- Suite invariants: `npm test`, `npm run lint`, `npm run format:check` green;
  RLS adversarial suite untouched and green.

## 7 · Rollout and division of labor

PR-sized stages, one branch each, per AGENTS.md:

1. **C1 — trial engine + wall UI** (`trial.js`, gameConfig knobs, wall sheet,
   gate copy). Largely Tier A-shaped once this spec has an implementation
   plan.
2. **C2 — AuthSheet + copy + callback landing** (component consolidation,
   code-first copy, error copy).
3. **C3 — template + owner config** (repo template, config.toml, dashboard
   sync, production verification). Claude Code-led: touches prod auth
   delivery.
4. **D — Google OAuth** (auth.js, CTA hierarchy, owner config). Claude
   Code-led for config/security; UI pieces briefable to Cursor.
5. **E — phone OTP**: blocked until the public-ready milestone; then its own
   design-review pass (abuse surface) before an implementation plan.

Claude Code reviews this spec, writes the implementation plans, and owns
config/security stages; well-scoped UI/test missions come back to Cursor as
Tier A briefs in `CURSOR_TASKS.md`.

**Success criteria:** every sign-in email contains a working link and a
working code; one consistent code-first story in the UI; a trial user who
signs in keeps 100% of trial progress; no auth affordance ever renders
without a working backend behind it; signed-in experience unchanged; all
suites green at every stage.

## Open questions routed to the implementation plans

- Exact wall-sheet visual design (tokens, layout at 320px) — C1 plan.
- Whether the goal-completion check uses `QUALIFYING_DAY`'s definition or raw
  `xpForDay ≥ goal` (they coincide today) — C1 plan.
- Template dashboard-sync verification: extend the uptime auth monitor to
  assert the email body contains both `{{ .Token }}` and link markers, or
  keep it a manual checklist item — C3 plan.
- Google OAuth consent-screen branding (app name, logo, domain) — D plan.
