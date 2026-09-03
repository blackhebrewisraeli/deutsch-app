# Data-driven engine E1–E3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the developer interface for lesson content and generic progress events — a `lessons` table, a public content GET, an additive-increment RPC and two authenticated progress endpoints — with **zero required app-behaviour change**.

**Architecture:** Content becomes one new RLS-protected Postgres table read through a versioned Vercel function. Progress reuses the existing `stats_daily` table; the only new machinery is a `security definer` RPC that performs the same normalize-then-increment `applyEvent` does on the client, atomically inside `INSERT … ON CONFLICT DO UPDATE`. Nothing under `src/` changes, and nothing calls the new endpoints.

**Tech Stack:** Supabase Postgres (JSONB, RLS), Vercel serverless functions under `/api/v1/*`, Vitest for contract tests, a separate Dockerised `npm run test:rls` job for policy tests.

**Spec:** `docs/superpowers/specs/2026-09-04-data-driven-engine.md` — read §2 (ground truth), §5 (schema), §6 (API), §7 (architecture rules) and §8 (testing) before Task 1. §13's three open questions are answered in "Rulings" below; they are no longer open.

## Global Constraints

- **`stats_daily` is NOT altered.** No migration touches it. Widening the documented counters shape is a contract note, not DDL.
- **Do not create `user_progress_daily`**, nor a SQL view of that name. The Mongoose name survives as a mapping only.
- **No `src/**` changes at all.** Client adoption is E4, a later plan. A task that edits `src/` has left the spec.
- **No endpoint added here may be called from `src/`.** Two writers on `stats_daily` — B2 sync (whole-object LWW) and this RPC (additive) — will silently lose increments. Shipping the contract without a caller is deliberate (§7.3).
- **No Express, Mongoose, MongoDB, `server.js`, or new Node process.** No new npm dependency of any kind.
- **Do not implement or stub `GET /api/v1/packs`.** Lane 3 stays reserved.
- **Language-blind engine:** no German string literals, no `language === 'de'` branch, no `card.de` read in `api/**`. `courseCode` / `packId` are opaque identifiers.
- **No `localStorage` key added, renamed, or migrated.**
- **Secrets stay below the trust boundary.** `SUPABASE_SERVICE_ROLE_KEY` is read in functions only; **the browser gains no new `VITE_` variable.** Direct PostgREST reads of `lessons` from the client are permitted by RLS but are out of scope — v1 has one read path, so there is one path to test.
- **`lessons` goes in neither `EXPORTED_TABLES` nor `EXCLUDED_TABLES`** in `api/v1/account/export.js`, and **`api/v1/account/export.test.js` must pass completely unchanged.** Its `'classifies every user-owned table as either exported or excluded'` case (`:45`) is the guard. If it fails, a user-owned table was added without classification — **stop and report rather than editing that test.** That is how `decks` went missing from export for two months. Those maps are for tables with a `user_id` column; adding `lessons` breaks `export.test.js`'s union-equals-every-user-owned-table assertion.
- **Do not store `totalXpEarned` or `completedQuests`.** Both are derivations (`xpForDay`, `deriveQuests`).
- **Do not reshape `counters.byTab`.** It is a per-tab round count. Per-tab verdicts, if ever wanted, are an optional sibling key.
- **Explicit `.js` extensions on every relative import in `api/**`** — including imports from `src/`. Vite and vitest resolve extensionless paths; native Node ESM on Vercel does not, and the function 500s in production with `ERR_MODULE_NOT_FOUND`. Precedent: `api/v1/league/profile.js:5` imports `'../../../src/lib/xpCore.js'`.
- **Rate-limit config uses `max`, never `limit`.** `createRateLimiter` destructures `{ windowMs, max }` (`api/_lib/ratelimit.js:64`) and compares `count <= max`. Passing `limit` leaves `max` undefined, `count <= undefined` is `false`, and **every request 429s starting with the first**. Every existing caller uses `max` — copy them.
- **Error envelope is unchanged:** failures are `{ error: { code, message } }` via `sendError`. Success bodies return the resource directly — **no `{ success: true, … }` wrapper.**
- **`.husky/pre-commit` runs `npx lint-staged` AND the full `npm test`.** A task never ends red. **Never `--no-verify`**, never `git -c core.hooksPath=...`.
- **`main` takes no direct pushes** (`enforce_admins: true`, 4 required checks). Branch + PR.

---

## File Structure

| File | Action | Responsibility |
| --- | --- | --- |
| `supabase/migrations/<ts>_lessons.sql` | Create | `lessons` table, index, CHECKs, RLS, grants |
| `supabase/migrations/<ts>_apply_progress_event.sql` | Create | Pure counters helper + `security definer` writer RPC, grants |
| `supabase/tests/rls/lessons.test.js` | Create | Public read; no client write |
| `supabase/tests/rls/progress-event.test.js` | Create | RPC privilege + additive merge through real PostgREST |
| `api/_lib/publicHandler.js` | Create | `createPublicHandler` — method → origin → IP rate → db → run. No auth. |
| `api/_lib/publicHandler.test.js` | Create | Factory contract tests |
| `api/v1/content/lessons.js` | Create | Public GET handler |
| `api/v1/content/lessons.test.js` | Create | Contract tests |
| `api/v1/progress/events.js` | Create | Authenticated POST handler |
| `api/v1/progress/events.test.js` | Create | Contract tests |
| `api/v1/progress/daily.js` | Create | Authenticated GET handler |
| `api/v1/progress/daily.test.js` | Create | Contract tests |
| `docs/api/content.md` | Create | Content lane contract |
| `docs/api/progress.md` | Create | Progress lane contract |
| `docs/api/data.md` | Modify | List `lessons` as public content, not user-owned |
| `docs/api/packs.md` | Modify | One-line pointer to `content.md`; routes stay reserved |
| `src/**` | **Do not touch** | E4 |

---

## Pre-flight: verified against the repo, 2026-09-04 (`main` @ `cf5eb53`)

The spec's §2 was spot-checked before this plan was written. **It holds** — unusually, given this repo's history of specs whose premises did not survive contact with the code. Recorded so no one re-derives it:

- `stats_daily` PK really is `(user_id, pack_id, day)` with `counters jsonb not null default '{}'` (`supabase/migrations/20260611232000_user_tables.sql:22`).
- `byTab[tab]` really is a **round count** — `src/lib/stats.js:46-47` initialises each tab to `0` and increments. Reshaping it to `{correct, incorrect, total}` would break trial, quests and merge, exactly as §2.3 says.
- `increment_rate_limit` really is `security definer set search_path = ''` with `revoke execute … from anon, authenticated` and `grant execute … to service_role`. It is a real precedent to copy.
- `EXPORTED_TABLES` / `EXCLUDED_TABLES` exist at `api/v1/account/export.js:20` and `:32`, and the comment there already cites the `decks` incident.

**Three facts the spec does not mention. All three change the work.**

1. **This project has ZERO dynamic `[param]` routes.** All twelve handlers under `api/` are static filenames, `vercel.json` has no `rewrites`, and `api/v1/league/profile.js:78` reads `req.query?.userId`. See Ruling 1 — the spec's §6.1 path and §9 file table contradict each other, and this settles it.

2. **`createAccountHandler` always calls `requireAuth`.** There is no public variant. Its chain is method → origin → IP rate → auth → user rate → optional re-auth → `serviceClient` → run. The content GET needs the same chain **minus auth**, so a factory is needed. See Ruling 2.

3. **`applyEvent`'s exact semantics, which the RPC must mirror** (`src/lib/stats.js:81-100`): normalize the previous day so every bucket exists at `0`, then `total + 1`, `bonusXp + bonus`, `byTab[tab] + 1`, `byLevel[level][verdict] + 1`. Constants: `TABS = ['chat','alphabet','vocab','translate']`, `LEVELS = ['a1','a2','b1']`, `VERDICTS = ['correct','almost','wrong']` (`src/lib/stats.js:23-25`). `xpForDay` sums `byLevel` verdicts × `XP_PER_VERDICT` **plus `bonusXp`** — so `bonusXp` moves league XP, which is why §6.2 caps it.

---

## Rulings this plan makes

The spec's §13 asks three questions and forbids an implementer from answering them in code. They are answered here.

**Ruling 1 — query parameters on static filenames, for BOTH new GET routes.** §13 Q2 asked only about `GET daily`, but §6.1's `/content/lessons/:courseCode/:level/:tab` has the same problem and is worse (three params), and it **contradicts §9's `api/v1/content/lessons.js`**, which is a static filename that cannot serve a three-segment path. Evidence for choosing query params: the project has no dynamic routes at all, no rewrites, and an existing `req.query` precedent. Introducing Vercel's dynamic-route compilation for the first time inside a slice that already adds a table, an RPC and three endpoints stacks an unknown onto a large change. Final routes:
  - `GET /api/v1/content/lessons?courseCode=de&level=a1&tab=vocab`
  - `POST /api/v1/progress/events`
  - `GET /api/v1/progress/daily?date=2026-09-04&packId=de`
  *If wrong:* the paths change and the two docs pages change with them; no schema or handler logic moves.

**Ruling 2 — add `createPublicHandler`, do not add an `auth: false` flag to `createAccountHandler`.** The spec permits either. A flag would make three separate branches conditional (auth, the user-rate limit, the re-auth gate) inside one factory that every account endpoint already depends on, and this repo has shipped a bug precisely because *the shipping flag combination had no test*. A sibling factory sharing the same primitives is ~40 lines with no conditionals. *If wrong:* one small file to fold back in.

**Ruling 3 — no seed data in E1.** §13 Q1. A `supabase/seed.sql` is exercised by neither `npm test` nor the main CI suite, so it rots invisibly, and this repo has a documented history of guards that passed while inspecting nothing. Tests insert their own rows. *If wrong:* a `vercel dev` demo needs manual inserts until someone adds a seed — and if they do, it needs a test asserting its shape.

**Ruling 4 — E4 stays out, and no task may add a caller under `src/`.** §13 Q3, and the spec already says so. Restated here because it is the one constraint whose violation is invisible in a green test run.

**Ruling 5 — the RPC is split into a pure helper plus a writer.** `public.progress_counters_apply(prev jsonb, …) returns jsonb` is `immutable` and does normalize-then-increment; `public.apply_progress_event(...)` is the `security definer` writer that calls it inside `INSERT … ON CONFLICT DO UPDATE`. This is not decoration: computing the next value from a **pre-read** would lose an increment under concurrency, which is the exact failure the RPC exists to prevent. Referencing `public.stats_daily.counters` in the `DO UPDATE` expression evaluates under the row lock, so it is atomic — the `increment_rate_limit` pattern. The split also makes the arithmetic testable without writing a row. *If wrong:* two functions to merge into one.

---

## Task 1 (E1): the `lessons` table

**Files:**
- Create: `supabase/migrations/20260904120000_lessons.sql`
- Create: `supabase/tests/rls/lessons.test.js`

**Interfaces:**
- Consumes: `adminClient`, `anonClient`, `createSignedInUser` from `supabase/tests/rls/helpers.js`.
- Produces, for Task 2: table `public.lessons` with columns `id uuid`, `pack_id text`, `course_code text`, `level text`, `unit_number integer`, `tab text`, `exercises jsonb`, `created_at`, `updated_at`; unique `(pack_id, course_code, level, tab, unit_number)`; public `select` for `anon` and `authenticated`; no client write.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260904120000_lessons.sql`:

```sql
-- Lesson content: the language-blind unit of practice. NOT user data — no
-- user_id, publicly readable, service-role-only writes. Deliberately kept out
-- of EXPORTED_TABLES / EXCLUDED_TABLES in api/v1/account/export.js, whose
-- union assertion is over tables that have an owner.
--
-- RLS is enabled in this same file, matching every other table migration and
-- the ensure_rls event trigger (20260827000000). No follow-up statement.

create table public.lessons (
  id           uuid primary key default gen_random_uuid(),
  pack_id      text not null default 'de',
  course_code  text not null default 'de',
  level        text not null,
  unit_number  integer not null check (unit_number >= 1),
  tab          text not null,
  exercises    jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (pack_id, course_code, level, tab, unit_number)
);

-- The read path is always (course_code, level, tab) ordered by unit_number.
create index lessons_lookup_idx
  on public.lessons (course_code, level, tab, unit_number);

-- Closed sets fail at insert, not at first render.
alter table public.lessons
  add constraint lessons_level_check check (level in ('a1', 'a2', 'b1'));
alter table public.lessons
  add constraint lessons_tab_check check (tab in ('chat', 'alphabet', 'vocab', 'translate'));
-- v1 is German-only, made structural. Adding 'de-he' later is one
-- drop/add constraint plus rows — not a user-table migration, not a second pack.
alter table public.lessons
  add constraint lessons_course_code_check check (course_code in ('de'));
alter table public.lessons
  add constraint lessons_exercises_is_array check (jsonb_typeof(exercises) = 'array');

alter table public.lessons enable row level security;

create policy "lessons are publicly readable"
  on public.lessons
  for select
  to anon, authenticated
  using (true);

-- No insert / update / delete policies on purpose: clients cannot write.
-- service_role bypasses RLS for seed / import.
revoke insert, update, delete on public.lessons from anon, authenticated;
grant select on public.lessons to anon, authenticated;
```

- [ ] **Step 2: Write the RLS tests**

Create `supabase/tests/rls/lessons.test.js`:

```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { adminClient, anonClient, createSignedInUser } from './helpers.js';

// lessons is CONTENT, not user data: everyone reads, nobody but service_role
// writes. That is the inverse of every other table in this suite, so the
// assertions run the opposite way round — a successful client write is the hole.

const ROW = {
  pack_id: 'de',
  course_code: 'de',
  level: 'a1',
  tab: 'vocab',
  unit_number: 1,
  exercises: [{ id: 'greet-001', type: 'flashcard', payload: {} }],
};

let A;
let seeded;

beforeAll(async () => {
  A = await createSignedInUser('lessons-a');
  const { data, error } = await adminClient.from('lessons').insert(ROW).select().single();
  expect(error).toBeNull();
  seeded = data;
});

afterAll(async () => {
  if (seeded?.id) await adminClient.from('lessons').delete().eq('id', seeded.id);
});

describe('RLS: lessons', () => {
  it('an anonymous client can read', async () => {
    const { data, error } = await anonClient.from('lessons').select('*').eq('id', seeded.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('a signed-in client can read', async () => {
    const { data, error } = await A.client.from('lessons').select('*').eq('id', seeded.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('a signed-in client CANNOT insert', async () => {
    const { error } = await A.client.from('lessons').insert({ ...ROW, unit_number: 99 });
    expect(error).not.toBeNull();
  });

  it('a signed-in client CANNOT update', async () => {
    const { error } = await A.client.from('lessons').update({ level: 'b1' }).eq('id', seeded.id);
    // PostgREST reports a blocked UPDATE as an error OR as zero rows affected;
    // assert the row is unchanged either way, which is the property that matters.
    const { data } = await adminClient.from('lessons').select('level').eq('id', seeded.id).single();
    expect(data.level).toBe('a1');
    expect(error === null || error !== null).toBe(true);
  });

  it('a signed-in client CANNOT delete', async () => {
    await A.client.from('lessons').delete().eq('id', seeded.id);
    const { data } = await adminClient.from('lessons').select('id').eq('id', seeded.id);
    expect(data).toHaveLength(1);
  });

  it('rejects a level outside the closed set', async () => {
    const { error } = await adminClient.from('lessons').insert({ ...ROW, level: 'c1', unit_number: 2 });
    expect(error).not.toBeNull();
  });

  it('rejects a course_code outside the v1 allow-list', async () => {
    const { error } = await adminClient
      .from('lessons')
      .insert({ ...ROW, course_code: 'de-he', unit_number: 3 });
    expect(error).not.toBeNull();
  });

  it('rejects exercises that are not a JSON array', async () => {
    const { error } = await adminClient
      .from('lessons')
      .insert({ ...ROW, exercises: { nope: true }, unit_number: 4 });
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 3: Apply the migration locally and run the RLS suite**

Run: `npx supabase start` (if the stack is not already up), then `npx supabase db reset` to apply migrations from scratch.

Run: `npm run test:rls`
Expected: **PASS**, including the eight new `RLS: lessons` cases.

**If `npm run test:rls` fails to connect rather than failing an assertion**, that is the known two-CLI version mix on this machine, not your code — report it and do not "fix" the tests. The suite is a separate Docker job from `npm test`.

- [ ] **Step 4: Prove the write-block tests have teeth**

The four "CANNOT" tests would pass against a table nobody can reach at all, so prove they are testing the policy and not an absence. Temporarily add a permissive policy to the migration:

```sql
create policy "TEMP" on public.lessons for all to authenticated using (true) with check (true);
```

Run `npx supabase db reset && npm run test:rls`.
Expected: the insert/update/delete cases **FAIL**. Then remove the `TEMP` policy, `db reset` again, and confirm green. **Record the failure output.**

- [ ] **Step 5: Confirm the main suite is unaffected and commit**

Run: `npm test`
Expected: **PASS**, unchanged count (this task adds no `src/` or `api/` test).

```bash
git add supabase/migrations/20260904120000_lessons.sql supabase/tests/rls/lessons.test.js
git commit -m "feat(db): lessons table — public content, service-role writes only"
```

---

## Task 2 (E2): the public content GET

**Files:**
- Create: `api/_lib/publicHandler.js`
- Create: `api/_lib/publicHandler.test.js`
- Create: `api/v1/content/lessons.js`
- Create: `api/v1/content/lessons.test.js`
- Create: `docs/api/content.md`
- Modify: `docs/api/data.md`, `docs/api/packs.md`

**Interfaces:**
- Consumes: `sendError` from `api/_lib/respond.js`; `originAllowed`, `parseAllowedOrigins` from `api/_lib/origin.js`; `createRateLimiter`, `defaultStore` from `api/_lib/ratelimit.js`; `serviceClient` from `api/_lib/supabase.js`; the `lessons` table from Task 1.
- Produces, for later tasks: `createPublicHandler({ method, ipRate, run, name, failureMessage, allowedOrigins, store })` returning `async (req, res) => …`, where `run` receives `{ req, res, db }`.

- [ ] **Step 1: Write the failing factory test**

Create `api/_lib/publicHandler.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';

vi.mock('./supabase.js', () => ({ serviceClient: vi.fn() }));

import { createPublicHandler } from './publicHandler.js';
import { serviceClient } from './supabase.js';
import { MemoryStore } from './ratelimit.js';
import { createRes } from './test-helpers.js';

let seq = 0;
const req = (over = {}) => {
  seq += 1;
  return {
    method: 'GET',
    headers: { 'x-forwarded-for': `10.1.1.${seq}`, origin: 'https://app.test' },
    query: {},
    ...over,
  };
};

const build = (over = {}) =>
  createPublicHandler({
    method: 'GET',
    ipRate: { max: 60, windowMs: 300000 },
    name: 'content',
    run: async ({ res }) => res.status(200).json({ ok: true }),
    allowedOrigins: ['https://app.test'],
    // A real MemoryStore, NOT defaultStore(): serviceClient is mocked to a
    // truthy `{}`, so defaultStore would build a SupabaseStore whose .rpc()
    // does not exist. Its increment throws, the limiter FAILS OPEN by design,
    // and the rate-limit assertion below would then pass no matter what the
    // limiter did — a second defect hiding the first.
    store: new MemoryStore(),
    ...over,
  });

describe('createPublicHandler', () => {
  it('rejects the wrong method', async () => {
    const res = createRes();
    await build()(req({ method: 'POST' }), res);
    expect(res.statusCode).toBe(405);
    expect(res.body.error.code).toBe('method_not_allowed');
  });

  it('rejects a disallowed origin', async () => {
    const res = createRes();
    await build()(req({ headers: { origin: 'https://evil.test', 'x-forwarded-for': '10.9.9.9' } }), res);
    expect(res.statusCode).toBe(403);
  });

  it('serves a request with no Authorization header — the lane is public', async () => {
    serviceClient.mockReturnValue({});
    const res = createRes();
    await build()(req(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('rate limits by IP', async () => {
    serviceClient.mockReturnValue({});
    const handler = build({ ipRate: { max: 1, windowMs: 300000 } });
    const fixedIp = { headers: { 'x-forwarded-for': '10.2.2.2', origin: 'https://app.test' } };
    await handler(req(fixedIp), createRes());
    const res = createRes();
    await handler(req(fixedIp), res);
    expect(res.statusCode).toBe(429);
    expect(res.headers['Retry-After']).toBeDefined();
  });

  it('500s rather than throwing when the database is not configured', async () => {
    serviceClient.mockReturnValue(null);
    const res = createRes();
    await build()(req(), res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error.code).toBe('server_error');
  });

  it('converts a thrown error into the envelope, and does not leak the message', async () => {
    serviceClient.mockReturnValue({});
    const res = createRes();
    await build({
      run: async () => {
        throw new Error('inner detail');
      },
      failureMessage: 'Content unavailable.',
    })(req(), res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error.message).toBe('Content unavailable.');
    expect(JSON.stringify(res.body)).not.toContain('inner detail');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run api/_lib/publicHandler.test.js`
Expected: **FAIL** — `Failed to resolve import "./publicHandler.js"`. The module does not exist yet.

- [ ] **Step 3: Write the factory**

Create `api/_lib/publicHandler.js`:

```js
import { sendError } from './respond.js';
import { originAllowed, parseAllowedOrigins } from './origin.js';
import { createRateLimiter, defaultStore } from './ratelimit.js';
import { serviceClient } from './supabase.js';

// The public sibling of createAccountHandler, for lanes that read content
// nobody owns. Same chain minus auth:
//   method → origin → IP rate → db → run
//
// A separate factory rather than an `auth: false` flag on createAccountHandler:
// the flag would make three of that factory's branches conditional (auth, the
// per-identity rate limit, the re-auth gate) in the one file every account
// endpoint depends on, and the combination that ships is exactly the one a flag
// matrix forgets to test. There is no identity here, so there is no second rate
// limit — IP is the only key available.
export function createPublicHandler({
  method,
  ipRate,
  run,
  name = 'public',
  failureMessage = 'Request failed.',
  // Injectable for tests only; production reads env and the configured store.
  allowedOrigins,
  store = defaultStore(),
}) {
  const checkIpRate = createRateLimiter({ ...ipRate, store });

  return async function handler(req, res) {
    if (req.method !== method) {
      return sendError(res, 'method_not_allowed', 'Method not allowed');
    }
    if (!originAllowed(req, allowedOrigins ?? parseAllowedOrigins(process.env.ALLOWED_ORIGINS))) {
      return sendError(res, 'forbidden', 'Origin not allowed');
    }

    const limit = await checkIpRate(req);
    if (!limit.allowed) {
      return sendError(res, 'rate_limited', 'Too many requests — slow down.', {
        'Retry-After': String(limit.retryAfterSec),
      });
    }

    const db = serviceClient();
    if (!db) return sendError(res, 'server_error', 'Server is not configured.');

    try {
      return await run({ req, res, db });
    } catch (err) {
      // console.error is the reporting channel Vercel captures; there is no
      // server-side Sentry in this project. Same precedent as accountHandler.
      console.error(`${name} failed:`, err?.message ?? err);
      return sendError(res, 'server_error', failureMessage);
    }
  };
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run api/_lib/publicHandler.test.js`
Expected: **PASS**, 6 tests.

- [ ] **Step 5: Write the failing endpoint test**

Create `api/v1/content/lessons.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../_lib/supabase.js', () => ({ serviceClient: vi.fn() }));

import handler, { sanitizeExercises, EXERCISE_TYPES } from './lessons.js';
import { serviceClient } from '../../_lib/supabase.js';
import { createRes } from '../../_lib/test-helpers.js';

let seq = 0;
const req = (query = {}, over = {}) => {
  seq += 1;
  return {
    method: 'GET',
    headers: { 'x-forwarded-for': `10.5.5.${seq}` },
    query: { courseCode: 'de', level: 'a1', tab: 'vocab', ...query },
    ...over,
  };
};

let rows;
let dbError;
let orderArgs;
const mockDb = () => ({
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(function () {
        return this;
      }),
      order: vi.fn((col, opts) => {
        orderArgs = [col, opts];
        return Promise.resolve({ data: rows, error: dbError });
      }),
    })),
  })),
});

beforeEach(() => {
  rows = [];
  dbError = null;
  orderArgs = null;
  serviceClient.mockReturnValue(mockDb());
});

describe('sanitizeExercises', () => {
  it('keeps a well-formed exercise', () => {
    const good = [{ id: 'a', type: 'flashcard', payload: { term: 'Haus' } }];
    expect(sanitizeExercises(good, 'row-1')).toEqual({ kept: good, dropped: 0 });
  });

  it('drops an element missing id or type, and reports how many', () => {
    const mixed = [
      { id: 'a', type: 'flashcard', payload: {} },
      { type: 'flashcard' },
      { id: 'c' },
    ];
    const out = sanitizeExercises(mixed, 'row-1');
    expect(out.kept).toHaveLength(1);
    expect(out.dropped).toBe(2);
  });

  it('drops an unknown type rather than serving a renderer that does not exist', () => {
    const out = sanitizeExercises([{ id: 'a', type: 'hologram', payload: {} }], 'row-1');
    expect(out.kept).toEqual([]);
    expect(out.dropped).toBe(1);
  });

  it('returns an empty array — not a throw — when EVERY element is bad', () => {
    // A malformed row must not 500 the whole tab.
    const out = sanitizeExercises([{ nope: 1 }, { also: 2 }], 'row-1');
    expect(out.kept).toEqual([]);
    expect(out.dropped).toBe(2);
  });

  it('tolerates exercises that are not an array at all', () => {
    expect(sanitizeExercises(null, 'row-1')).toEqual({ kept: [], dropped: 0 });
    expect(sanitizeExercises({ nope: true }, 'row-1')).toEqual({ kept: [], dropped: 0 });
  });

  it('exposes the closed type set', () => {
    expect(EXERCISE_TYPES).toEqual(['flashcard', 'translate', 'chat', 'multiple-choice']);
  });
});

describe('GET /api/v1/content/lessons', () => {
  it('returns lessons for a valid query', async () => {
    rows = [
      {
        id: 'r1',
        course_code: 'de',
        level: 'a1',
        tab: 'vocab',
        unit_number: 1,
        exercises: [{ id: 'e1', type: 'flashcard', payload: {} }],
      },
    ];
    const res = createRes();
    await handler(req(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.lessons).toHaveLength(1);
    expect(res.body.lessons[0].unitNumber).toBe(1);
    expect(res.body.lessons[0].exercises).toHaveLength(1);
  });

  it('returns an empty list, not a 404, when nothing matches', async () => {
    rows = [];
    const res = createRes();
    await handler(req(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.lessons).toEqual([]);
  });

  it('does NOT wrap the body in { success: true }', async () => {
    const res = createRes();
    await handler(req(), res);
    expect(res.body.success).toBeUndefined();
  });

  it('rejects an unknown courseCode', async () => {
    const res = createRes();
    await handler(req({ courseCode: 'fr' }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('bad_request');
  });

  it('rejects an unknown level and an unknown tab', async () => {
    const r1 = createRes();
    await handler(req({ level: 'c1' }), r1);
    expect(r1.statusCode).toBe(400);
    const r2 = createRes();
    await handler(req({ tab: 'dictation' }), r2);
    expect(r2.statusCode).toBe(400);
  });

  it('rejects a missing parameter rather than defaulting it', async () => {
    const res = createRes();
    await handler(req({ level: undefined }), res);
    expect(res.statusCode).toBe(400);
  });

  it('asks the database to sort by unitNumber, and preserves the order it returns', async () => {
    // Spec section 8.2 requires a sort assertion and warns that one unit cannot
    // express it. Two rows, returned 2-then-1.
    //
    // Be honest about what a mock can prove: Postgres does the ordering, so this
    // CANNOT verify the sort itself. It verifies the two things that are ours to
    // get wrong — that we asked for `unit_number` ascending, and that the mapping
    // does not reorder or drop rows on the way out. The real ordering is the
    // database's job and is covered by lessons_lookup_idx plus the RLS suite.
    rows = [
      { id: 'r2', course_code: 'de', level: 'a1', tab: 'vocab', unit_number: 2, exercises: [] },
      { id: 'r1', course_code: 'de', level: 'a1', tab: 'vocab', unit_number: 1, exercises: [] },
    ];
    const res = createRes();
    await handler(req(), res);
    expect(orderArgs).toEqual(['unit_number', { ascending: true }]);
    expect(res.body.lessons.map((l) => l.unitNumber)).toEqual([2, 1]);
  });

  it('drops a malformed exercise but still serves its siblings', async () => {
    rows = [
      {
        id: 'r1',
        course_code: 'de',
        level: 'a1',
        tab: 'vocab',
        unit_number: 1,
        exercises: [{ id: 'e1', type: 'flashcard', payload: {} }, { broken: true }],
      },
    ];
    const res = createRes();
    await handler(req(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.lessons[0].exercises).toHaveLength(1);
  });

  it('surfaces a database failure as the error envelope', async () => {
    dbError = { message: 'boom' };
    const res = createRes();
    await handler(req(), res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error.code).toBe('server_error');
    expect(JSON.stringify(res.body)).not.toContain('boom');
  });
});
```

- [ ] **Step 6: Run it and watch it fail**

Run: `npx vitest run api/v1/content/lessons.test.js`
Expected: **FAIL** — `Failed to resolve import "./lessons.js"`.

- [ ] **Step 7: Write the handler**

Create `api/v1/content/lessons.js`:

```js
import { createPublicHandler } from '../../_lib/publicHandler.js';
import { sendError } from '../../_lib/respond.js';

// Language-blind content lane. courseCode / level / tab are opaque identifiers
// validated against closed sets; no German string appears in this file, and no
// branch reads a pack's field names. Payload shape is owned by the exercise
// type and lives in pack data.
//
// Query parameters rather than a dynamic route: this project compiles twelve
// static function filenames and has no [param] routes or rewrites, and
// api/v1/league/profile.js already reads req.query. See the plan's Ruling 1.

const COURSE_CODES = ['de'];
const LEVELS = ['a1', 'a2', 'b1'];
const TABS = ['chat', 'alphabet', 'vocab', 'translate'];

/** The closed set of renderers the engine knows how to call. */
export const EXERCISE_TYPES = ['flashcard', 'translate', 'chat', 'multiple-choice'];

/**
 * Drop exercise elements the engine could not render, and say how many went.
 *
 * SQL cannot cheaply enforce "every array element has id + type" without a
 * constraint trigger, so a bad row is filtered on the way out instead. It
 * returns the count as well as the survivors because "served 3 of 3" and
 * "served 3 of 40" are the same response body otherwise — a seed that silently
 * loses most of its content would look exactly like a short lesson.
 */
export function sanitizeExercises(exercises, rowId) {
  if (!Array.isArray(exercises)) return { kept: [], dropped: 0 };
  const kept = exercises.filter(
    (ex) =>
      ex &&
      typeof ex.id === 'string' &&
      ex.id.length > 0 &&
      typeof ex.type === 'string' &&
      EXERCISE_TYPES.includes(ex.type)
  );
  const dropped = exercises.length - kept.length;
  if (dropped > 0) {
    console.error(`content: lesson ${rowId} dropped ${dropped}/${exercises.length} exercises`);
  }
  return { kept, dropped };
}

const handler = createPublicHandler({
  method: 'GET',
  ipRate: { max: 120, windowMs: 300000 },
  name: 'content lessons',
  failureMessage: 'Content unavailable.',
  run: async ({ req, res, db }) => {
    const courseCode = req.query?.courseCode;
    const level = req.query?.level;
    const tab = req.query?.tab;

    if (!COURSE_CODES.includes(courseCode)) {
      return sendError(res, 'bad_request', 'Unknown courseCode.');
    }
    if (!LEVELS.includes(level)) {
      return sendError(res, 'bad_request', 'Unknown level.');
    }
    if (!TABS.includes(tab)) {
      return sendError(res, 'bad_request', 'Unknown tab.');
    }

    const { data, error } = await db
      .from('lessons')
      .select('id, course_code, level, tab, unit_number, exercises')
      .eq('course_code', courseCode)
      .eq('level', level)
      .eq('tab', tab)
      .order('unit_number', { ascending: true });

    if (error) {
      console.error('content lessons query failed:', error.message);
      return sendError(res, 'server_error', 'Content unavailable.');
    }

    const lessons = (data ?? []).map((row) => ({
      id: row.id,
      courseCode: row.course_code,
      level: row.level,
      tab: row.tab,
      unitNumber: row.unit_number,
      exercises: sanitizeExercises(row.exercises, row.id).kept,
    }));

    return res.status(200).json({ lessons });
  },
});

export default handler;
```

- [ ] **Step 8: Run both files and watch them pass**

Run: `npx vitest run api/_lib/publicHandler.test.js api/v1/content/lessons.test.js`
Expected: **PASS**, 6 + 15 tests.

- [ ] **Step 9: Write the docs page**

Create `docs/api/content.md`:

````markdown
# Content lane — `/api/v1/content/*`

Lesson content is **public**: no `Authorization` header, no user rows, no
ownership. It is the API twin of the static lexicon under `/lexicon/de/`.

## `GET /api/v1/content/lessons`

Query parameters (all required, all validated against closed sets):

| Param | Values |
| --- | --- |
| `courseCode` | `de` |
| `level` | `a1` · `a2` · `b1` |
| `tab` | `chat` · `alphabet` · `vocab` · `translate` |

Query parameters rather than path segments: this project compiles static
function filenames and has no dynamic `[param]` routes.

```
GET /api/v1/content/lessons?courseCode=de&level=a1&tab=vocab
```

**200**

```json
{
  "lessons": [
    {
      "id": "…uuid…",
      "courseCode": "de",
      "level": "a1",
      "tab": "vocab",
      "unitNumber": 1,
      "exercises": [{ "id": "greet-001", "type": "flashcard", "payload": {} }]
    }
  ]
}
```

No `{ "success": true }` wrapper — the rest of `/api/v1` returns the resource
directly and puts failure in `{ "error": { "code", "message" } }`.

An empty result is `200` with `"lessons": []`, never `404`. A tab with no
units yet is not an error.

**Exercise types** are a closed set: `flashcard` · `translate` · `chat` ·
`multiple-choice`. `alphabet` is a *tab*, not a type — an alphabet unit is a
row with `tab = 'alphabet'` whose exercises are flashcards or
multiple-choice. `payload` is schemaless and owned by the type; the API does
not validate its keys.

An element missing `id` or `type`, or carrying an unknown `type`, is dropped
from the response and logged with a count. A malformed row does not fail the
request — one bad exercise must not take down a whole tab.

**Errors:** `400 bad_request` (unknown or missing parameter), `403 forbidden`
(origin), `405 method_not_allowed`, `429 rate_limited`, `500 server_error`.

**Writes:** none. `lessons` has no insert/update/delete policy; seed and
import go through `service_role`.
````

- [ ] **Step 10: Update the two existing docs pages**

In `docs/api/data.md`, add `lessons` to the tables list, marked as public content that is **not** user-owned and therefore appears in neither `EXPORTED_TABLES` nor `EXCLUDED_TABLES`.

In `docs/api/packs.md`, add exactly one line near the top and change nothing else:

```markdown
> Not to be confused with the lesson-unit slice: `GET /api/v1/content/lessons`
> ships today and is documented in `content.md`. The `/api/v1/packs` routes
> below remain **reserved** — do not implement or stub them.
```

- [ ] **Step 11: Run the full suite and commit**

Run: `npm test` → **PASS**. Run `npm run lint` and `npx prettier --check` on the new files → clean.

```bash
git add api/_lib/publicHandler.js api/_lib/publicHandler.test.js api/v1/content docs/api/content.md docs/api/data.md docs/api/packs.md
git commit -m "feat(api): public content lane for lesson units"
```

---

## Task 3 (E3a): the additive-increment RPC

The server twin of `applyEvent`. This is the task where a plausible-looking implementation silently loses data under concurrency, so read Ruling 5 before starting.

**Files:**
- Create: `supabase/migrations/20260904121000_apply_progress_event.sql`
- Create: `supabase/tests/rls/progress-event.test.js`

**Interfaces:**
- Consumes: `public.stats_daily` (existing, unaltered).
- Produces, for Task 4:
  - `public.progress_counters_apply(prev jsonb, p_tab text, p_level text, p_verdict text, p_bonus_xp integer) returns jsonb` — pure, `immutable`, normalize-then-increment.
  - `public.apply_progress_event(p_user_id uuid, p_pack_id text, p_day date, p_tab text, p_level text, p_verdict text, p_bonus_xp integer) returns jsonb` — `security definer`, writes the row, returns the resulting counters. Executable by `service_role` only.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260904121000_apply_progress_event.sql`:

```sql
-- The server twin of src/lib/stats.js applyEvent.
--
-- WHY A FUNCTION AND NOT A CLIENT UPSERT: an event is an INCREMENT. A client
-- doing read-modify-write on `counters` races itself across two devices — the
-- same reason B1 rejected JS-side rate-limit increments. increment_rate_limit
-- is the pattern being copied.
--
-- WHY TWO FUNCTIONS: progress_counters_apply is pure arithmetic and can be
-- tested without writing a row. apply_progress_event is the privileged writer,
-- and it calls the helper INSIDE `on conflict do update`, where the expression
-- is evaluated against the locked existing row. Computing the next value from a
-- separate SELECT first would reopen the very race this function exists to
-- close: two concurrent events would both read the same `prev` and one
-- increment would vanish.

-- Pure: normalize every bucket to 0, then increment exactly the four counters
-- applyEvent increments. Mirrors normalizeDayAggregate — a partially-written
-- entry (older schema, or one merged in by sync) would otherwise produce NULL
-- where a number belongs, and NULL spreads silently through the XP arithmetic.
create or replace function public.progress_counters_apply(
  prev        jsonb,
  p_tab       text,
  p_level     text,
  p_verdict   text,
  p_bonus_xp  integer
) returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  tabs     text[] := array['chat', 'alphabet', 'vocab', 'translate'];
  levels   text[] := array['a1', 'a2', 'b1'];
  verdicts text[] := array['correct', 'almost', 'wrong'];
  out_json jsonb;
  t        text;
  lv       text;
  vd       text;
begin
  out_json := jsonb_build_object(
    'total',   coalesce((prev->>'total')::integer, 0),
    'bonusXp', coalesce((prev->>'bonusXp')::integer, 0),
    'byTab',   '{}'::jsonb,
    'byLevel', '{}'::jsonb
  );

  foreach t in array tabs loop
    out_json := jsonb_set(out_json, array['byTab', t],
      to_jsonb(coalesce((prev->'byTab'->>t)::integer, 0)));
  end loop;

  foreach lv in array levels loop
    out_json := jsonb_set(out_json, array['byLevel', lv], '{}'::jsonb);
    foreach vd in array verdicts loop
      out_json := jsonb_set(out_json, array['byLevel', lv, vd],
        to_jsonb(coalesce((prev->'byLevel'->lv->>vd)::integer, 0)));
    end loop;
  end loop;

  out_json := jsonb_set(out_json, '{total}',
    to_jsonb((out_json->>'total')::integer + 1));
  out_json := jsonb_set(out_json, '{bonusXp}',
    to_jsonb((out_json->>'bonusXp')::integer + coalesce(p_bonus_xp, 0)));
  out_json := jsonb_set(out_json, array['byTab', p_tab],
    to_jsonb((out_json->'byTab'->>p_tab)::integer + 1));
  out_json := jsonb_set(out_json, array['byLevel', p_level, p_verdict],
    to_jsonb((out_json->'byLevel'->p_level->>p_verdict)::integer + 1));

  return out_json;
end $$;

create or replace function public.apply_progress_event(
  p_user_id   uuid,
  p_pack_id   text,
  p_day       date,
  p_tab       text,
  p_level     text,
  p_verdict   text,
  p_bonus_xp  integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_counters jsonb;
begin
  if p_tab not in ('chat', 'alphabet', 'vocab', 'translate') then
    raise exception 'invalid tab: %', p_tab;
  end if;
  if p_level not in ('a1', 'a2', 'b1') then
    raise exception 'invalid level: %', p_level;
  end if;
  if p_verdict not in ('correct', 'almost', 'wrong') then
    raise exception 'invalid verdict: %', p_verdict;
  end if;

  -- One statement. The DO UPDATE expression reads the LOCKED existing row, so
  -- concurrent events serialise instead of clobbering one another.
  insert into public.stats_daily (user_id, pack_id, day, counters, updated_at)
  values (
    p_user_id, p_pack_id, p_day,
    public.progress_counters_apply('{}'::jsonb, p_tab, p_level, p_verdict, p_bonus_xp),
    now()
  )
  on conflict (user_id, pack_id, day) do update
    set counters = public.progress_counters_apply(
          public.stats_daily.counters, p_tab, p_level, p_verdict, p_bonus_xp),
        -- Server clock, unlike B2's writer-set LWW. See spec section 7.3
        -- before enabling a client that uses both write paths.
        updated_at = now()
  returning counters into next_counters;

  return next_counters;
end $$;

-- service_role only, exactly like increment_rate_limit. The Vercel function is
-- the only caller; a browser must never reach this directly.
revoke execute on function public.progress_counters_apply(jsonb, text, text, text, integer) from public;
revoke execute on function public.progress_counters_apply(jsonb, text, text, text, integer) from anon, authenticated;
grant  execute on function public.progress_counters_apply(jsonb, text, text, text, integer) to service_role;

revoke execute on function public.apply_progress_event(uuid, text, date, text, text, text, integer) from public;
revoke execute on function public.apply_progress_event(uuid, text, date, text, text, text, integer) from anon, authenticated;
grant  execute on function public.apply_progress_event(uuid, text, date, text, text, text, integer) to service_role;
```

- [ ] **Step 2: Write the RPC tests**

Create `supabase/tests/rls/progress-event.test.js`:

```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { adminClient, createSignedInUser } from './helpers.js';

// Two properties, and they are different questions:
//   1. privilege — a signed-in client must NOT be able to call the RPC
//   2. arithmetic — the merge is ADDITIVE and matches applyEvent
// A single test that "the RPC works" would miss the first entirely.

const DAY = '2026-09-04';
let A;

const callAsService = (over = {}) =>
  adminClient.rpc('apply_progress_event', {
    p_user_id: A.id,
    p_pack_id: 'de',
    p_day: DAY,
    p_tab: 'vocab',
    p_level: 'a1',
    p_verdict: 'correct',
    p_bonus_xp: 0,
    ...over,
  });

beforeAll(async () => {
  A = await createSignedInUser('progress-a');
});

afterAll(async () => {
  await adminClient.from('stats_daily').delete().eq('user_id', A.id);
});

describe('apply_progress_event: privilege', () => {
  it('a signed-in client CANNOT execute the RPC', async () => {
    const { error } = await A.client.rpc('apply_progress_event', {
      p_user_id: A.id,
      p_pack_id: 'de',
      p_day: DAY,
      p_tab: 'vocab',
      p_level: 'a1',
      p_verdict: 'correct',
      p_bonus_xp: 0,
    });
    expect(error).not.toBeNull();
  });

  it('a signed-in client CANNOT execute the pure helper either', async () => {
    const { error } = await A.client.rpc('progress_counters_apply', {
      prev: {},
      p_tab: 'vocab',
      p_level: 'a1',
      p_verdict: 'correct',
      p_bonus_xp: 0,
    });
    expect(error).not.toBeNull();
  });
});

describe('apply_progress_event: arithmetic', () => {
  it('creates the row with a fully-normalised aggregate', async () => {
    const { data, error } = await callAsService();
    expect(error).toBeNull();
    expect(data.total).toBe(1);
    expect(data.bonusXp).toBe(0);
    // Every bucket present at 0 — the shape normalizeDayAggregate would produce.
    expect(Object.keys(data.byTab).sort()).toEqual(['alphabet', 'chat', 'translate', 'vocab']);
    expect(Object.keys(data.byLevel).sort()).toEqual(['a1', 'a2', 'b1']);
    expect(data.byTab.vocab).toBe(1);
    expect(data.byTab.chat).toBe(0);
    expect(data.byLevel.a1.correct).toBe(1);
    expect(data.byLevel.a1.wrong).toBe(0);
    expect(data.byLevel.b1.correct).toBe(0);
  });

  it('ADDS to the existing row rather than replacing it', async () => {
    const { data } = await callAsService({ p_tab: 'chat', p_verdict: 'almost', p_bonus_xp: 5 });
    expect(data.total).toBe(2);
    expect(data.bonusXp).toBe(5);
    // The first event's tab count survived — this is the whole point.
    expect(data.byTab.vocab).toBe(1);
    expect(data.byTab.chat).toBe(1);
    expect(data.byLevel.a1.correct).toBe(1);
    expect(data.byLevel.a1.almost).toBe(1);
  });

  it('heals a partially-written counters object instead of producing NULL', async () => {
    // Exactly what an older client or a merged remote day can leave behind.
    await adminClient
      .from('stats_daily')
      .update({ counters: { total: 7 } })
      .eq('user_id', A.id)
      .eq('day', DAY);
    const { data, error } = await callAsService();
    expect(error).toBeNull();
    expect(data.total).toBe(8);
    expect(data.byTab.vocab).toBe(1);
    expect(data.byLevel.a1.correct).toBe(1);
    expect(data.bonusXp).toBe(0);
  });

  it('rejects a tab, level or verdict outside the closed sets', async () => {
    const bad = await callAsService({ p_tab: 'dictation' });
    expect(bad.error).not.toBeNull();
    const bad2 = await callAsService({ p_level: 'c1' });
    expect(bad2.error).not.toBeNull();
    const bad3 = await callAsService({ p_verdict: 'perfect' });
    expect(bad3.error).not.toBeNull();
  });

  it('keeps concurrent events from clobbering each other', async () => {
    // The property the ON CONFLICT form exists for. A read-then-write
    // implementation passes every test above and fails this one.
    const day = '2026-09-05';
    const runs = Array.from({ length: 10 }, () => callAsService({ p_day: day }));
    await Promise.all(runs);
    const { data } = await adminClient
      .from('stats_daily')
      .select('counters')
      .eq('user_id', A.id)
      .eq('day', day)
      .single();
    expect(data.counters.total).toBe(10);
    expect(data.counters.byTab.vocab).toBe(10);
  });
});
```

- [ ] **Step 3: Apply and run**

Run: `npx supabase db reset && npm run test:rls`
Expected: **PASS**, including the eight new cases.

- [ ] **Step 4: Prove the concurrency test has teeth**

`'keeps concurrent events from clobbering each other'` is the only test that distinguishes the atomic form from a read-then-write one, and it passes trivially if the arithmetic happens to serialise. Prove it fails against the naive implementation.

Temporarily replace the body of `apply_progress_event` with the read-then-write form:

```sql
declare
  prev jsonb;
  next_counters jsonb;
begin
  select counters into prev from public.stats_daily
    where user_id = p_user_id and pack_id = p_pack_id and day = p_day;
  next_counters := public.progress_counters_apply(coalesce(prev, '{}'::jsonb), p_tab, p_level, p_verdict, p_bonus_xp);
  insert into public.stats_daily (user_id, pack_id, day, counters, updated_at)
    values (p_user_id, p_pack_id, p_day, next_counters, now())
  on conflict (user_id, pack_id, day) do update
    set counters = next_counters, updated_at = now();
  return next_counters;
end
```

Run `npx supabase db reset && npm run test:rls`.
Expected: the concurrency case **FAILS** with a total below 10. Then restore the `ON CONFLICT` version, `db reset` again, and confirm green. **Record the observed total.**

If the naive version *also* reaches 10, the test is not actually concurrent in this harness — say so and do not claim the property is proven.

- [ ] **Step 5: Commit**

Run `npm test` (unchanged) and `npm run lint`.

```bash
git add supabase/migrations/20260904121000_apply_progress_event.sql supabase/tests/rls/progress-event.test.js
git commit -m "feat(db): apply_progress_event — the server twin of applyEvent"
```

---

## Task 4 (E3b): the two progress endpoints

**Files:**
- Create: `api/v1/progress/events.js`, `api/v1/progress/events.test.js`
- Create: `api/v1/progress/daily.js`, `api/v1/progress/daily.test.js`
- Create: `docs/api/progress.md`

**Interfaces:**
- Consumes: `createAccountHandler` from `api/_lib/accountHandler.js` (which supplies `{ req, res, auth, db }`, where `auth.userId` is the caller); `sendError`; the two functions from Task 3.
- Produces: nothing further. **No `src/` file imports these.**

- [ ] **Step 1: Write the failing POST test**

Create `api/v1/progress/events.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../_lib/supabase.js', () => ({ serviceClient: vi.fn() }));
vi.mock('../../_lib/auth-middleware.js', () => ({ requireAuth: vi.fn() }));

import handler, { validateEventBody, MAX_BONUS_XP } from './events.js';
import { serviceClient } from '../../_lib/supabase.js';
import { requireAuth } from '../../_lib/auth-middleware.js';
import { createRes } from '../../_lib/test-helpers.js';

const USER = { userId: 'uid-1', email: 'a@b.com' };

let seq = 0;
const req = (body, method = 'POST') => {
  seq += 1;
  return {
    method,
    headers: { 'x-forwarded-for': `10.7.7.${seq}`, authorization: 'Bearer tok' },
    body,
  };
};

const VALID = { dateKey: '2026-09-04', tab: 'vocab', level: 'a1', verdict: 'correct' };

let rpcResult;
let rpcArgs;
const mockDb = () => ({
  rpc: vi.fn((name, args) => {
    rpcArgs = { name, args };
    return Promise.resolve(rpcResult);
  }),
});

beforeEach(() => {
  rpcArgs = null;
  rpcResult = { data: { total: 1, bonusXp: 0, byTab: {}, byLevel: {} }, error: null };
  serviceClient.mockReturnValue(mockDb());
  requireAuth.mockResolvedValue(USER);
});

describe('validateEventBody', () => {
  it('accepts a well-formed body and defaults packId and bonusXp', () => {
    const out = validateEventBody(VALID);
    expect(out.ok).toBe(true);
    expect(out.value.packId).toBe('de');
    expect(out.value.bonusXp).toBe(0);
  });

  it('rejects a dateKey that is not YYYY-MM-DD', () => {
    for (const bad of ['2026-9-4', '04-09-2026', 'today', '2026-09-04T00:00:00Z', '']) {
      expect(validateEventBody({ ...VALID, dateKey: bad }).ok).toBe(false);
    }
  });

  it('names packId when a caller sends courseCode, rather than aliasing it', () => {
    const out = validateEventBody({ ...VALID, courseCode: 'de' });
    expect(out.ok).toBe(false);
    expect(out.message).toMatch(/packId/);
  });

  it('rejects an unknown tab, level or verdict', () => {
    expect(validateEventBody({ ...VALID, tab: 'dictation' }).ok).toBe(false);
    expect(validateEventBody({ ...VALID, level: 'c1' }).ok).toBe(false);
    expect(validateEventBody({ ...VALID, verdict: 'perfect' }).ok).toBe(false);
  });

  it('rejects a packId other than de in v1', () => {
    expect(validateEventBody({ ...VALID, packId: 'en' }).ok).toBe(false);
  });

  it('caps bonusXp and rejects negative or non-integer values', () => {
    expect(validateEventBody({ ...VALID, bonusXp: MAX_BONUS_XP }).ok).toBe(true);
    expect(validateEventBody({ ...VALID, bonusXp: MAX_BONUS_XP + 1 }).ok).toBe(false);
    expect(validateEventBody({ ...VALID, bonusXp: -1 }).ok).toBe(false);
    expect(validateEventBody({ ...VALID, bonusXp: 1.5 }).ok).toBe(false);
    expect(validateEventBody({ ...VALID, bonusXp: '5' }).ok).toBe(false);
  });

  it('accepts a body that arrived unparsed', () => {
    expect(validateEventBody(JSON.stringify(VALID)).ok).toBe(true);
  });
});

describe('POST /api/v1/progress/events', () => {
  it('calls the RPC with the authenticated user, never a body-supplied id', async () => {
    const res = createRes();
    await handler(req({ ...VALID, userId: 'someone-else' }), res);
    expect(res.statusCode).toBe(200);
    expect(rpcArgs.name).toBe('apply_progress_event');
    expect(rpcArgs.args.p_user_id).toBe(USER.userId);
  });

  it('returns the resulting counters', async () => {
    const res = createRes();
    await handler(req(VALID), res);
    expect(res.body.dateKey).toBe('2026-09-04');
    expect(res.body.packId).toBe('de');
    expect(res.body.counters.total).toBe(1);
    expect(res.body.success).toBeUndefined();
  });

  it('does not overwrite the learner-supplied dateKey with a server clock', async () => {
    const res = createRes();
    await handler(req({ ...VALID, dateKey: '2026-01-15' }), res);
    expect(rpcArgs.args.p_day).toBe('2026-01-15');
    expect(res.body.dateKey).toBe('2026-01-15');
  });

  it('rejects the wrong method', async () => {
    const res = createRes();
    await handler(req(VALID, 'GET'), res);
    expect(res.statusCode).toBe(405);
  });

  it('rejects a request with no valid JWT', async () => {
    // The factory owns this, but spec section 8.2 names it for this endpoint,
    // and the lane writes user-scoped rows — worth pinning here too.
    requireAuth.mockRejectedValue(
      Object.assign(new Error('Missing token.'), { code: 'unauthorized' })
    );
    const res = createRes();
    await handler(req(VALID), res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });

  it('rejects a malformed body with 400', async () => {
    const res = createRes();
    await handler(req({ ...VALID, verdict: 'perfect' }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('bad_request');
  });

  it('surfaces an RPC failure as the envelope without leaking the message', async () => {
    rpcResult = { data: null, error: { message: 'pg detail' } };
    const res = createRes();
    await handler(req(VALID), res);
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('pg detail');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run api/v1/progress/events.test.js`
Expected: **FAIL** — `Failed to resolve import "./events.js"`.

- [ ] **Step 3: Write the POST handler**

Create `api/v1/progress/events.js`:

```js
import { createAccountHandler } from '../../_lib/accountHandler.js';
import { sendError } from '../../_lib/respond.js';

// Generic progress events. The write goes through one Postgres function
// because an event is an INCREMENT: client-side read-modify-write on
// `counters` races across devices.
//
// NOT CALLED FROM src/. B2 sync already writes stats_daily with whole-object
// LWW, and enabling both writers loses increments — see spec section 7.3. A
// later plan that moves the signed-in path onto this endpoint must disable the
// stats_daily sync adapter in the same PR.

const TABS = ['chat', 'alphabet', 'vocab', 'translate'];
const LEVELS = ['a1', 'a2', 'b1'];
const VERDICTS = ['correct', 'almost', 'wrong'];
const PACK_IDS = ['de'];
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Cap so a crafted token cannot drop an enormous bonus onto the league. */
export const MAX_BONUS_XP = 500;

export function validateEventBody(raw) {
  let body = raw;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return { ok: false, message: 'Body must be JSON.' };
    }
  }
  if (!body || typeof body !== 'object') return { ok: false, message: 'Body must be an object.' };

  // Named explicitly rather than aliased: progress is pack-scoped, and
  // silently accepting courseCode is how two keys drift apart.
  if ('courseCode' in body) {
    return { ok: false, message: 'Progress is pack-scoped: send packId, not courseCode.' };
  }

  const { dateKey, tab, level, verdict } = body;
  if (typeof dateKey !== 'string' || !DATE_KEY.test(dateKey)) {
    return { ok: false, message: 'dateKey must be YYYY-MM-DD.' };
  }
  if (!TABS.includes(tab)) return { ok: false, message: 'Unknown tab.' };
  if (!LEVELS.includes(level)) return { ok: false, message: 'Unknown level.' };
  if (!VERDICTS.includes(verdict)) return { ok: false, message: 'Unknown verdict.' };

  const packId = body.packId ?? 'de';
  if (!PACK_IDS.includes(packId)) return { ok: false, message: 'Unknown packId.' };

  const bonusXp = body.bonusXp ?? 0;
  if (!Number.isInteger(bonusXp) || bonusXp < 0 || bonusXp > MAX_BONUS_XP) {
    return { ok: false, message: `bonusXp must be an integer between 0 and ${MAX_BONUS_XP}.` };
  }

  return { ok: true, value: { dateKey, packId, tab, level, verdict, bonusXp } };
}

const handler = createAccountHandler({
  method: 'POST',
  ipRate: { max: 120, windowMs: 300000 },
  userRate: { max: 60, windowMs: 300000 },
  name: 'progress events',
  failureMessage: 'Could not record progress.',
  run: async ({ req, res, auth, db }) => {
    const parsed = validateEventBody(req.body);
    if (!parsed.ok) return sendError(res, 'bad_request', parsed.message);

    const { dateKey, packId, tab, level, verdict, bonusXp } = parsed.value;

    const { data, error } = await db.rpc('apply_progress_event', {
      // The authenticated identity, never a body field.
      p_user_id: auth.userId,
      p_pack_id: packId,
      p_day: dateKey,
      p_tab: tab,
      p_level: level,
      p_verdict: verdict,
      p_bonus_xp: bonusXp,
    });

    if (error) {
      console.error('apply_progress_event failed:', error.message);
      return sendError(res, 'server_error', 'Could not record progress.');
    }

    return res.status(200).json({ dateKey, packId, counters: data });
  },
});

export default handler;
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run api/v1/progress/events.test.js`
Expected: **PASS**, 14 tests.

- [ ] **Step 5: Write the failing GET test**

Create `api/v1/progress/daily.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../_lib/supabase.js', () => ({ serviceClient: vi.fn() }));
vi.mock('../../_lib/auth-middleware.js', () => ({ requireAuth: vi.fn() }));

import handler, { emptyCounters } from './daily.js';
import { serviceClient } from '../../_lib/supabase.js';
import { requireAuth } from '../../_lib/auth-middleware.js';
import { createRes } from '../../_lib/test-helpers.js';

const USER = { userId: 'uid-1', email: 'a@b.com' };

let seq = 0;
const req = (query = {}, method = 'GET') => {
  seq += 1;
  return {
    method,
    headers: { 'x-forwarded-for': `10.8.8.${seq}`, authorization: 'Bearer tok' },
    query: { date: '2026-09-04', ...query },
  };
};

let row;
let dbError;
let filters;
const mockDb = () => ({
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(function (col, val) {
        filters.push([col, val]);
        return this;
      }),
      maybeSingle: vi.fn().mockResolvedValue({ data: row, error: dbError }),
    })),
  })),
});

beforeEach(() => {
  row = null;
  dbError = null;
  filters = [];
  serviceClient.mockReturnValue(mockDb());
  requireAuth.mockResolvedValue(USER);
});

describe('emptyCounters', () => {
  it('is the zeroed aggregate the Stats tab expects, not an empty object', () => {
    const empty = emptyCounters();
    expect(empty.total).toBe(0);
    expect(empty.bonusXp).toBe(0);
    expect(Object.keys(empty.byTab).sort()).toEqual(['alphabet', 'chat', 'translate', 'vocab']);
    expect(empty.byLevel.a1).toEqual({ correct: 0, almost: 0, wrong: 0 });
    expect(Object.keys(empty.byLevel).sort()).toEqual(['a1', 'a2', 'b1']);
  });
});

describe('GET /api/v1/progress/daily', () => {
  it('returns the stored counters for the caller', async () => {
    row = { counters: { total: 3, bonusXp: 0, byTab: {}, byLevel: {} } };
    const res = createRes();
    await handler(req(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.counters.total).toBe(3);
    expect(res.body.dateKey).toBe('2026-09-04');
    expect(res.body.packId).toBe('de');
  });

  it('scopes the query to the authenticated user', async () => {
    await handler(req(), createRes());
    expect(filters).toContainEqual(['user_id', USER.userId]);
    expect(filters).toContainEqual(['day', '2026-09-04']);
    expect(filters).toContainEqual(['pack_id', 'de']);
  });

  it('returns zeros rather than 404 for a quiet day', async () => {
    row = null;
    const res = createRes();
    await handler(req(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.counters.total).toBe(0);
    expect(res.body.counters.byLevel.a1.correct).toBe(0);
  });

  it('rejects a malformed date', async () => {
    const res = createRes();
    await handler(req({ date: '2026-9-4' }), res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects an unknown packId', async () => {
    const res = createRes();
    await handler(req({ packId: 'en' }), res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects the wrong method', async () => {
    const res = createRes();
    await handler(req({}, 'POST'), res);
    expect(res.statusCode).toBe(405);
  });

  it('surfaces a database failure without leaking the message', async () => {
    dbError = { message: 'pg detail' };
    const res = createRes();
    await handler(req(), res);
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('pg detail');
  });
});
```

- [ ] **Step 6: Run it and watch it fail**

Run: `npx vitest run api/v1/progress/daily.test.js`
Expected: **FAIL** — `Failed to resolve import "./daily.js"`.

- [ ] **Step 7: Write the GET handler**

Create `api/v1/progress/daily.js`:

```js
import { createAccountHandler } from '../../_lib/accountHandler.js';
import { sendError } from '../../_lib/respond.js';

// Completes the developer interface: read a day back without a browser
// supabase-js select. The signed-in PWA does not have to switch to this — the
// existing sync pull keeps working.
//
// Query parameter rather than a dynamic route segment: this project compiles
// static function filenames and has no [param] routes. See the plan's Ruling 1.

const TABS = ['chat', 'alphabet', 'vocab', 'translate'];
const LEVELS = ['a1', 'a2', 'b1'];
const VERDICTS = ['correct', 'almost', 'wrong'];
const PACK_IDS = ['de'];
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The zeroed aggregate, mirroring emptyDayAggregate in src/lib/stats.js.
 * A quiet day is zeros, never a 404 and never `{}` — readers index straight
 * into byLevel[level][verdict], and an empty object gives them undefined.
 */
export function emptyCounters() {
  const byTab = {};
  for (const tab of TABS) byTab[tab] = 0;
  const byLevel = {};
  for (const level of LEVELS) {
    byLevel[level] = {};
    for (const verdict of VERDICTS) byLevel[level][verdict] = 0;
  }
  return { total: 0, bonusXp: 0, byTab, byLevel };
}

const handler = createAccountHandler({
  method: 'GET',
  ipRate: { max: 120, windowMs: 300000 },
  userRate: { max: 60, windowMs: 300000 },
  name: 'progress daily',
  failureMessage: 'Could not read progress.',
  run: async ({ req, res, auth, db }) => {
    const dateKey = req.query?.date;
    if (typeof dateKey !== 'string' || !DATE_KEY.test(dateKey)) {
      return sendError(res, 'bad_request', 'date must be YYYY-MM-DD.');
    }
    const packId = req.query?.packId ?? 'de';
    if (!PACK_IDS.includes(packId)) {
      return sendError(res, 'bad_request', 'Unknown packId.');
    }

    const { data, error } = await db
      .from('stats_daily')
      .select('counters')
      .eq('user_id', auth.userId)
      .eq('pack_id', packId)
      .eq('day', dateKey)
      .maybeSingle();

    if (error) {
      console.error('progress daily query failed:', error.message);
      return sendError(res, 'server_error', 'Could not read progress.');
    }

    return res.status(200).json({
      dateKey,
      packId,
      counters: data?.counters ?? emptyCounters(),
    });
  },
});

export default handler;
```

- [ ] **Step 8: Run it and watch it pass**

Run: `npx vitest run api/v1/progress/daily.test.js`
Expected: **PASS**, 8 tests.

- [ ] **Step 9: Assert the no-caller rule mechanically**

The most important constraint in this slice is invisible in a green suite: nothing under `src/` may call these endpoints. Add this to `api/v1/progress/events.test.js`:

```js
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(js|jsx)$/.test(full)) out.push(full);
  }
  return out;
}

describe('the progress lane has no client caller', () => {
  it('nothing under src/ references the progress endpoints', () => {
    // Spec section 7.3: B2 sync writes stats_daily with whole-object LWW and
    // this RPC writes additively. Both live at once loses increments, silently,
    // and no unit test would show it. E4 is the plan that switches one off.
    const offenders = walk('src').filter((f) =>
      /\/api\/v1\/progress\//.test(readFileSync(f, 'utf8'))
    );
    expect(offenders).toEqual([]);
  });
});
```

Prove it has teeth: temporarily add the literal string `'/api/v1/progress/events'` to any file under `src/`, run the test, confirm it **FAILS** and names that file, then revert and confirm green. **Record the failure output.**

- [ ] **Step 10: Write the docs page**

Create `docs/api/progress.md`:

````markdown
# Progress lane — `/api/v1/progress/*`

> **These endpoints are not called by the app, deliberately.**
> `stats_daily` already has a writer: the B2 sync adapter, which pushes the
> whole `counters` object last-write-wins. This lane writes *additively*.
> Running both against the same day loses increments — sync overwrites a row
> the RPC just updated, or the RPC increments a stale snapshot that sync then
> pushes back. A later plan that moves the signed-in client onto this lane
> **must disable the `stats_daily` sync adapter in the same PR**, with a test
> that fails if both write.

Both endpoints require `Authorization: Bearer <jwt>`. Rate limit: 60 requests
per 5 minutes per user id, plus an IP limit ahead of authentication.

## `POST /api/v1/progress/events`

One answered card is one event. The write goes through a Postgres function
because an event is an **increment** — client-side read-modify-write on
`counters` races across devices.

```json
{
  "dateKey": "2026-09-04",
  "packId": "de",
  "tab": "vocab",
  "level": "a1",
  "verdict": "correct",
  "bonusXp": 0
}
```

| Field | Rule |
| --- | --- |
| `dateKey` | `YYYY-MM-DD`, required. The server does **not** overwrite it with its own clock: the learner's local day is the streak day. |
| `packId` | Optional, default `de`. v1 accepts only `de`. |
| `tab` | `chat` · `alphabet` · `vocab` · `translate` |
| `level` | `a1` · `a2` · `b1` |
| `verdict` | `correct` · `almost` · `wrong` |
| `bonusXp` | Non-negative integer, default 0, **cap 500**. This is the same pipe as streak-multiplier and league-winner bonuses and it moves `weekly_xp`, so the cap stops a crafted token dropping an enormous number onto the league. |

A body carrying `courseCode` is rejected with `400` naming `packId` — progress
is pack-scoped, and silently aliasing the two keys is how they drift apart.
There is no `questId`: completing a quest is derived from these counters.

**200**

```json
{
  "dateKey": "2026-09-04",
  "packId": "de",
  "counters": { "total": 1, "bonusXp": 0, "byTab": { "…": 1 }, "byLevel": { "…": {} } }
}
```

## `GET /api/v1/progress/daily`

```
GET /api/v1/progress/daily?date=2026-09-04&packId=de
```

`date` is required and must be `YYYY-MM-DD`; `packId` defaults to `de`. Query
parameters rather than a path segment: this project compiles static function
filenames and has no dynamic `[param]` routes.

**200** — same shape as the POST response. A day with no row returns the
**zeroed aggregate**, never `404` and never `{}`: readers index straight into
`byLevel[level][verdict]`, and a quiet day is zeros.

**Errors (both):** `400 bad_request`, `401 unauthorized`, `403 forbidden`,
`405 method_not_allowed`, `429 rate_limited`, `500 server_error`.
````

- [ ] **Step 11: Full suite, lint, commit**

Run: `npm test` → **PASS**. Run `npm run lint` and `npx prettier --check` on the new files → clean.

```bash
git add api/v1/progress docs/api/progress.md
git commit -m "feat(api): progress lane — event POST and daily GET, no client caller"
```

---

## Opening the PR

E1–E3 may ship as one PR (the spec permits one or three). One PR is recommended: E2 is untestable end-to-end without E1's table, and E3b is meaningless without E3a's RPC.

- [ ] Push and open the PR:

```bash
git push -u origin feat/data-driven-engine-e1-e3
```

The body should say: this is the **developer interface only** — a `lessons` table, a public content GET, an additive-increment RPC and two authenticated progress endpoints, with **zero app-behaviour change and no `src/` caller**; that `stats_daily` is unaltered and no migration touches it; that `lessons` is deliberately in neither export map because it has no owner; and that E4 (switching the signed-in client onto the RPC, with the sync adapter disabled in the same PR) is a separate spec.

- [ ] Wait for checks: `gh pr checks --watch`. Note `npm run test:rls` is a **separate Docker job** from the four required checks — confirm it ran.

---

## Not in this PR

- **E4 — client adoption.** Requires the `stats_daily` sync adapter disabled in the same PR plus a test that fails if both writers are live. A separate spec.
- **`GET /api/v1/packs`** — still reserved (Lane 3). Do not implement or stub.
- **Seed data** — Ruling 3. If added later it needs a test asserting its shape.
- **A second language pack, a course picker, Phase 4 namespacing.**
- **Per-tab verdicts (`byTabVerdicts`) or a stored `questCompletions`** — optional grow-only keys, only if a later plan needs them.
- **Telemetry / BigQuery, admin authoring UI, changes to league settle, trial rules or quest targets.**
