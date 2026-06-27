# Social Platform — Leagues, Leaderboards & Profiles (Design)

**Date:** 2026-06-27
**Status:** Approved design, pending implementation plan
**Arc:** Social Platform (first sub-arc: competitive leagues)

## 1. Goal & Scope

Add a social/competitive layer to deutsch-app that reinforces the existing
streak/XP system. This first sub-arc delivers **weekly XP leagues** in the
Duolingo cohort style: rotating groups of ~25 users compete on weekly XP, with
promotion/relegation across a tier ladder, lightweight public profile cards, and
end-of-week rewards that feed the existing achievement system.

**In scope:** league cohorts, weekly XP race, promotion/relegation ladder,
auto-assigned handles, lightweight read-only profile cards, flat end-of-week
rewards.

**Out of scope (future arcs):** friends/follow graph, activity feeds,
head-to-head, global leaderboard, realtime updates, anonymous (non-synced)
participation.

## 2. Key Decisions (from brainstorm)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Metric = **weekly XP** | Fresh, recurring, casual-friendly; reuses XP system |
| 2 | Scope = **leagues/cohorts (~25)** | Always feels winnable even with a small userbase |
| 3 | Identity = **auto-assigned handle**, renameable | Zero friction, instant population |
| 4 | Participation = **requires sign-in/sync** | One source of truth; social layer becomes a reason to create an account |
| 5 | Cadence = **promotion/relegation + rewards** | Long-term pull; rewards plug into existing achievements |
| 6 | Profile = **lightweight read-only card** | Identity & bragging rights without building/moderating a social network |
| 7 | Rewards = **flat** (winner badge + fixed XP bonus) | Start simple, revisit later |

## 3. Core Constraint

Every existing user table uses **strict own-row RLS** (`auth.uid() = user_id`),
and XP is **derived in JS** (`gamification.js` `xpForDay`) from the private
`stats_daily.counters` jsonb — it is not stored as a counter. A leaderboard
needs cross-user reads, but private SRS/stats data must stay private and the XP
formula must not be duplicated in SQL (drift risk).

**Resolution:** a dedicated, server-maintained leaderboard layer.
- New tables hold only **public, denormalized** competition data.
- A **service-role serverless endpoint** is the sole writer; it reads the
  caller's own private `stats_daily` and computes weekly XP by importing the
  real `gamification.js` formula.
- Member reads are RLS-scoped to **their own league only**.

## 4. Data Model

Two new tables (public-competition data only) plus two columns on `profiles`.

```sql
-- A league instance: one tier, one weekly period, ~25 members
create table public.leagues (
  id           uuid primary key default gen_random_uuid(),
  tier         smallint not null,            -- 0=Bronze..4=Ruby
  period_start date not null,                -- the Monday this league runs
  pack_id      text not null default 'de',   -- Phase-4 interlock
  created_at   timestamptz not null default now()
);

-- A user's placement in one league for one week
create table public.league_members (
  league_id  uuid not null references public.leagues(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  handle     text not null,                  -- denormalized for read
  weekly_xp  integer not null default 0,     -- server-computed from stats_daily
  rank       smallint,                       -- frozen at settlement; null mid-week
  result     text,                           -- 'promoted'|'demoted'|'held'|null
  updated_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

-- profiles gains:
alter table public.profiles add column handle       text unique;
alter table public.profiles add column avatar_emoji text;
```

**RLS:**
```sql
alter table public.leagues        enable row level security;
alter table public.league_members enable row level security;

-- members read only rows of leagues they belong to
create policy "read my league" on public.league_members
  for select using (
    exists (select 1 from public.league_members m
            where m.league_id = league_members.league_id
              and m.user_id = auth.uid())
  );

-- leagues readable to their members (same membership join)
create policy "read my leagues" on public.leagues
  for select using (
    exists (select 1 from public.league_members m
            where m.league_id = leagues.id
              and m.user_id = auth.uid())
  );
```

**No client insert/update/delete policies** on either table — the service-role
endpoint is the sole writer. The `read my league` policy is self-referential
(joins `league_members` to itself); verify it does not recurse under Postgres
RLS during implementation — if it does, fall back to a `security definer`
helper function `is_league_member(league_id, uid)`.

## 5. Server Operations (`api/v1/league/`)

All endpoints sit behind the existing JWT auth middleware (reuse B3's pattern).

**1. Join — `POST /api/v1/league/join`** (idempotent)
- If the caller already has a `league_members` row for the current
  `period_start`, return it.
- Ensure `profiles.handle` is set; generate `Adjective+Noun+NN` if null
  (retry on unique collision).
- Determine tier: previous week's `result` applied to last tier, else Bronze
  for first-timers.
- Find an open league at that tier + current `period_start` with < 25 members;
  create one if none. Insert the member row at `weekly_xp = 0`.

**2. Refresh — `POST /api/v1/league/refresh`** (throttled ≥60s/client)
- Service role reads the caller's `stats_daily` for days ≥ `period_start`,
  sums `xpForDay` (imported from `gamification.js`), upserts the caller's own
  `weekly_xp`. Only ever writes the caller's row → no trust issue, real
  formula, no SQL drift.

**3. Profile — `GET /api/v1/league/profile/:userId`**
- Returns public summary only: handle, avatar_emoji, current tier, total XP,
  longest streak, top 3 achievements. Computes private-derived figures
  (total XP, longest streak) server-side with the real formulas.
- Authorized only if requester shares a current league with `:userId`.

**4. Settle — `POST /api/v1/league/settle`** (Vercel Cron, Mon 00:00 UTC)
- For each league of the just-ended period: sort by `weekly_xp`
  (tie-break: earlier `updated_at` wins), write `rank` + `result`
  (top ~7 `promoted`, bottom ~5 `demoted`, middle `held`), clamp at Bronze
  (no demote) and Ruby (no promote).
- Grant **flat** reward to the week's winner (badge + fixed XP bonus) into the
  existing achievement system.
- Idempotent: guard on whether the period has already been settled.

**Cron config** (`vercel.json`):
```json
{ "crons": [{ "path": "/api/v1/league/settle", "schedule": "0 0 * * 1" }] }
```

**Tier ladder:** Bronze(0) → Silver(1) → Gold(2) → Sapphire(3) → Ruby(4).
Stored as smallint so adding tiers later is trivial.

**Freshness:** cron settlement + refresh-on-view (no realtime/websockets) —
cheap, fits the serverless model, sufficient for a language app. YAGNI.

## 6. Client UI

Inline styles only, tokens from `src/lib/theme.js`, matching existing patterns.

- **`LeaderboardSection.jsx`** — league view: tier badge + name, weekly
  countdown (pure client-side from `period_start`), ranked list of ~25 rows
  (handle, avatar emoji, weekly XP). Promotion zone (top 7) and demotion zone
  (bottom 5) delineated by dividers; caller's own row highlighted. Signed-out
  users see a "Sign in to join a league" teaser.
- **`ProfileCard.jsx`** — read-only card opened by tapping a leaguemate:
  handle, avatar emoji, current tier, total XP, longest streak, top 3
  achievements. Backed by `GET /api/v1/league/profile/:userId`.
- **Handle/avatar editing** — added to the existing `AccountSection`
  (near the Danger Zone): rename handle, pick avatar emoji.

**Mount flow:** `LeaderboardSection` mounts → `POST join` (idempotent) →
`POST refresh` → `select` own-league rows via the Supabase client (RLS-scoped) →
render.

## 7. Testing Strategy

Vitest `globals:false`, explicit imports, never bypass `.husky/pre-commit`.

**Pure-logic unit tests (bulk):**
- Handle generator: format, seeded determinism, collision-retry path.
- Weekly-XP aggregation: synthetic `stats_daily` → assert sum equals
  `xpForDay` summed over the period, days `< period_start` excluded.
  (Highest-value test — pins the "reuse the real formula" guarantee.)
- Settlement (`settleLeague(members) → {rankings, results}` as a pure function):
  top-7 promoted / bottom-5 demoted / middle held, tier clamping at both ends,
  tie-break by `updated_at`, idempotency guard.
- Tier/league assignment: first-timer → Bronze; promoted → next tier; cohort
  fills to 25 then opens a new league.

**Endpoint tests (mock the service-role Supabase client):**
- join idempotent; refresh writes only the caller's row; profile rejects a
  non-leaguemate; all endpoints reject unauthenticated requests.

**RLS:** policy review + one manual integration check against a Supabase branch
before merge (Postgres RLS can't be fully unit-tested locally).

**Not tested:** the Vercel cron scheduler itself — only the `settle` handler.

## 8. Build Sequence (rough)

1. Migration: tables, columns, RLS policies (+ recursion check / helper fn).
2. Pure logic libs: handle generator, weekly-XP aggregation, `settleLeague` —
   with tests.
3. Endpoints: join, refresh, profile (behind JWT middleware) — with tests.
4. Settle endpoint + `vercel.json` cron.
5. Client: `LeaderboardSection`, `ProfileCard`, AccountSection handle/avatar
   editing; wire into App navigation.
6. Manual RLS integration check on a Supabase branch; ship behind a feature
   flag (mirror `VITE_SYNC_ENABLED`, e.g. `VITE_LEAGUES_ENABLED`).
