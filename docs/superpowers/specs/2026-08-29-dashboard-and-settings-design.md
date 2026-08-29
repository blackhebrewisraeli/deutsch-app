# Home dashboard identity + missions, and a dedicated Settings route

- **Date:** 2026-08-29
- **Status:** design, ready for a plan
- **Author:** Claude Code
- **Branch target:** `feat/dashboard-settings-spec` → `main`
- **Scope:** planning only. No `.jsx` or `.sql` is written by this document.

---

## 1 · What this is

Two user-facing features, now that the UI primitives (`Button`, `Surface`, `Text`,
`Heading`, `Layout`, `StatusNote`, `InteractiveCard`) and the security architecture
are in place:

1. **Home dashboard** — an identity strip and an *open missions* board on top of the
   progress glance that already ships.
2. **Settings route** — a dedicated surface for editing personal details and for the
   account danger zone, reached from the header rather than the tab bar.

### 1.1 Premise corrections (read this first)

The brief described both features as new. Three of its assumptions did not survive a
check against the code, and each one changes the work. Recorded here because the repo's
standing lesson is that a stated scope has been wrong seven times running.

| Brief said | Actually true | Consequence |
| --- | --- | --- |
| Build the User Dashboard / Home page | `src/components/HomeTab.jsx` ships today (25 lines) and is the default tab since #152. It already renders `LevelCard` (level, rank, XP-to-next, total XP, learned count) and `GoalRing` + streak. | This is an **extension of two regions**, not a new page. Do not rebuild what renders. |
| Build a Settings page with a Delete Account flow | The delete flow **exists end to end**: `api/v1/account/delete.js` (+ tests), the `DANGER ZONE` two-step confirm in `stats/AccountSection.jsx:170-250`, wired at `App.jsx:431`. Export exists too (`api/v1/account/export.js`). | The gap is **placement and hardening**, not existence. §6 specs the hardening; §5 specs the move. |
| New tables/columns are needed for personal details | `public.profiles` already ships `user_id, display_name, created_at, handle, avatar_emoji`. **`display_name` is written by nothing and read by nothing** — a shipped column with zero call sites. | Settings adopts `display_name`. **No migration is required for Feature 2.** |

Two further constraints found in the code that the design must respect:

- **`HomeTab`'s own design doc records decision E5**
  (`docs/superpowers/specs/2026-08-24-entry-flow-and-home-dashboard-design.md` §7): Home is a
  quick glance; `AccountSection`, `LeaderboardSection`, `TodaySnapshot`, `Heatmap`,
  `PerTabBars`, `AccuracyByLevel`, `ReviewFeed` are *deliberately* excluded, and `HomeTab.test.jsx`
  carries a **negative assertion** enforcing it. Adding "personal details" to Home reverses E5.
  §4.1 supersedes it narrowly and says why.
- **The tab bar is full.** Six tabs ship (`App.jsx:532-539`); nav went icon-only in #153 because
  labels no longer fit, and the 320px header budget is a *measured* 10px. A seventh tab is not
  affordable — hence §5.1.

### 1.2 Decisions taken (confirmed with the product owner, 2026-08-29)

- **D1** — Home gets an **identity strip only**. Email, sync state, export and the danger zone stay
  out of Home and live in Settings. E5 is superseded narrowly, not abandoned.
- **D2** — Settings is a **header-reached route**, not a seventh tab. It costs zero nav budget.
- **D3** — Missions are **derived from existing state** in Phase 1 (no migration). A persisted
  `user_missions` table is specced in full (§7.4) as an optional Phase 2, ready if rotation or
  claimable rewards are ever wanted.

---

## 2 · What already exists (the substrate)

Nothing in §3–§7 introduces a new data source. Everything reads state the app already holds.

**Client state** (all in `localStorage`, key `deutsch-app-state-v1`, synced when signed in):

| Source | Where | Gives us |
| --- | --- | --- |
| `game.lvl`, `totalXp(daily)`, `stats.learnedCount` | `lib/gamification.js`, `lib/stats.js` | level, rank, XP, words learned |
| `game.goal.pct`, `game.goal.met`, `game.streak` | `lib/gamification.js:63` `goalProgress()` | daily goal ring, streak |
| `getReviewItems(items, limit)` | `lib/stats.js:226` | recently-wrong items to revisit |
| `srsKey` boxes + `next_due` | `lib/srs*`, mirrored to `srs_state` | count of cards due now |
| `ACHIEVEMENTS[].test(ctx)` | `lib/gamification.js:74-96` | near-miss badges (streak3/7/14/30 …) |
| `attentionCount` | `App.jsx:542-545` | already-computed "needs attention" number |

**Server state** (Supabase, all RLS-enabled, all FK'd to `auth.users(id) on delete cascade`):

```
profiles       user_id PK, display_name, created_at, handle UNIQUE, avatar_emoji
srs_state      (user_id, pack_id, srs_key) PK, box, last_reviewed, next_due, reps, updated_at
stats_daily    (user_id, pack_id, day) PK, counters jsonb, updated_at
decks          (user_id, pack_id, deck_id) PK, name, cards jsonb, updated_at
settings       user_id PK, data jsonb, updated_at
leagues        id PK, tier, period_start, pack_id
league_members (league_id, user_id) PK, handle, weekly_xp, rank, result, period_start
```

Verified against the live project 2026-08-29: live schema matches
`supabase/migrations/20260611232000_user_tables.sql` + `20260627000000_leagues.sql`. RLS is
enabled on all eight tables.

---

## 3 · Architecture at a glance

```
                 ┌──────────────── header ────────────────┐
                 │ StatusChip · ThemeChip · AccountChip ───┼──▶ "Settings" → route
                 └────────────────────────────────────────┘
   ┌─────────────────────────┐          ┌──────────────────────────────┐
   │ HomeTab (tab 01)        │          │ SettingsRoute (no tab)       │
   │  IdentityStrip   ← new  │          │  ProfileSection      ← new   │
   │  LevelCard       exists │          │  PreferencesSection  ← moved │
   │  GoalRing+streak exists │          │  SyncSection         ← moved │
   │  MissionBoard    ← new  │          │  DangerZone          ← moved │
   └─────────────────────────┘          └──────────────────────────────┘
              │                                        │
              ▼                                        ▼
   lib/missions.js (pure, new)          PATCH /api/v1/account/profile (new)
   derives from local state             DELETE /api/v1/account/delete   (harden)
                                        GET    /api/v1/account/export   (exists)
```

**Rule inherited from the engine:** `lib/missions.js` must be language-blind — no German
strings, no `if (language === 'de')`. Mission copy comes from the pack via `activePack`,
the same way prompts and grammar do (`src/packs/de/`). This is the rule that Phases 1.2–1.5
were built to protect; a hardcoded mission title would be the first regression.

---

## 4 · Feature 1 — Home dashboard

`HomeTab` keeps its current two regions and gains two more. Final order:

1. `IdentityStrip` — **new**
2. `LevelCard` — unchanged
3. `GoalRing` + streak `StatBlock` — unchanged
4. `MissionBoard` — **new**

### 4.1 IdentityStrip (supersedes E5, narrowly)

E5 excluded `AccountSection` from Home — the *account-management* block: email, sign-out,
last-synced, export, danger zone. That exclusion stands unchanged; every one of those
controls moves to Settings (§5), further from Home than it is today.

What D1 adds instead is an **identity** row, not account management: avatar, name, and the
CEFR level chip. It is read-only; its only interactive element is a link into Settings.

```
┌──────────────────────────────────────────────┐
│  (🦊)   Guten Tag, Semion          [ A2 ]    │
│         @semion · Member since Jun 2026      │
└──────────────────────────────────────────────┘
```

- **Composition:** `Surface elevation={1}` › `Row` › avatar + `Stack`(`Heading` level 2,
  `Text tone="muted"`) + existing `StatusChip` for the level.
- **Data:** `profiles.display_name` (falls back to `handle`, then the email local-part, then
  a pack-provided generic greeting), `profiles.avatar_emoji`, `profiles.created_at`,
  `game.lvl`.
- **Guest:** renders with the pack's generic greeting and **no** email/handle/member-since —
  a guest has no `profiles` row at all. The strip must never imply an account exists.
- **Not-signed-in + auth unconfigured:** renders the greeting only. `AccountChip` and
  `AccountSection` both already gate on `isAuthConfigured()`; the strip follows the same gate.
  Note the recorded trap — `isAuthConfigured()` is **true** in local tests and **false** in CI,
  so any test touching this branch must mock `lib/auth`, or it asserts the opposite branch
  depending on the machine.

`HomeTab.test.jsx`'s negative assertion is **kept and extended**, not deleted: it must still
prove `TodaySnapshot`, `Heatmap`, `PerTabBars`, `AccuracyByLevel`, `ReviewFeed`,
`LeaderboardSection` and `AccountSection` do not render on Home. Add to it: no email address
and no `Delete account` control ever appear on Home. That negative test is what keeps D1 from
sliding into "full account page on Home" later.

### 4.2 MissionBoard

Three to five open missions, each an `InteractiveCard` that routes to the tab that clears it.
`InteractiveCard` (not `Surface` + `onClick`) is mandatory — it guarantees a real `<button>`
or `<a>`. Fourteen league rows once shipped as `<li onClick>`, unreachable by Tab and invisible
to a screen reader, through a green 1,600-test suite.

```
MISSIONS
┌────────────────────────────────────────────┐
│ ⏰  12 cards are due          Vocab  →     │
├────────────────────────────────────────────┤
│ 🎯  30 XP to today's goal     Chat   →     │
├────────────────────────────────────────────┤
│ 🔥  Keep a 6-day streak       any    →     │
└────────────────────────────────────────────┘
```

**Empty state is `StatusNote tone="empty"`** with a required `icon` — the primitive
`console.error`s without one. All missions cleared is a *success*, so the copy is a
congratulation, not an apology ("Alles erledigt — nothing due today").

**Failure state is `StatusNote tone="error"`.** Missions are derived from local state, so the
realistic failure is a corrupt/unreadable state blob, not a network error. It must not take the
rest of Home down with it: wrap `MissionBoard` in the existing `ErrorBoundary`, so a throw in
mission derivation still leaves `LevelCard` and the goal ring rendering. Home is the default
tab — a crash here is a crash on app open.

### 4.3 Mission catalogue (Phase 1, all derived)

| id | Fires when | Routes to | Source |
| --- | --- | --- | --- |
| `srs-due` | due-card count > 0 | `vocab` | `srs_state.next_due` / local SRS boxes |
| `goal-remaining` | `!game.goal.met` | last-used tab, else `chat` | `goalProgress()` |
| `streak-risk` | `streak > 0 && !goal.met && local hour ≥ 18` | any | `game.streak` + clock |
| `revisit-wrong` | `getReviewItems().length > 0` | item's own tab | `lib/stats.js:226` |
| `deck-unfinished` | a started deck is < 100% | `vocab` | `DeckProgress` state |
| `league-position` | `LEAGUES_ENABLED` && rank in demotion zone | `stats` | `league_members` |
| `badge-near` | an achievement is within one step | any | `ACHIEVEMENTS[].test` |

**Ordering:** fixed priority `srs-due > streak-risk > goal-remaining > revisit-wrong >
deck-unfinished > league-position > badge-near`, then cap at 5. A deterministic order keeps
the board from reshuffling under the user's finger between renders, and makes it testable.

`lib/missions.js` exports one pure function — no storage reads, no DOM, mirroring
`lib/gamification.js`'s "PURE (no storage/DOM)" contract:

```
deriveMissions({ srsDue, goal, streak, reviewItems, decks, league, achievements, now, pack })
  → [{ id, kind, count, tab, priority }]
```

It returns **data, not copy**. Rendering resolves each `id` to a pack string. That is what
keeps the engine language-blind, and it is why `now` is injected rather than read from
`Date.now()` inside — `streak-risk` depends on the local hour and must be testable without
faking global time.

### 4.4 What Home does **not** get

No accuracy breakdown, no heatmap, no leaderboard table, no account management, no export.
Stats remains the deep dive. `home` also stays out of `TABS` in `lib/stats.js:23` — it is
excluded from the trial wall and per-tab accuracy exactly as `stats` is.

---

## 5 · Feature 2 — Settings

### 5.1 Placement

`AccountChip`'s sheet (`AccountChip.jsx`) today shows email + sign out and defers everything
else to Stats. It gains a **`Settings →`** item that opens the route; the sheet stays the
"glance + escape", and Settings becomes the "full management" it already points at.

- **No seventh tab** (D2). The nav budget at 320px is a measured 10px.
- Rendered as a full-screen route/overlay over the current tab, returning to it on close.
- **`AccountChip`'s sheet is non-modal and must not be focus-trapped** — a guard test enforces
  that the three header chips stay untrapped. The Settings *route*, once open, is a different
  surface and takes the standard `useFocusTrap` treatment.
- Reachable at `#/settings` so it deep-links and survives reload.

### 5.2 Sections

| Section | Contents | Backing store |
| --- | --- | --- |
| **Profile** | display name, handle, avatar emoji | `profiles` via `PATCH /api/v1/account/profile` |
| **Learning** | CEFR level, daily goal, sound on/off | `settings.data` via the existing sync engine |
| **Appearance** | Light/Dark | existing `AppearancePicker` / `ThemeChip`, `localStorage` |
| **Sync** | email, last-synced, sign out, export | existing `AccountSection` logic |
| **Danger zone** | delete account | `DELETE /api/v1/account/delete` (§6) |

**This is a move, not a rewrite.** The Profile, Sync and Danger-zone markup already exists in
`stats/AccountSection.jsx` (255 lines). Extract it; do not re-author it. After the move, Stats
keeps a one-line pointer ("Manage your account in Settings →"). Its existing
`AccountSection.test.jsx` should travel with the component and keep passing — a test file that
asserts DOM rather than internals survives a move untouched, as the `VocabTab` split proved.

Note the current handle/avatar editor is gated behind `LEAGUES_ENABLED`. In Settings, **handle
and avatar are profile fields, not league fields** — they ungate. Only the league-standings
readout stays behind the flag. Both flag states need a test; the recorded lesson is that the
*shipping* flag combination is the one that had no coverage.

### 5.3 Level control — do not fork it

Level lives in one control today: `StatusChip` in the header, with `LevelSwitcher` inside.
Settings must **reuse `LevelSwitcher`**, not build a second level UI. Two reasons: consolidating
it was deliberate work, and level carries its **own LWW timestamp** (`levelUpdatedAt`,
decoupled from `settingsUpdatedAt`) after a stale device clobbered a correct server-side level
in production (PR #151). A second write path is a second chance to reintroduce that bug.

Whatever writes level from Settings must stamp `levelUpdatedAt` the same way, via
`lib/levelPref.js` + `settingsToRow()` — not by hand.

### 5.4 State management

- **Preferences** (level, goal, sound) already flow through the sync engine
  (`lib/sync.js` + `lib/sync/adapters.js:46` `settingsToRow`). Settings **writes local state and
  lets the existing reconcile push it.** It must not call Supabase directly for these — that
  would bypass the LWW merge and reintroduce clobbering.
- **Profile fields** are *not* in `settings.data` and are not part of the LWW blob. They are a
  direct server write, with the response as the source of truth (the server owns handle
  uniqueness). Optimistic UI is wrong here: `handle` can be rejected as taken.
- **Form model:** local `useState` per section, explicit **Save** per section, dirty-tracking to
  disable Save when unchanged. Per-section rather than one page-wide Save, because Profile is a
  network round-trip that can fail on conflict while Learning is a local write that cannot.
- **Feedback:** existing `Toast` on success; inline `StatusNote tone="error"` on failure.
  `Button` already owns a `pending` spinner — use it rather than a bespoke saving state.

---

## 6 · Account deletion architecture

### 6.1 How it works today

`api/v1/account/delete.js`:

1. `requireAuth(req)` → validates the Supabase JWT via the service-role client → `userId`.
2. Loops `['srs_state', 'stats_daily', 'settings']`, deleting `where user_id = userId`.
3. `db.auth.admin.deleteUser(userId)`.
4. `204`.

The client (`App.jsx:431`) then clears local state via `lib/clearUserState.js`.

### 6.2 Findings — three defects in the current flow

**(a) The explicit delete loop is redundant, and it manufactures the exact failure B3 forbade.**

Every user-owned table declares `references auth.users(id) on delete cascade` —
`profiles`, `srs_state`, `stats_daily`, `decks`, `settings`, `league_members`. Deleting the
auth user therefore already removes every row. Step 2 deletes three of those tables a second
time.

That redundancy is not harmless. The loop runs **before** `deleteUser`, so if the loop succeeds
and `deleteUser` fails, the result is: *all learning data destroyed, account still live and
signable-into*. The B3 design's own requirement was "no silent half-deletes"
(`2026-06-27-backend-b3-export-delete-design.md`). The current ordering is the one sequence
that produces one.

The loop also omits `decks` — which is *fine*, because cascade covers it. That omission is the
proof that the loop was never the safety mechanism. **The FK cascade is.**

> **Recommendation:** delete the auth user and nothing else. One call, one atomic
> server-side cascade, no partial state reachable. Keep a post-delete assertion in the RLS
> suite (`npm run test:rls`) proving zero rows survive in all six tables — that test is what
> lets the explicit loop go, and it belongs with the cascade it is protecting.

**(b) No rate limiting and no origin check on the account lane.** `createAiHandler`
(`api/_lib/handler.js`) provides `originAllowed` + `createRateLimiter`, and only the three AI
endpoints use it. `delete.js` and `export.js` have `requireAuth` and nothing else. Export is the
sharper of the two — it returns the user's whole dataset in one response and can be called in a
loop.

**(c) Errors are swallowed.** `catch { return sendError(res, 'server_error', …) }` binds no
error, so a partial delete is undiagnosable — nothing reaches the logs and nothing reaches a
human.

> **Correction (2026-08-29).** An earlier draft of this section said the failure "reaches no
> Sentry" and that "Sentry is live on prod+preview, so this path should report". That is wrong,
> and it matters because it made a fix sound available that is not. Sentry here is **client-only**:
> `@sentry/react` ships in the browser bundle and `src/lib/observability.js` reads
> `import.meta.env`, so neither can run inside a Vercel Node function. **There is no server-side
> error reporting in this project at all.** The reporting channel that actually exists for
> serverless code is `console.error`, which Vercel captures in function logs — the precedent set
> by `api/_lib/handler.js:42` and `api/_lib/ratelimit.js:68`. Adding server-side Sentry
> (`@sentry/node`, a second DSN, and env wiring — note `SENTRY_AUTH_TOKEN` is still dormant) is a
> separate piece of work and is **not** part of this design.

### 6.3 Target architecture

Keep it a **Vercel serverless function**, not a Supabase Edge Function. `deleteUser` needs the
service-role key, which already lives in Vercel env (Production + Preview only, non-pullable —
hardened in #155), and `requireAuth` + `serviceClient` + the tested `respond` helpers are
already there. An Edge Function would mean a second place to hold the service-role key for no
gain.

```
DELETE /api/v1/account/delete
   │
   ├─ 1. originAllowed(req)                        ← new, reuse lib/origin.js
   ├─ 2. rate limit, tight quota                   ← new, reuse lib/ratelimit.js
   ├─ 3. requireAuth(req) → userId                 ← exists
   ├─ 4. reauth gate: amr auth age < 15 min,       ← new
   │       else 401 reauth_required
   │       NOT session age / iat — see below
   ├─ 5. body: { confirm: "DELETE" } must match    ← new
   ├─ 6. auth.admin.deleteUser(userId)             ← exists; now the ONLY write
   │       └─ Postgres cascades all six tables
   ├─ 7. on failure: console.error(endpoint,       ← new
   │       userId, cause) — see the §6.2(c)
   │       correction; there is NO server Sentry
   └─ 8. 204
   │
client ─ 9. clearUserLocalState() + signOut + hard reload   ← exists
```

**On step 4 (re-authentication).** This is the single biggest gap between "has a confirm
dialog" and "highly secure". Today a borrowed or stolen session can destroy the account with
two clicks and no credential. The gate: if the caller authenticated more than 15 minutes ago,
return `401 reauth_required`; the client re-authenticates (magic link, or Google re-consent)
and retries. Both providers are live, so no new auth surface is needed.

> **Which claim measures that — corrected 2026-08-29, during implementation.** This section
> originally said "session age", whose obvious reading is the token's `iat`. That reading would
> have produced security theatre, and it was worth measuring rather than assuming. Verified
> against a real Supabase (sign in, refresh two seconds later, same `session_id`):
>
> | claim | at sign-in | after refresh | |
> | --- | --- | --- | --- |
> | `iat` | 1787977058 | 1787977**064** | **changed** |
> | `amr[0].timestamp` | 1787977058 | 1787977058 | **unchanged** |
>
> `iat` is reissued on every access-token refresh, and supabase-js refreshes in the background
> for the life of the refresh token — so a session stolen weeks ago presents a minutes-old `iat`
> and would sail straight through the gate it is supposed to fail. **`amr` is the only claim that
> records when the human actually proved who they were**, and it survives refreshes. Signing in
> again mints a new `amr` timestamp, which is what lets the gate be satisfied at all (also
> verified). Magic link — this app's actual method — yields `[{method:'otp', timestamp}]`, the
> same shape as password.
>
> `amr` is optional and may arrive in the RFC-8176 string form with no timestamps, so "unknown"
> is a real outcome: the implementation **fails closed** and asks for re-authentication rather
> than silently disabling the gate. Logic and rationale live in `api/_lib/authTime.js`.
>
> One consequence worth stating plainly: because `amr` only advances on a real sign-in and
> sessions here survive for weeks, **nearly every deletion will hit the re-auth prompt**. The
> window is therefore less "was your session fresh?" and more "you have this long, after proving
> who you are, to finish confirming".

**On step 5,** a typed `DELETE` confirmation replaces the current second button. The two-step
button in `AccountSection.jsx:200-247` is a mis-click guard, not an intent guard.

**On step 9,** `signOutAndReset()` (`lib/clearUserState.js:66`) already owns the load-bearing
order — sign out settles, *then* local state clears. Reuse it; do not re-implement the order.
`PRESERVED_LOCAL_KEYS` correctly keeps the theme choice, which is a device preference and not
user data.

### 6.4 Why RLS is not the mechanism here

Worth stating plainly, because the brief proposed leaning on RLS for the cascade. RLS constrains
what the *`authenticated` role* may read and write. This endpoint runs as **service-role, which
bypasses RLS entirely**. So RLS is not what makes the deletion safe — the FK cascade is, and
`requireAuth` is what makes it *the right user's* deletion.

RLS's real job here is the ordinary case: `profiles` has `select`/`insert`/`update own` policies
and **deliberately no delete policy** — the migration comment says so — so a client can never
delete its own profile row out from under the cascade. That boundary is already correct and this
work must not add a delete policy to `profiles`.

---

## 7 · Supabase interactions

### 7.1 Reads

| Need | Query | Path |
| --- | --- | --- |
| identity strip | `select display_name, handle, avatar_emoji, created_at from profiles where user_id = auth.uid()` | client, RLS `select own profile` |
| due count | already local; `srs_state` mirrors it via sync | no new query |
| goal / streak / level | `settings.data` via existing reconcile | no new query |
| league standing | existing `fetchMyResults` / `/api/v1/league/profile` | unchanged |

The identity read is the **only new query**, it is own-row, and the existing
`select own profile` policy already permits it. **No RLS change is required for Feature 1.**

### 7.2 Writes

| Field | Path | Why |
| --- | --- | --- |
| `display_name`, `handle`, `avatar_emoji` | `PATCH /api/v1/account/profile` (service-role) | handle is `UNIQUE` and is **denormalized onto `league_members`**; both need server-side handling |
| level, goal, sound | local state → existing sync reconcile | preserves LWW and `levelUpdatedAt` |

**New endpoint `PATCH /api/v1/account/profile`.** `api/v1/league/handle.js` already does exactly
this job — validates auth, patches `profiles`, maps Postgres `23505` to "That handle is taken",
and re-syncs `league_members.handle` so a rename reaches the standings. The new endpoint should
**generalise that one to accept `display_name`** and live under `account/`, with
`league/handle` kept as a thin alias or retired once no caller remains. Writing a second
profile-patching endpoint that forgets the `league_members` denormalisation is the predictable
regression.

Client-direct writes are technically permitted (`update own profile` is granted to
`authenticated`), but the app has never used that path — every profile write goes through a
service-role endpoint. Keep it that way: the uniqueness conflict and the denormalisation both
need the server.

### 7.3 Feature 2 needs no migration

`display_name` already exists and is unused. Adopting it is a code change, not a schema change.

### 7.4 Optional Phase 2 — `user_missions`

Not needed for D3's derived board. Specced so it is ready if rotation or claimable rewards are
wanted later. **Do not create this table as part of Phase 1.**

```
user_missions
  user_id     uuid not null references auth.users(id) on delete cascade
  pack_id     text not null default 'de'
  mission_id  text not null
  period      date not null          -- the day/week this instance belongs to
  progress    integer not null default 0
  target      integer not null
  claimed_at  timestamptz
  updated_at  timestamptz not null default now()
  primary key (user_id, pack_id, mission_id, period)
```

Rules it must follow, matching the six tables that already exist:

- `on delete cascade` from `auth.users(id)` — so §6's cascade keeps covering everything and
  the delete endpoint still needs no table list.
- `pack_id` default `'de'` — the Phase 4 interlock every user table carries.
- RLS enabled, with `select`/`insert`/`update own` policies. **No client `delete` policy**, and
  **no client write to `claimed_at`** — a claimable reward must be server-authoritative or it is
  a client-side XP faucet. Claiming goes through a service-role endpoint.
- Explicit grants, matching `20260612201311_data_api_explicit_grants.sql`; new tables are not
  granted by default in this project and an event trigger enforces RLS on creation
  (`20260827000000_ensure_rls_event_trigger.sql`).
- Add it to the RLS suite (`npm run test:rls`) and to the §6.3 post-delete zero-rows assertion.

---

## 8 · UI composition

Everything composes the existing primitives. No new primitive is introduced, and no component
in this work sets a colour, radius, shadow, font family or font size directly — those come from
`lib/theme.js` through the primitives. `tokenBoundary.test.js` and `noHardcodedHex.test.js`
already enforce this.

| New component | Composes |
| --- | --- |
| `IdentityStrip` | `Surface`, `Row`, `Stack`, `Heading`, `Text`, existing `StatusChip` |
| `MissionBoard` | `Stack`, `Heading`, `InteractiveCard`, `StatusNote`, `ErrorBoundary` |
| `SettingsRoute` | `PageFrame`, `Stack`, `Heading`, `Surface` |
| `ProfileSection` | `Surface`, `Stack`, `Button`, `Toast`, `StatusNote` |
| `DangerZone` | extracted from `AccountSection`; `Surface`, `Button variant="danger"` |

Constraints carried in from the recorded lessons:

- **Grid tracks are `minmax(0, 1fr)`, never a bare `1fr`.** A `1fr` track keeps
  `min-width: auto` and pushes the page wider than the viewport; this caused mobile overflow in
  four separate places.
- **Verify at 375px *and* 320px, with a populated account.** A fresh account hides the freeze
  chip, high levels and long rank names — exactly the content that overflows.
- **Compute any responsive clamp in JS, not CSS.** `min(400px, calc(100vw - 16px))` reads back
  from jsdom mangled, so a CSS-only clamp has no assertable form in tests.
- **A11y:** `aria-label` on every icon-only button; visible focus; `StatusNote`'s live region is
  already correct — don't add a second one around it.
- **Icon-only `Button variant="icon"` requires an `aria-label`** or it `console.error`s.

---

## 9 · Testing

Co-located `*.test.jsx`, Vitest with `globals: false` (import `describe/it/expect/vi` from
`'vitest'`).

- `missions.test.js` — pure derivation. Each mission's fire/don't-fire boundary, the priority
  order, the cap at 5, and the empty case. Inject `now` for `streak-risk`; do not fake global time.
- `MissionBoard.test.jsx` — renders `InteractiveCard`s (assert real `button`/`a` elements, and
  that each is reachable by Tab); empty → `StatusNote tone="empty"`; a throw in derivation is
  contained by `ErrorBoundary` and leaves `LevelCard` rendered.
- `IdentityStrip.test.jsx` — signed-in vs guest vs auth-unconfigured. **Mock `lib/auth`** —
  `isAuthConfigured()` is true locally and false in CI, so an unmocked test asserts a different
  branch on each machine.
- `HomeTab.test.jsx` — **extend the existing negative assertion**, don't replace it: still no
  Stats-exclusive components, and now also no email and no delete control.
- `SettingsRoute.test.jsx` — section rendering; focus trap active on the route; **a guard that
  the three header chips remain untrapped**; Escape closes and returns focus to `AccountChip`.
- `ProfileSection.test.jsx` — dirty-tracking disables Save; `23505` surfaces "That handle is
  taken" without clearing the field; success toasts. Both `LEAGUES_ENABLED` states via
  `describe.each` — the shipping flag combination is the one that historically had no test.
- `AccountSection.test.jsx` — travels with the component; should pass unmoved.
- `delete.test.js` — *done in PR #191*: the endpoint issues **exactly one** delete and touches no
  table directly (this is what pins §6.3's "cascade is the mechanism"), failures are logged with
  endpoint + user + cause, and a repeat caller is rate limited. Still owed by 7b:
  `reauth_required` on a stale session, and a wrong `confirm` string rejected.
- **RLS suite** (`npm run test:rls`, Docker + `supabase start`, excluded from `npm test`) —
  *done in PR #191* as `supabase/tests/rls/cascade.test.js`: post-delete zero rows across all six
  user-owned tables, the shared `leagues` row surviving, and a pre-delete assertion that the
  fixture is actually populated — an empty table and a correctly cascaded one otherwise print
  identically.

**On fixtures.** Several of these assertions are only meaningful against a *populated* account.
A fixture with no due cards, no streak and no league row cannot express a missions failure, and
a board test written against it passes for the wrong reason. Build the enriched fixture first,
confirm each assertion fails without its feature, then write the assertion.

---

## 10 · Phasing

Each row is one PR, branched from an up-to-date `main`, landing green through
`.husky/pre-commit` (lint-staged + the full suite; `--no-verify` is forbidden).

| # | PR | Touches | Migration |
| --- | --- | --- | --- |
| 1 | `lib/missions.js` + tests — pure, no UI | 2 files | none |
| 2 | `MissionBoard` + wire into `HomeTab` | 4 files | none |
| 3 | `IdentityStrip` + `HomeTab` negative-test extension | 4 files | none |
| 4 | `SettingsRoute` shell + `AccountChip` entry + focus trap | 5 files | none |
| 5 | Move `AccountSection` → Settings sections; Stats keeps a pointer | ~8 files | none |
| 6 | `PATCH /api/v1/account/profile` (generalise `league/handle`) + `ProfileSection` | ~5 files | none |
| 7a | **Merged in PR #191** (`afa9a02`) — the three §6.2 defects: cascade-only delete, account-lane origin + rate limits, bound error logging, RLS zero-rows suite | 7 files | none |
| 7b | **Done** — re-auth gate (amr-based) + typed `DELETE` confirmation + step 9 reset | 9 files | none |
| — | *Optional Phase 2:* `user_missions` (§7.4) | — | **yes** |

PRs 1–7 require **no migration at all**. Land 1→7 in order; 5 must land before 6 so the profile
form has a home. 7a was independent of 1–6 and has already merged, so the §6.2 defects it describes are fixed on
`main` — read §6.2 as the record of what was wrong, not as a live bug report.

Deliberately excluded from every PR above: any change to `lib/stats.js`'s `TABS`, any storage-key
rename (Phase 4), any `card.de` rename, and any second language pack.

---

## 11 · Open questions

1. ~~**Re-auth window.**~~ **Resolved: 15 minutes**, as `REAUTH_MAX_AGE_SEC` in
   `api/v1/account/delete.js`. Measurement changed what the number means — since `amr` only
   advances on a real sign-in, nearly every deletion re-authenticates regardless, so the window
   is the grace period for finishing the confirmation rather than a freshness filter. 15 is
   forgiving for an interrupted user and barely widens the one exposure it leaves (a device
   taken within 15 minutes of a genuine sign-in). One constant to change if that reads wrong.
2. **Does `display_name` need a uniqueness or profanity rule?** `handle` is `UNIQUE` and public
   on the leaderboard. `display_name` is currently private to Settings and Home — but if it ever
   surfaces in leagues, it inherits the moderation question that `handle` already has.
3. **Should export get the same re-auth gate as delete?** It returns the entire dataset in one
   response. Still open — but now cheap: `createAccountHandler` takes `recentAuthMaxAgeSec`, so
   export adopts the gate by adding one line. Deliberately not done unasked, because it makes a
   non-destructive action materially more annoying.
