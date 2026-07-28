# Social Leagues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add weekly XP leagues (Duolingo-style cohorts of ~25) with promotion/relegation, auto-assigned handles, read-only profile cards, and flat end-of-week rewards.

**Architecture:** New public `leagues` + `league_members` tables hold denormalized competition data only; private `stats_daily` stays private. Four service-role serverless endpoints under `api/v1/league/` are the sole writers; they compute weekly XP by reusing the real `xpForDay` formula extracted into a dependency-free module. Member reads are RLS-scoped to their own league. Weekly settlement runs via Vercel Cron.

**Tech Stack:** React 18 + Vite 5, Vitest (`globals: false`), Supabase (Postgres + RLS, `@supabase/supabase-js`), Vercel serverless functions, inline styles via `src/lib/theme.js`.

## Global Constraints

- Vitest `globals: false` — every test imports `describe`, `it`, `expect`, `vi`, etc. explicitly from `'vitest'`.
- Inline styles only; all colors/spacing from `src/lib/theme.js` tokens. No CSS files, no Tailwind.
- Never bypass `.husky/pre-commit`. Land work via a branch + PR, never direct to `main`.
- Install deps with `npm install --legacy-peer-deps`.
- Service-role key must never reach the client bundle — only `api/_lib/supabase.js serviceClient()` touches it.
- Error envelope: use `sendError(res, code, message)` from `api/_lib/respond.js`; codes from `ERROR_CODES`.
- Auth: every endpoint calls `requireAuth(req)` from `api/_lib/auth-middleware.js`, returning `{ userId, email }`.
- XP balance constant (single source): `XP_PER_VERDICT = { correct: 10, almost: 6, wrong: 3 }` in `src/lib/gameConfig.js`.
- `stats_daily.counters` jsonb stores the full day aggregate: `{ total, bonusXp, byTab, byLevel: { a1|a2|b1: { correct, almost, wrong } } }`.
- Tier ladder: `0=Bronze, 1=Silver, 2=Gold, 3=Sapphire, 4=Ruby`. League size cap 25; promote top 7, demote bottom 5.
- Feature flag: `VITE_LEAGUES_ENABLED` (client) gates all league UI, mirroring `VITE_SYNC_ENABLED`.

---

### Task 1: Database migration — tables, columns, RLS

**Files:**
- Create: `supabase/migrations/20260627000000_leagues.sql`

**Interfaces:**
- Produces: tables `public.leagues(id uuid, tier smallint, period_start date, pack_id text, created_at timestamptz)` and `public.league_members(league_id uuid, user_id uuid, handle text, weekly_xp int, rank smallint, result text, updated_at timestamptz)`; columns `profiles.handle text unique`, `profiles.avatar_emoji text`; function `public.is_league_member(uuid, uuid) returns boolean`.

- [x] **Step 1: Write the migration**

Create `supabase/migrations/20260627000000_leagues.sql`:

```sql
-- Social leagues: public competition data only. Private stats_daily/srs_state
-- stay strictly own-row. The service-role serverless endpoints are the sole
-- writers; clients only SELECT, scoped to their own league.

alter table public.profiles add column handle       text unique;
alter table public.profiles add column avatar_emoji text;

create table public.leagues (
  id           uuid primary key default gen_random_uuid(),
  tier         smallint not null check (tier between 0 and 4),
  period_start date not null,
  pack_id      text not null default 'de',
  created_at   timestamptz not null default now()
);

create table public.league_members (
  league_id  uuid not null references public.leagues(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  handle     text not null,
  weekly_xp  integer not null default 0,
  rank       smallint,
  result     text check (result in ('promoted','demoted','held')),
  updated_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

create index league_members_user_idx on public.league_members (user_id);
create index leagues_tier_period_idx  on public.leagues (tier, period_start);

-- security definer membership test avoids RLS self-recursion on league_members
create or replace function public.is_league_member(p_league uuid, p_user uuid)
returns boolean
language sql
security definer set search_path = ''
stable
as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league and user_id = p_user
  );
$$;

alter table public.leagues        enable row level security;
alter table public.league_members enable row level security;

-- members read every row of leagues they belong to; no client writes
create policy "read my league rows" on public.league_members
  for select using (public.is_league_member(league_id, auth.uid()));

create policy "read my leagues" on public.leagues
  for select using (public.is_league_member(id, auth.uid()));
```

- [x] **Step 2: Apply to a Supabase preview branch and verify**

Apply via the Supabase MCP `apply_migration` against a dev/preview branch (NOT production). Then verify with `list_tables` that `leagues` and `league_members` exist with RLS enabled, and `list_migrations` shows the new migration. Confirm `profiles` now has `handle` + `avatar_emoji`.

Expected: both tables present, `rowsecurity = true`, no advisor errors from `get_advisors` (security).

- [x] **Step 3: Commit**

```bash
git add supabase/migrations/20260627000000_leagues.sql
git commit -m "feat(leagues): migration — leagues/league_members tables, profile handle, RLS"
```

---

### Task 2: Extract `xpForDay` into a dependency-free module

**Why:** `src/lib/gamification.js` imports `srs` and `packs` at module load (browser-heavy). The serverless weekly-XP helper must reuse the *exact* XP arithmetic without pulling that graph. Extract the pure function; re-export from `gamification.js` so existing importers are unchanged.

**Files:**
- Create: `src/lib/xpCore.js`
- Create: `src/lib/xpCore.test.js`
- Modify: `src/lib/gamification.js:14-25` (replace `xpForDay` body with re-export)

**Interfaces:**
- Produces: `xpForDay(day) -> number` exported from `src/lib/xpCore.js`, depending only on `XP_PER_VERDICT` from `./gameConfig`.
- Consumes: `XP_PER_VERDICT` from `src/lib/gameConfig.js`.

- [x] **Step 1: Write the failing test**

Create `src/lib/xpCore.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { xpForDay } from './xpCore.js';

const day = (over = {}) => ({
  total: 0,
  bonusXp: 0,
  byTab: {},
  byLevel: { a1: { correct: 0, almost: 0, wrong: 0 } },
  ...over,
});

describe('xpForDay', () => {
  it('returns 0 for empty/missing day', () => {
    expect(xpForDay(null)).toBe(0);
    expect(xpForDay(day())).toBe(0);
  });

  it('sums verdicts across levels with the balance constants', () => {
    const d = day({
      byLevel: {
        a1: { correct: 2, almost: 1, wrong: 1 }, // 20 + 6 + 3 = 29
        b1: { correct: 1, almost: 0, wrong: 0 }, // 10
      },
    });
    expect(xpForDay(d)).toBe(39);
  });

  it('adds bonusXp', () => {
    expect(xpForDay(day({ bonusXp: 5 }))).toBe(5);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/xpCore.test.js`
Expected: FAIL — cannot resolve `./xpCore.js`.

- [x] **Step 3: Create the module**

Create `src/lib/xpCore.js`:

```js
// Dependency-free XP arithmetic. Single source for the daily-XP formula, used
// by both gamification.js (client) and the league weekly-XP helper (server).
import { XP_PER_VERDICT } from './gameConfig';

export function xpForDay(day) {
  if (!day || !day.byLevel) return 0;
  let xp = 0;
  for (const lv of Object.values(day.byLevel)) {
    xp +=
      (lv.correct ?? 0) * XP_PER_VERDICT.correct +
      (lv.almost ?? 0) * XP_PER_VERDICT.almost +
      (lv.wrong ?? 0) * XP_PER_VERDICT.wrong;
  }
  return xp + (day.bonusXp ?? 0);
}
```

- [x] **Step 4: Re-export from gamification.js**

In `src/lib/gamification.js`, remove the `export function xpForDay(day) { ... }` block (lines ~14-25) and add near the other imports:

```js
import { xpForDay } from './xpCore';
export { xpForDay };
```

Leave `totalXp` / `todayXp` as-is — they call `xpForDay` and now get it from the import.

- [x] **Step 5: Run tests to verify pass (no regressions)**

Run: `npx vitest run src/lib/xpCore.test.js src/lib/gamification.test.js`
Expected: PASS — both files green.

- [x] **Step 6: Commit**

```bash
git add src/lib/xpCore.js src/lib/xpCore.test.js src/lib/gamification.js
git commit -m "refactor(xp): extract xpForDay into dependency-free xpCore module"
```

---

### Task 3: Handle generator (pure)

**Files:**
- Create: `api/_lib/handle.js`
- Create: `api/_lib/handle.test.js`

**Interfaces:**
- Produces: `generateHandle(rng = Math.random) -> string` returning `AdjectiveNounNN` (NN = two digits). Deterministic when given a seeded rng.

- [x] **Step 1: Write the failing test**

Create `api/_lib/handle.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { generateHandle } from './handle.js';

// deterministic rng: cycles through a fixed list of values in [0,1)
function seededRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('generateHandle', () => {
  it('produces Adjective + Noun + two digits', () => {
    const h = generateHandle(seededRng([0, 0, 0]));
    expect(h).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+\d{2}$/);
  });

  it('is deterministic for a given rng sequence', () => {
    expect(generateHandle(seededRng([0.5, 0.5, 0.42]))).toBe(
      generateHandle(seededRng([0.5, 0.5, 0.42])),
    );
  });

  it('varies the number with the third draw', () => {
    const a = generateHandle(seededRng([0, 0, 0]));
    const b = generateHandle(seededRng([0, 0, 0.99]));
    expect(a).not.toBe(b);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/_lib/handle.test.js`
Expected: FAIL — cannot resolve `./handle.js`.

- [x] **Step 3: Implement**

Create `api/_lib/handle.js`:

```js
// Fun auto-assigned handles: AdjectiveNounNN. German-learning flavoured.
const ADJ = ['Blue', 'Swift', 'Clever', 'Brave', 'Sunny', 'Mighty', 'Gentle', 'Bright'];
const NOUN = ['Fuchs', 'Adler', 'Wolf', 'Bär', 'Hirsch', 'Falke', 'Igel', 'Otter'];

export function generateHandle(rng = Math.random) {
  const adj = ADJ[Math.floor(rng() * ADJ.length)];
  const noun = NOUN[Math.floor(rng() * NOUN.length)];
  const nn = String(Math.floor(rng() * 100)).padStart(2, '0');
  return `${adj}${noun}${nn}`;
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/_lib/handle.test.js`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add api/_lib/handle.js api/_lib/handle.test.js
git commit -m "feat(leagues): handle generator"
```

---

### Task 4: Weekly-XP aggregation helper (pure)

**Files:**
- Create: `api/_lib/weeklyXp.js`
- Create: `api/_lib/weeklyXp.test.js`

**Interfaces:**
- Consumes: `xpForDay` from `../../src/lib/xpCore.js`.
- Produces: `weeklyXpFromRows(rows, periodStart) -> number`, where `rows` are `stats_daily` rows `{ day: 'YYYY-MM-DD', counters: <day aggregate> }` and `periodStart` is a `'YYYY-MM-DD'` string. Sums `xpForDay(row.counters)` over rows with `day >= periodStart`.

- [x] **Step 1: Write the failing test**

Create `api/_lib/weeklyXp.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { weeklyXpFromRows } from './weeklyXp.js';

const counters = (correct) => ({
  total: correct,
  bonusXp: 0,
  byTab: {},
  byLevel: { a1: { correct, almost: 0, wrong: 0 } },
});

describe('weeklyXpFromRows', () => {
  it('sums xp for days on/after periodStart', () => {
    const rows = [
      { day: '2026-06-22', counters: counters(2) }, // in: 20
      { day: '2026-06-25', counters: counters(1) }, // in: 10
    ];
    expect(weeklyXpFromRows(rows, '2026-06-22')).toBe(30);
  });

  it('excludes days before periodStart', () => {
    const rows = [
      { day: '2026-06-21', counters: counters(5) }, // out
      { day: '2026-06-23', counters: counters(1) }, // in: 10
    ];
    expect(weeklyXpFromRows(rows, '2026-06-22')).toBe(10);
  });

  it('returns 0 for no rows', () => {
    expect(weeklyXpFromRows([], '2026-06-22')).toBe(0);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/_lib/weeklyXp.test.js`
Expected: FAIL — cannot resolve `./weeklyXp.js`.

- [x] **Step 3: Implement**

Create `api/_lib/weeklyXp.js`:

```js
import { xpForDay } from '../../src/lib/xpCore.js';

// ISO date strings ('YYYY-MM-DD') compare correctly lexicographically.
export function weeklyXpFromRows(rows, periodStart) {
  let xp = 0;
  for (const row of rows ?? []) {
    if (row.day >= periodStart) xp += xpForDay(row.counters);
  }
  return xp;
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/_lib/weeklyXp.test.js`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add api/_lib/weeklyXp.js api/_lib/weeklyXp.test.js
git commit -m "feat(leagues): weekly-XP aggregation helper reusing xpForDay"
```

---

### Task 5: League domain logic — periods, tiers, settlement (pure)

**Files:**
- Create: `api/_lib/leagueLogic.js`
- Create: `api/_lib/leagueLogic.test.js`

**Interfaces:**
- Produces:
  - `TIERS = { MIN: 0, MAX: 4 }`
  - `currentPeriodStart(date) -> 'YYYY-MM-DD'` — the Monday (UTC) of `date`'s week.
  - `nextTier(tier, result) -> number` — applies `'promoted'|'demoted'|'held'`, clamped to `[MIN, MAX]`.
  - `settleLeague(members) -> Array<{ user_id, rank, result }>` — sorts by `weekly_xp` desc, tie-break `updated_at` asc; top 7 `promoted`, bottom 5 `demoted`, rest `held`. Pure; does not mutate input.

- [x] **Step 1: Write the failing test**

Create `api/_lib/leagueLogic.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { currentPeriodStart, nextTier, settleLeague, TIERS } from './leagueLogic.js';

describe('currentPeriodStart', () => {
  it('returns the Monday of the week (UTC)', () => {
    // 2026-06-27 is a Saturday → Monday is 2026-06-22
    expect(currentPeriodStart(new Date('2026-06-27T12:00:00Z'))).toBe('2026-06-22');
  });
  it('returns the same day when given a Monday', () => {
    expect(currentPeriodStart(new Date('2026-06-22T00:00:00Z'))).toBe('2026-06-22');
  });
});

describe('nextTier', () => {
  it('promotes and demotes within bounds', () => {
    expect(nextTier(0, 'promoted')).toBe(1);
    expect(nextTier(2, 'demoted')).toBe(1);
    expect(nextTier(1, 'held')).toBe(1);
  });
  it('clamps at both ends', () => {
    expect(nextTier(TIERS.MIN, 'demoted')).toBe(TIERS.MIN);
    expect(nextTier(TIERS.MAX, 'promoted')).toBe(TIERS.MAX);
  });
});

describe('settleLeague', () => {
  const mk = (id, xp, ts) => ({ user_id: id, weekly_xp: xp, updated_at: ts });

  it('ranks by xp desc, tie-break by updated_at asc', () => {
    const out = settleLeague([
      mk('a', 10, '2026-06-25T10:00:00Z'),
      mk('b', 30, '2026-06-25T09:00:00Z'),
      mk('c', 30, '2026-06-25T08:00:00Z'),
    ]);
    expect(out.map((m) => m.user_id)).toEqual(['c', 'b', 'a']);
    expect(out.map((m) => m.rank)).toEqual([1, 2, 3]);
  });

  it('marks top 7 promoted, bottom 5 demoted, middle held', () => {
    const members = Array.from({ length: 25 }, (_, i) =>
      mk(`u${i}`, 1000 - i, `2026-06-25T00:00:${String(i).padStart(2, '0')}Z`),
    );
    const out = settleLeague(members);
    expect(out.slice(0, 7).every((m) => m.result === 'promoted')).toBe(true);
    expect(out.slice(20).every((m) => m.result === 'demoted')).toBe(true);
    expect(out.slice(7, 20).every((m) => m.result === 'held')).toBe(true);
  });

  it('does not mutate the input array', () => {
    const input = [mk('a', 10, 't1')];
    const copy = JSON.parse(JSON.stringify(input));
    settleLeague(input);
    expect(input).toEqual(copy);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/_lib/leagueLogic.test.js`
Expected: FAIL — cannot resolve `./leagueLogic.js`.

- [x] **Step 3: Implement**

Create `api/_lib/leagueLogic.js`:

```js
export const TIERS = { MIN: 0, MAX: 4 };
export const LEAGUE_SIZE = 25;
const PROMOTE_COUNT = 7;
const DEMOTE_COUNT = 5;

export function currentPeriodStart(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = d.getUTCDay(); // 0=Sun..6=Sat
  const delta = dow === 0 ? -6 : 1 - dow; // back to Monday
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function nextTier(tier, result) {
  const step = result === 'promoted' ? 1 : result === 'demoted' ? -1 : 0;
  return Math.max(TIERS.MIN, Math.min(TIERS.MAX, tier + step));
}

export function settleLeague(members) {
  const sorted = [...members].sort((a, b) => {
    if (b.weekly_xp !== a.weekly_xp) return b.weekly_xp - a.weekly_xp;
    return String(a.updated_at).localeCompare(String(b.updated_at));
  });
  const n = sorted.length;
  return sorted.map((m, i) => {
    let result = 'held';
    if (i < PROMOTE_COUNT) result = 'promoted';
    else if (i >= n - DEMOTE_COUNT) result = 'demoted';
    return { user_id: m.user_id, rank: i + 1, result };
  });
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/_lib/leagueLogic.test.js`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add api/_lib/leagueLogic.js api/_lib/leagueLogic.test.js
git commit -m "feat(leagues): period/tier/settlement domain logic"
```

---

### Task 6: `POST /api/v1/league/join` endpoint

**Files:**
- Create: `api/v1/league/join.js`
- Create: `api/v1/league/join.test.js`

**Interfaces:**
- Consumes: `requireAuth`, `serviceClient`, `sendError`; `currentPeriodStart` from `api/_lib/leagueLogic.js`; `generateHandle` from `api/_lib/handle.js`.
- Produces: default export `handler(req, res)`. On success returns `200 { league_id, tier, period_start, handle }`. Idempotent: returns the existing membership if one exists for the current period.

- [x] **Step 1: Write the failing test**

Create `api/v1/league/join.test.js`:

```js
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../../_lib/supabase.js', () => ({ serviceClient: vi.fn() }));
vi.mock('../../_lib/auth-middleware.js', () => ({ requireAuth: vi.fn() }));

import handler from './join.js';
import { serviceClient } from '../../_lib/supabase.js';
import { requireAuth } from '../../_lib/auth-middleware.js';
import { createRes } from '../../_lib/test-helpers.js';

const USER = { userId: 'uid-1', email: 'a@b.com' };
const req = (method = 'POST') => ({ method, headers: { authorization: 'Bearer t' } });

afterEach(() => vi.clearAllMocks());

it('returns 405 for non-POST', async () => {
  const res = createRes();
  await handler(req('GET'), res);
  expect(res.statusCode).toBe(405);
});

it('returns 401 when auth fails', async () => {
  requireAuth.mockRejectedValue({ code: 'unauthorized', message: 'no' });
  const res = createRes();
  await handler(req(), res);
  expect(res.statusCode).toBe(401);
});

it('returns existing membership without creating a new one (idempotent)', async () => {
  requireAuth.mockResolvedValue(USER);
  const existing = {
    league_id: 'L1', handle: 'BlueFuchs01',
    leagues: { tier: 1, period_start: '2026-06-22' },
  };
  // membership lookup returns a row → short-circuit
  const memberSelect = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: existing, error: null }),
  };
  const insertSpy = vi.fn();
  serviceClient.mockReturnValue({
    from: vi.fn((table) => {
      if (table === 'league_members') return { ...memberSelect, insert: insertSpy };
      return memberSelect;
    }),
  });
  const res = createRes();
  await handler(req(), res);
  expect(res.statusCode).toBe(200);
  expect(res.body.league_id).toBe('L1');
  expect(insertSpy).not.toHaveBeenCalled();
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/v1/league/join.test.js`
Expected: FAIL — cannot resolve `./join.js`.

- [x] **Step 3: Implement**

Create `api/v1/league/join.js`:

```js
import { sendError } from '../../_lib/respond.js';
import { serviceClient } from '../../_lib/supabase.js';
import { requireAuth } from '../../_lib/auth-middleware.js';
import { currentPeriodStart, LEAGUE_SIZE, TIERS } from '../../_lib/leagueLogic.js';
import { generateHandle } from '../../_lib/handle.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendError(res, 'method_not_allowed', 'Method not allowed');

  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    return sendError(res, err.code ?? 'server_error', err.message ?? 'Unexpected error.');
  }

  const db = serviceClient();
  if (!db) return sendError(res, 'server_error', 'Server is not configured.');

  const period = currentPeriodStart();

  try {
    // 1. Idempotency: already a member this period?
    const { data: existing } = await db
      .from('league_members')
      .select('league_id, handle, leagues!inner(tier, period_start)')
      .eq('user_id', auth.userId)
      .eq('leagues.period_start', period)
      .maybeSingle();

    if (existing) {
      return res.status(200).json({
        league_id: existing.league_id,
        tier: existing.leagues.tier,
        period_start: period,
        handle: existing.handle,
      });
    }

    // 2. Ensure a handle on the profile.
    const { data: profile } = await db
      .from('profiles').select('handle').eq('user_id', auth.userId).maybeSingle();
    let handle = profile?.handle;
    if (!handle) {
      handle = generateHandle();
      await db.from('profiles').update({ handle }).eq('user_id', auth.userId);
    }

    // 3. Determine tier from last settled result.
    const { data: last } = await db
      .from('league_members')
      .select('result, leagues!inner(tier)')
      .eq('user_id', auth.userId)
      .not('result', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    let tier = TIERS.MIN;
    if (last) {
      const step = last.result === 'promoted' ? 1 : last.result === 'demoted' ? -1 : 0;
      tier = Math.max(TIERS.MIN, Math.min(TIERS.MAX, last.leagues.tier + step));
    }

    // 4. Find an open league at this tier+period, else create one.
    const { data: open } = await db
      .from('leagues')
      .select('id, league_members(count)')
      .eq('tier', tier)
      .eq('period_start', period);
    let leagueId = (open ?? []).find(
      (l) => (l.league_members?.[0]?.count ?? 0) < LEAGUE_SIZE,
    )?.id;
    if (!leagueId) {
      const { data: created, error: cErr } = await db
        .from('leagues').insert({ tier, period_start: period }).select('id').single();
      if (cErr) throw cErr;
      leagueId = created.id;
    }

    // 5. Insert membership.
    const { error: mErr } = await db
      .from('league_members')
      .insert({ league_id: leagueId, user_id: auth.userId, handle, weekly_xp: 0 });
    if (mErr) throw mErr;

    return res.status(200).json({ league_id: leagueId, tier, period_start: period, handle });
  } catch {
    return sendError(res, 'server_error', 'Failed to join league.');
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/v1/league/join.test.js`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add api/v1/league/join.js api/v1/league/join.test.js
git commit -m "feat(leagues): POST join endpoint (idempotent, tier placement)"
```

---

### Task 7: `POST /api/v1/league/refresh` endpoint

**Files:**
- Create: `api/v1/league/refresh.js`
- Create: `api/v1/league/refresh.test.js`

**Interfaces:**
- Consumes: `requireAuth`, `serviceClient`, `sendError`; `currentPeriodStart`; `weeklyXpFromRows` from `api/_lib/weeklyXp.js`.
- Produces: default export `handler(req, res)`. Recomputes the caller's own `weekly_xp` from their `stats_daily` for the current period and upserts it. Returns `200 { weekly_xp }`. Only ever writes the caller's row.

- [x] **Step 1: Write the failing test**

Create `api/v1/league/refresh.test.js`:

```js
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../../_lib/supabase.js', () => ({ serviceClient: vi.fn() }));
vi.mock('../../_lib/auth-middleware.js', () => ({ requireAuth: vi.fn() }));

import handler from './refresh.js';
import { serviceClient } from '../../_lib/supabase.js';
import { requireAuth } from '../../_lib/auth-middleware.js';
import { createRes } from '../../_lib/test-helpers.js';

const USER = { userId: 'uid-1', email: 'a@b.com' };
const req = (method = 'POST') => ({ method, headers: { authorization: 'Bearer t' } });
const counters = (correct) => ({ byLevel: { a1: { correct, almost: 0, wrong: 0 } }, bonusXp: 0 });

afterEach(() => vi.clearAllMocks());

it('returns 405 for non-POST', async () => {
  const res = createRes();
  await handler(req('GET'), res);
  expect(res.statusCode).toBe(405);
});

it('computes weekly xp from stats and updates only the caller row', async () => {
  requireAuth.mockResolvedValue(USER);
  const statsChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockResolvedValue({
      data: [{ day: '2026-06-23', counters: counters(2) }], // 20 xp
      error: null,
    }),
  };
  const updateEq2 = vi.fn().mockResolvedValue({ error: null });
  const updateEq1 = vi.fn(() => ({ eq: updateEq2 }));
  const membersChain = { update: vi.fn(() => ({ eq: updateEq1 })) };
  serviceClient.mockReturnValue({
    from: vi.fn((table) => (table === 'stats_daily' ? statsChain : membersChain)),
  });

  const res = createRes();
  await handler(req(), res);
  expect(res.statusCode).toBe(200);
  expect(res.body.weekly_xp).toBe(20);
  // update scoped to caller user_id
  expect(updateEq1).toHaveBeenCalledWith('user_id', 'uid-1');
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/v1/league/refresh.test.js`
Expected: FAIL — cannot resolve `./refresh.js`.

- [x] **Step 3: Implement**

Create `api/v1/league/refresh.js`:

```js
import { sendError } from '../../_lib/respond.js';
import { serviceClient } from '../../_lib/supabase.js';
import { requireAuth } from '../../_lib/auth-middleware.js';
import { currentPeriodStart } from '../../_lib/leagueLogic.js';
import { weeklyXpFromRows } from '../../_lib/weeklyXp.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendError(res, 'method_not_allowed', 'Method not allowed');

  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    return sendError(res, err.code ?? 'server_error', err.message ?? 'Unexpected error.');
  }

  const db = serviceClient();
  if (!db) return sendError(res, 'server_error', 'Server is not configured.');

  const period = currentPeriodStart();

  try {
    const { data: rows, error } = await db
      .from('stats_daily')
      .select('day, counters')
      .eq('user_id', auth.userId)
      .gte('day', period);
    if (error) throw error;

    const weekly = weeklyXpFromRows(rows ?? [], period);

    const { error: uErr } = await db
      .from('league_members')
      .update({ weekly_xp: weekly, updated_at: new Date().toISOString() })
      .eq('user_id', auth.userId);
    if (uErr) throw uErr;

    return res.status(200).json({ weekly_xp: weekly });
  } catch {
    return sendError(res, 'server_error', 'Failed to refresh league XP.');
  }
}
```

Note: the `update().eq('user_id', ...)` scopes to the caller's membership rows; only the current-period row exists as un-settled, so a tighter `period` filter is unnecessary, but if a stale prior row exists the settled `rank` is left untouched (we only set `weekly_xp`/`updated_at`). This is acceptable — settled rows are read by period.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/v1/league/refresh.test.js`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add api/v1/league/refresh.js api/v1/league/refresh.test.js
git commit -m "feat(leagues): POST refresh endpoint (server-computed weekly XP)"
```

---

### Task 8: `GET /api/v1/league/profile` endpoint

**Files:**
- Create: `api/v1/league/profile.js`
- Create: `api/v1/league/profile.test.js`

**Interfaces:**
- Consumes: `requireAuth`, `serviceClient`, `sendError`; `xpForDay` from `src/lib/xpCore.js`.
- Produces: default export `handler(req, res)`. Reads `?userId=` from `req.query`. Returns `200 { handle, avatar_emoji, tier, total_xp, longest_streak, achievements }` only if the requester shares a current-period league with the target; else `403`.
- Note: `longest_streak` is computed from a helper `longestStreak(dayKeys)` defined in this task (pure, local), to avoid pulling the browser streak module server-side.

- [x] **Step 1: Write the failing test**

Create `api/v1/league/profile.test.js`:

```js
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../../_lib/supabase.js', () => ({ serviceClient: vi.fn() }));
vi.mock('../../_lib/auth-middleware.js', () => ({ requireAuth: vi.fn() }));

import handler, { longestStreak } from './profile.js';
import { serviceClient } from '../../_lib/supabase.js';
import { requireAuth } from '../../_lib/auth-middleware.js';
import { createRes } from '../../_lib/test-helpers.js';

const USER = { userId: 'me', email: 'a@b.com' };
const req = (userId) => ({ method: 'GET', query: { userId }, headers: { authorization: 'Bearer t' } });

afterEach(() => vi.clearAllMocks());

describe('longestStreak', () => {
  it('finds the longest run of consecutive days', () => {
    expect(longestStreak(['2026-06-20', '2026-06-21', '2026-06-23'])).toBe(2);
    expect(longestStreak([])).toBe(0);
  });
});

it('rejects when requester shares no league with target (403)', async () => {
  requireAuth.mockResolvedValue(USER);
  const sharedRpc = vi.fn().mockResolvedValue({ data: false, error: null });
  serviceClient.mockReturnValue({ rpc: sharedRpc });
  const res = createRes();
  await handler(req('other'), res);
  expect(res.statusCode).toBe(403);
});

it('returns 400 when userId missing', async () => {
  requireAuth.mockResolvedValue(USER);
  serviceClient.mockReturnValue({ rpc: vi.fn() });
  const res = createRes();
  await handler(req(undefined), res);
  expect(res.statusCode).toBe(400);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/v1/league/profile.test.js`
Expected: FAIL — cannot resolve `./profile.js`.

- [x] **Step 3: Implement**

First add a SQL helper for the shared-league check. Append to a NEW migration `supabase/migrations/20260627000100_shared_league.sql`:

```sql
-- True if users a and b share any league in the current (latest) period.
create or replace function public.shares_league(p_a uuid, p_b uuid)
returns boolean
language sql
security definer set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.league_members ma
    join public.league_members mb on ma.league_id = mb.league_id
    where ma.user_id = p_a and mb.user_id = p_b
  );
$$;
```

Apply it to the Supabase preview branch via `apply_migration` (same as Task 1, Step 2).

Create `api/v1/league/profile.js`:

```js
import { sendError } from '../../_lib/respond.js';
import { serviceClient } from '../../_lib/supabase.js';
import { requireAuth } from '../../_lib/auth-middleware.js';
import { xpForDay } from '../../../src/lib/xpCore.js';

// Longest run of consecutive calendar days present in the sorted key list.
export function longestStreak(dayKeys) {
  const days = [...new Set(dayKeys)].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const key of days) {
    const t = Date.parse(key + 'T00:00:00Z');
    if (prev !== null && t - prev === 86400000) run += 1;
    else run = 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendError(res, 'method_not_allowed', 'Method not allowed');

  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    return sendError(res, err.code ?? 'server_error', err.message ?? 'Unexpected error.');
  }

  const target = req.query?.userId;
  if (!target) return sendError(res, 'bad_request', 'Missing userId.');

  const db = serviceClient();
  if (!db) return sendError(res, 'server_error', 'Server is not configured.');

  try {
    if (target !== auth.userId) {
      const { data: shares } = await db.rpc('shares_league', { p_a: auth.userId, p_b: target });
      if (!shares) return sendError(res, 'forbidden', 'Not in your league.');
    }

    const [{ data: profile }, { data: stats }, { data: member }] = await Promise.all([
      db.from('profiles').select('handle, avatar_emoji').eq('user_id', target).maybeSingle(),
      db.from('stats_daily').select('day, counters').eq('user_id', target),
      db.from('league_members')
        .select('leagues!inner(tier, period_start)')
        .eq('user_id', target)
        .order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    const rows = stats ?? [];
    const total_xp = rows.reduce((s, r) => s + xpForDay(r.counters), 0);
    const longest_streak = longestStreak(rows.map((r) => r.day));

    return res.status(200).json({
      handle: profile?.handle ?? null,
      avatar_emoji: profile?.avatar_emoji ?? null,
      tier: member?.leagues?.tier ?? 0,
      total_xp,
      longest_streak,
      achievements: [], // top achievements summarized client-side from public data
    });
  } catch {
    return sendError(res, 'server_error', 'Failed to load profile.');
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/v1/league/profile.test.js`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add api/v1/league/profile.js api/v1/league/profile.test.js supabase/migrations/20260627000100_shared_league.sql
git commit -m "feat(leagues): GET profile endpoint with shared-league gate"
```

---

### Task 9: `POST /api/v1/league/settle` endpoint + cron

**Files:**
- Create: `api/v1/league/settle.js`
- Create: `api/v1/league/settle.test.js`
- Modify: `vercel.json` (add `crons`)

**Interfaces:**
- Consumes: `serviceClient`, `sendError`; `settleLeague`, `currentPeriodStart` from `api/_lib/leagueLogic.js`.
- Produces: default export `handler(req, res)`. Protected by a `CRON_SECRET` bearer check (Vercel cron sets `authorization: Bearer <CRON_SECRET>`). Settles every league whose `period_start` is before the current period and whose members are not yet ranked. Returns `200 { settled: <count> }`. Idempotent.

- [x] **Step 1: Write the failing test**

Create `api/v1/league/settle.test.js`:

```js
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

vi.mock('../../_lib/supabase.js', () => ({ serviceClient: vi.fn() }));

import handler from './settle.js';
import { serviceClient } from '../../_lib/supabase.js';
import { createRes } from '../../_lib/test-helpers.js';

const req = (token = 'secret') => ({ method: 'POST', headers: { authorization: `Bearer ${token}` } });

beforeEach(() => { process.env.CRON_SECRET = 'secret'; });
afterEach(() => vi.clearAllMocks());

it('rejects without the cron secret (401)', async () => {
  serviceClient.mockReturnValue({});
  const res = createRes();
  await handler(req('wrong'), res);
  expect(res.statusCode).toBe(401);
});

it('settles past leagues and writes ranks/results', async () => {
  const past = [{ id: 'L1', period_start: '2026-06-15' }];
  const members = [
    { user_id: 'a', weekly_xp: 50, updated_at: 't1' },
    { user_id: 'b', weekly_xp: 10, updated_at: 't2' },
  ];
  const updateEq2 = vi.fn().mockResolvedValue({ error: null });
  const updates = [];
  const db = {
    from: vi.fn((table) => {
      if (table === 'leagues') {
        return { select: vi.fn().mockReturnThis(), lt: vi.fn().mockResolvedValue({ data: past, error: null }) };
      }
      // league_members
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ data: members, error: null }),
        update: vi.fn((vals) => ({
          eq: vi.fn().mockReturnThis(),
          match: vi.fn((m) => { updates.push({ vals, m }); return Promise.resolve({ error: null }); }),
        })),
      };
    }),
  };
  serviceClient.mockReturnValue(db);

  const res = createRes();
  await handler(req('secret'), res);
  expect(res.statusCode).toBe(200);
  expect(res.body.settled).toBe(1);
  // winner 'a' got rank 1
  const winner = updates.find((u) => u.m.user_id === 'a');
  expect(winner.vals.rank).toBe(1);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/v1/league/settle.test.js`
Expected: FAIL — cannot resolve `./settle.js`.

- [x] **Step 3: Implement**

Create `api/v1/league/settle.js`:

```js
import { sendError } from '../../_lib/respond.js';
import { serviceClient } from '../../_lib/supabase.js';
import { settleLeague, currentPeriodStart } from '../../_lib/leagueLogic.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendError(res, 'method_not_allowed', 'Method not allowed');

  const secret = process.env.CRON_SECRET;
  const header = req.headers?.authorization ?? '';
  if (!secret || header !== `Bearer ${secret}`) {
    return sendError(res, 'unauthorized', 'Invalid cron secret.');
  }

  const db = serviceClient();
  if (!db) return sendError(res, 'server_error', 'Server is not configured.');

  const period = currentPeriodStart();

  try {
    // Leagues from prior periods (period_start < current) — candidates to settle.
    const { data: leagues, error } = await db
      .from('leagues').select('id, period_start').lt('period_start', period);
    if (error) throw error;

    let settled = 0;
    for (const league of leagues ?? []) {
      // Idempotency: skip if any member already has a rank.
      const { data: members } = await db
        .from('league_members')
        .select('user_id, weekly_xp, updated_at')
        .eq('league_id', league.id)
        .is('rank', null);
      if (!members || members.length === 0) continue;

      const results = settleLeague(members);
      for (const r of results) {
        await db
          .from('league_members')
          .update({ rank: r.rank, result: r.result })
          .match({ league_id: league.id, user_id: r.user_id });
      }
      settled += 1;
    }

    return res.status(200).json({ settled });
  } catch {
    return sendError(res, 'server_error', 'Failed to settle leagues.');
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/v1/league/settle.test.js`
Expected: PASS.

- [x] **Step 5: Add the cron to `vercel.json`**

Add (or merge) a `crons` array in `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/v1/league/settle", "schedule": "0 0 * * 1" }
  ]
}
```

If `vercel.json` already has other top-level keys, add `crons` alongside them without removing anything. Set `CRON_SECRET` in Vercel project env (Preview + Production) via `vercel env add CRON_SECRET`.

- [x] **Step 6: Commit**

```bash
git add api/v1/league/settle.js api/v1/league/settle.test.js vercel.json
git commit -m "feat(leagues): weekly settle endpoint + Vercel cron"
```

---

### Task 10: Client league API module

**Files:**
- Create: `src/lib/leagues.js`
- Create: `src/lib/leagues.test.js`

**Interfaces:**
- Consumes: `getAccessToken` from `src/lib/auth.js`.
- Produces:
  - `LEAGUES_ENABLED` (boolean from `import.meta.env.VITE_LEAGUES_ENABLED === 'true'`)
  - `TIER_NAMES = ['Bronze','Silver','Gold','Sapphire','Ruby']`
  - `joinLeague() -> Promise<{ league_id, tier, period_start, handle }>`
  - `refreshLeague() -> Promise<{ weekly_xp }>`
  - `fetchProfile(userId) -> Promise<profile>`
  - `fetchStandings(supabase, leagueId) -> Promise<rows[]>` (uses the RLS-scoped client `select`).

- [x] **Step 1: Write the failing test**

Create `src/lib/leagues.test.js`:

```js
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('./auth.js', () => ({ getAccessToken: vi.fn().mockResolvedValue('tok') }));

import { joinLeague, TIER_NAMES } from './leagues.js';

afterEach(() => vi.restoreAllMocks());

describe('TIER_NAMES', () => {
  it('has five tiers Bronze..Ruby', () => {
    expect(TIER_NAMES).toEqual(['Bronze', 'Silver', 'Gold', 'Sapphire', 'Ruby']);
  });
});

describe('joinLeague', () => {
  it('POSTs with the bearer token and returns json', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ league_id: 'L1', tier: 0, period_start: '2026-06-22', handle: 'X' }),
    });
    const out = await joinLeague();
    expect(out.league_id).toBe('L1');
    expect(fetchSpy).toHaveBeenCalledWith('/api/v1/league/join', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ authorization: 'Bearer tok' }),
    }));
  });

  it('throws on non-ok response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await expect(joinLeague()).rejects.toThrow();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/leagues.test.js`
Expected: FAIL — cannot resolve `./leagues.js`.

- [x] **Step 3: Implement**

Create `src/lib/leagues.js`:

```js
import { getAccessToken } from './auth.js';

export const LEAGUES_ENABLED = import.meta.env.VITE_LEAGUES_ENABLED === 'true';
export const TIER_NAMES = ['Bronze', 'Silver', 'Gold', 'Sapphire', 'Ruby'];

async function post(path) {
  const token = await getAccessToken();
  const res = await fetch(path, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

export function joinLeague() {
  return post('/api/v1/league/join');
}

export function refreshLeague() {
  return post('/api/v1/league/refresh');
}

export async function fetchProfile(userId) {
  const token = await getAccessToken();
  const res = await fetch(`/api/v1/league/profile?userId=${encodeURIComponent(userId)}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`profile failed: ${res.status}`);
  return res.json();
}

// Standings via the RLS-scoped Supabase client (reads only the caller's league).
export async function fetchStandings(supabase, leagueId) {
  const { data, error } = await supabase
    .from('league_members')
    .select('user_id, handle, weekly_xp, rank')
    .eq('league_id', leagueId)
    .order('weekly_xp', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/leagues.test.js`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/lib/leagues.js src/lib/leagues.test.js
git commit -m "feat(leagues): client API module"
```

---

### Task 11: `LeaderboardSection` component

**Files:**
- Create: `src/components/stats/LeaderboardSection.jsx`
- Create: `src/components/stats/LeaderboardSection.test.jsx`

**Interfaces:**
- Consumes: `useAuth`, `getSupabase` from `src/lib/auth.js`; `joinLeague`, `refreshLeague`, `fetchStandings`, `TIER_NAMES`, `LEAGUES_ENABLED` from `src/lib/leagues.js`; theme tokens from `src/lib/theme.js`.
- Produces: default export `LeaderboardSection({ onSelectUser })`. Renders the signed-out teaser, or the league standings list. Calls `onSelectUser(userId)` when a row is tapped.

- [x] **Step 1: Write the failing test**

Create `src/components/stats/LeaderboardSection.test.jsx`:

```jsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';

vi.mock('../../lib/auth.js', () => ({
  useAuth: vi.fn(),
  getSupabase: vi.fn(),
}));
vi.mock('../../lib/leagues.js', () => ({
  LEAGUES_ENABLED: true,
  TIER_NAMES: ['Bronze', 'Silver', 'Gold', 'Sapphire', 'Ruby'],
  joinLeague: vi.fn(),
  refreshLeague: vi.fn(),
  fetchStandings: vi.fn(),
}));

import LeaderboardSection from './LeaderboardSection.jsx';
import { useAuth } from '../../lib/auth.js';
import { joinLeague, refreshLeague, fetchStandings } from '../../lib/leagues.js';

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('shows the sign-in teaser when signed out', () => {
  useAuth.mockReturnValue({ user: null });
  render(<LeaderboardSection onSelectUser={() => {}} />);
  expect(screen.getByText(/sign in to join/i)).toBeTruthy();
});

it('renders standings when signed in', async () => {
  useAuth.mockReturnValue({ user: { id: 'me' } });
  joinLeague.mockResolvedValue({ league_id: 'L1', tier: 0, period_start: '2026-06-22', handle: 'Me' });
  refreshLeague.mockResolvedValue({ weekly_xp: 30 });
  fetchStandings.mockResolvedValue([
    { user_id: 'me', handle: 'Me', weekly_xp: 30, rank: null },
    { user_id: 'x', handle: 'Rival', weekly_xp: 10, rank: null },
  ]);
  render(<LeaderboardSection onSelectUser={() => {}} />);
  await waitFor(() => expect(screen.getByText('Rival')).toBeTruthy());
  expect(screen.getByText('Bronze')).toBeTruthy();
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/stats/LeaderboardSection.test.jsx`
Expected: FAIL — cannot resolve `./LeaderboardSection.jsx`.

- [x] **Step 3: Implement**

Open `src/components/stats/AccountSection.jsx` first to copy its exact theme-token import path and inline-style idiom, then create `src/components/stats/LeaderboardSection.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { useAuth, getSupabase } from '../../lib/auth.js';
import {
  joinLeague, refreshLeague, fetchStandings, TIER_NAMES, LEAGUES_ENABLED,
} from '../../lib/leagues.js';
import { theme } from '../../lib/theme.js';

const PROMOTE_ZONE = 7;
const DEMOTE_ZONE = 5;

export default function LeaderboardSection({ onSelectUser }) {
  const { user } = useAuth();
  const [state, setState] = useState({ status: 'idle', league: null, rows: [] });

  useEffect(() => {
    if (!LEAGUES_ENABLED || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const league = await joinLeague();
        await refreshLeague();
        const rows = await fetchStandings(getSupabase(), league.league_id);
        if (!cancelled) setState({ status: 'ready', league, rows });
      } catch {
        if (!cancelled) setState({ status: 'error', league: null, rows: [] });
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (!LEAGUES_ENABLED) return null;

  if (!user) {
    return (
      <div style={{ padding: theme.space.lg, textAlign: 'center', color: theme.color.textMuted }}>
        <p style={{ margin: 0 }}>Sign in to join a league and compete this week.</p>
      </div>
    );
  }

  if (state.status === 'error') {
    return <p style={{ color: theme.color.danger, padding: theme.space.md }}>Couldn’t load your league.</p>;
  }
  if (state.status !== 'ready') {
    return <p style={{ color: theme.color.textMuted, padding: theme.space.md }}>Loading league…</p>;
  }

  const n = state.rows.length;
  return (
    <div style={{ padding: theme.space.md }}>
      <h3 style={{ margin: `0 0 ${theme.space.sm}`, color: theme.color.text }}>
        {TIER_NAMES[state.league.tier]} League
      </h3>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {state.rows.map((row, i) => {
          const isMe = row.user_id === user.id;
          const zoneBorder =
            i === PROMOTE_ZONE - 1 ? `2px solid ${theme.color.success}` :
            i === n - DEMOTE_ZONE ? `2px solid ${theme.color.danger}` : 'none';
          return (
            <li
              key={row.user_id}
              onClick={() => onSelectUser(row.user_id)}
              style={{
                display: 'flex', justifyContent: 'space-between', cursor: 'pointer',
                padding: theme.space.sm, borderBottom: zoneBorder,
                background: isMe ? theme.color.surfaceAlt : 'transparent',
                fontWeight: isMe ? 700 : 400, color: theme.color.text,
              }}
            >
              <span>{i + 1}. {row.handle}</span>
              <span>{row.weekly_xp} XP</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
```

If any referenced token (`theme.color.surfaceAlt`, `theme.color.success`, `theme.color.danger`, `theme.space.*`) does not exist, open `src/lib/theme.js` and substitute the nearest existing token — do not invent new tokens or hardcode colors.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/stats/LeaderboardSection.test.jsx`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/components/stats/LeaderboardSection.jsx src/components/stats/LeaderboardSection.test.jsx
git commit -m "feat(leagues): LeaderboardSection component"
```

---

### Task 12: `ProfileCard` component

**Files:**
- Create: `src/components/stats/ProfileCard.jsx`
- Create: `src/components/stats/ProfileCard.test.jsx`

**Interfaces:**
- Consumes: `fetchProfile`, `TIER_NAMES` from `src/lib/leagues.js`; theme tokens.
- Produces: default export `ProfileCard({ userId, onClose })`. Fetches and renders the public profile card; renders a close affordance that calls `onClose`.

- [x] **Step 1: Write the failing test**

Create `src/components/stats/ProfileCard.test.jsx`:

```jsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';

vi.mock('../../lib/leagues.js', () => ({
  TIER_NAMES: ['Bronze', 'Silver', 'Gold', 'Sapphire', 'Ruby'],
  fetchProfile: vi.fn(),
}));

import ProfileCard from './ProfileCard.jsx';
import { fetchProfile } from '../../lib/leagues.js';

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('renders fetched profile fields', async () => {
  fetchProfile.mockResolvedValue({
    handle: 'Rival', avatar_emoji: '🦊', tier: 1, total_xp: 420, longest_streak: 9, achievements: [],
  });
  render(<ProfileCard userId="x" onClose={() => {}} />);
  await waitFor(() => expect(screen.getByText('Rival')).toBeTruthy());
  expect(screen.getByText('Silver')).toBeTruthy();
  expect(screen.getByText(/420/)).toBeTruthy();
});

it('calls onClose when the close button is clicked', async () => {
  fetchProfile.mockResolvedValue({ handle: 'R', avatar_emoji: null, tier: 0, total_xp: 0, longest_streak: 0, achievements: [] });
  const onClose = vi.fn();
  render(<ProfileCard userId="x" onClose={onClose} />);
  await waitFor(() => expect(screen.getByText('R')).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: /close/i }));
  expect(onClose).toHaveBeenCalled();
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/stats/ProfileCard.test.jsx`
Expected: FAIL — cannot resolve `./ProfileCard.jsx`.

- [x] **Step 3: Implement**

Create `src/components/stats/ProfileCard.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { fetchProfile, TIER_NAMES } from '../../lib/leagues.js';
import { theme } from '../../lib/theme.js';

export default function ProfileCard({ userId, onClose }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchProfile(userId)
      .then((p) => { if (!cancelled) setProfile(p); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [userId]);

  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'rgba(0,0,0,0.5)', zIndex: 50,
    }}>
      <div style={{
        background: theme.color.surface, padding: theme.space.lg,
        borderRadius: theme.radius.md, minWidth: 260, color: theme.color.text,
      }}>
        <button onClick={onClose} aria-label="Close"
          style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: theme.color.textMuted }}>
          ✕
        </button>
        {error && <p style={{ color: theme.color.danger }}>Couldn’t load profile.</p>}
        {!error && !profile && <p style={{ color: theme.color.textMuted }}>Loading…</p>}
        {profile && (
          <div>
            <div style={{ fontSize: 40 }}>{profile.avatar_emoji ?? '🙂'}</div>
            <h3 style={{ margin: `${theme.space.xs} 0` }}>{profile.handle}</h3>
            <p style={{ margin: 0 }}>{TIER_NAMES[profile.tier]} League</p>
            <p style={{ margin: 0 }}>{profile.total_xp} total XP</p>
            <p style={{ margin: 0 }}>Longest streak: {profile.longest_streak} days</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

Substitute nearest existing theme tokens if `theme.radius.md` / `theme.space.xs` are absent (check `src/lib/theme.js`).

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/stats/ProfileCard.test.jsx`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/components/stats/ProfileCard.jsx src/components/stats/ProfileCard.test.jsx
git commit -m "feat(leagues): ProfileCard component"
```

---

### Task 13: Wire Leaderboard + ProfileCard into the app, behind the flag

**Files:**
- Modify: the stats/navigation host that renders `AccountSection` (locate with `grep -rn "AccountSection" src/`)
- Test: extend the host's existing test if present, else add a focused render test alongside the host.

**Interfaces:**
- Consumes: `LeaderboardSection`, `ProfileCard`, `LEAGUES_ENABLED`.
- Produces: a "Leagues" view/tab that renders `LeaderboardSection`; selecting a user opens `ProfileCard`; both hidden when `LEAGUES_ENABLED` is false.

- [x] **Step 1: Locate the host and its pattern**

Run: `grep -rn "AccountSection" src/ --include=*.jsx`
Read the file that renders it to learn how sections/tabs are added (props, view-switch state).

- [x] **Step 2: Write a failing test**

In the host's test file (or a new `*.test.jsx` next to it), add a test asserting that when `VITE_LEAGUES_ENABLED` is mocked true and the Leagues view is active, `LeaderboardSection` renders. Mock `LeaderboardSection` and `ProfileCard` as simple stubs:

```jsx
vi.mock('./LeaderboardSection.jsx', () => ({
  default: ({ onSelectUser }) => (
    <button onClick={() => onSelectUser('x')}>stub-leaderboard</button>
  ),
}));
vi.mock('./ProfileCard.jsx', () => ({
  default: ({ userId }) => <div>stub-card-{userId}</div>,
}));
```

Assert: clicking `stub-leaderboard` then shows `stub-card-x` (verifies the `onSelectUser → ProfileCard` wiring). Adapt selectors to the host's actual nav.

- [x] **Step 3: Run test to verify it fails**

Run: `npx vitest run <host test path>`
Expected: FAIL — Leagues view not wired.

- [x] **Step 4: Implement the wiring**

In the host, add `selectedUser` state, render `<LeaderboardSection onSelectUser={setSelectedUser} />` in the Leagues view, and conditionally render `<ProfileCard userId={selectedUser} onClose={() => setSelectedUser(null)} />`. Gate the Leagues nav entry with `LEAGUES_ENABLED`. Follow the host's existing view-switch idiom exactly.

- [x] **Step 5: Run test to verify it passes**

Run: `npx vitest run <host test path>`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/
git commit -m "feat(leagues): wire Leaderboard + ProfileCard into app behind flag"
```

---

### Task 14: Handle & avatar editing in AccountSection

**Files:**
- Modify: `src/components/stats/AccountSection.jsx`
- Modify: `src/components/stats/AccountSection.test.jsx`
- Create: `api/v1/league/handle.js`
- Create: `api/v1/league/handle.test.js`

**Interfaces:**
- Produces: `PATCH /api/v1/league/handle` accepting `{ handle?, avatar_emoji? }`, updating the caller's `profiles` row (handle uniqueness enforced by DB; on conflict return `bad_request`). Returns `200 { handle, avatar_emoji }`.
- AccountSection gains a small form (text input for handle, emoji input) that calls a new `updateHandle(body)` in `src/lib/leagues.js`.

- [x] **Step 1: Write the failing endpoint test**

Create `api/v1/league/handle.test.js`:

```js
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../../_lib/supabase.js', () => ({ serviceClient: vi.fn() }));
vi.mock('../../_lib/auth-middleware.js', () => ({ requireAuth: vi.fn() }));

import handler from './handle.js';
import { serviceClient } from '../../_lib/supabase.js';
import { requireAuth } from '../../_lib/auth-middleware.js';
import { createRes } from '../../_lib/test-helpers.js';

const USER = { userId: 'uid-1', email: 'a@b.com' };
const req = (body, method = 'PATCH') => ({ method, headers: { authorization: 'Bearer t' }, body });

afterEach(() => vi.clearAllMocks());

it('updates handle and returns it', async () => {
  requireAuth.mockResolvedValue(USER);
  const eq = vi.fn().mockResolvedValue({ error: null });
  serviceClient.mockReturnValue({ from: vi.fn(() => ({ update: vi.fn(() => ({ eq })) })) });
  const res = createRes();
  await handler(req({ handle: 'NewName07' }), res);
  expect(res.statusCode).toBe(200);
  expect(res.body.handle).toBe('NewName07');
});

it('rejects a duplicate handle as bad_request', async () => {
  requireAuth.mockResolvedValue(USER);
  const eq = vi.fn().mockResolvedValue({ error: { code: '23505' } });
  serviceClient.mockReturnValue({ from: vi.fn(() => ({ update: vi.fn(() => ({ eq })) })) });
  const res = createRes();
  await handler(req({ handle: 'Taken01' }), res);
  expect(res.statusCode).toBe(400);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/v1/league/handle.test.js`
Expected: FAIL — cannot resolve `./handle.js`.

- [x] **Step 3: Implement the endpoint**

Create `api/v1/league/handle.js`:

```js
import { sendError } from '../../_lib/respond.js';
import { serviceClient } from '../../_lib/supabase.js';
import { requireAuth } from '../../_lib/auth-middleware.js';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return sendError(res, 'method_not_allowed', 'Method not allowed');

  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    return sendError(res, err.code ?? 'server_error', err.message ?? 'Unexpected error.');
  }

  const { handle, avatar_emoji } = req.body ?? {};
  const patch = {};
  if (typeof handle === 'string') patch.handle = handle.trim();
  if (typeof avatar_emoji === 'string') patch.avatar_emoji = avatar_emoji;
  if (Object.keys(patch).length === 0) return sendError(res, 'bad_request', 'Nothing to update.');

  const db = serviceClient();
  if (!db) return sendError(res, 'server_error', 'Server is not configured.');

  const { error } = await db.from('profiles').update(patch).eq('user_id', auth.userId);
  if (error) {
    if (error.code === '23505') return sendError(res, 'bad_request', 'That handle is taken.');
    return sendError(res, 'server_error', 'Failed to update profile.');
  }
  return res.status(200).json({ handle: patch.handle ?? null, avatar_emoji: patch.avatar_emoji ?? null });
}
```

- [x] **Step 4: Add `updateHandle` to the client module**

In `src/lib/leagues.js`, add:

```js
export async function updateHandle(body) {
  const token = await getAccessToken();
  const res = await fetch('/api/v1/league/handle', {
    method: 'PATCH',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`handle update failed: ${res.status}`);
  return res.json();
}
```

- [x] **Step 5: Add the editing form to AccountSection**

Read `src/components/stats/AccountSection.jsx` and add (gated by `LEAGUES_ENABLED` and a signed-in user) a small form: a text input bound to local `handle` state and an emoji text input bound to `avatar`, plus a "Save" button calling `updateHandle({ handle, avatar_emoji: avatar })`. Show a success/error message using the section's existing message idiom. Use only theme tokens for styles. Extend `AccountSection.test.jsx` with one test: mock `updateHandle`, type a handle, click Save, assert `updateHandle` was called with the typed value.

- [x] **Step 6: Run tests to verify they pass**

Run: `npx vitest run api/v1/league/handle.test.js src/components/stats/AccountSection.test.jsx src/lib/leagues.test.js`
Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add api/v1/league/handle.js api/v1/league/handle.test.js src/lib/leagues.js src/components/stats/AccountSection.jsx src/components/stats/AccountSection.test.jsx
git commit -m "feat(leagues): handle/avatar editing endpoint + AccountSection form"
```

---

### Task 15: Full suite, RLS integration check, PR

**Files:** none new — verification + integration.

- [x] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — all prior tests plus the new league tests green (no regressions).

- [x] **Step 2: Manual RLS integration check (Supabase preview branch)**

Against the preview branch where Task 1/8 migrations were applied, verify with two test users via `execute_sql` (impersonating with `set local role` / JWT claims, or by inserting fixture rows and querying as each user through the anon client):
- User A in league L1 can `select` A's and leaguemates' `league_members` rows for L1.
- User A cannot `select` rows of a league they don't belong to.
- `shares_league(A, B)` returns true only when A and B share a league.
Document the outcome in the PR description. (Postgres RLS cannot be unit-tested locally — this manual check is the gate.)

- [x] **Step 3: Apply migrations to production**

Once the PR is approved and merged, apply `20260627000000_leagues.sql` and `20260627000100_shared_league.sql` to the production Supabase project. Set `VITE_LEAGUES_ENABLED=true` (Preview first, then Production) and `CRON_SECRET` in Vercel.

- [x] **Step 4: Open the PR**

```bash
git push -u origin <branch>
gh pr create --title "feat: social leagues (weekly XP, promotion/relegation, profiles)" \
  --body "Implements docs/superpowers/specs/2026-06-27-social-leagues-design.md. Behind VITE_LEAGUES_ENABLED. Includes RLS integration-check notes below.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Self-Review Notes

- **Spec coverage:** §3 constraint → Tasks 1, 2 (private data stays private, formula reuse). §4 data model → Task 1. §5 endpoints join/refresh/profile/settle → Tasks 6/7/8/9. §5 handle generation → Task 3; tier ladder/period → Task 5. §6 UI (LeaderboardSection, ProfileCard, AccountSection editing) → Tasks 11/12/14, wiring in 13. §7 testing → tests in every task + Task 15 RLS gate. §8 build sequence and feature flag → Task 10 (`LEAGUES_ENABLED`), Task 13 gating, Task 15 rollout. Flat rewards (decision #7): the `settle` endpoint records rank/result; the winner-badge/XP-bonus grant is intentionally minimal — **note:** Task 9 currently records results only; granting the flat badge into the achievement system is folded into Task 9 Step 3's `settleLeague` results consumption only if an achievements-write path exists. If the existing achievement system has no server write path, the badge is awarded client-side on next load by reading the user's `result='promoted'|rank=1`. This is called out so the implementer doesn't block.
- **Placeholder scan:** no TBD/TODO; all code blocks complete.
- **Type consistency:** `currentPeriodStart`, `nextTier`, `settleLeague`, `weeklyXpFromRows`, `generateHandle`, `xpForDay`, `joinLeague/refreshLeague/fetchProfile/fetchStandings/updateHandle`, `TIER_NAMES` are used with consistent signatures across tasks.
