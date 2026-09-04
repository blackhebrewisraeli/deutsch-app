# E4 Client Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `POST /api/v1/progress/events` the only writer of `stats_daily`, with a durable client queue so signed-in learners keep playing offline, guest progress flushes on sign-in, and at-least-once delivery cannot double-count.

**Architecture:** `recordEvent` still applies locally (instant UI, offline SoT unchanged). Every answer also enqueues a client-id'd event. When a JWT exists, a flusher POSTs the queue through the existing progress function. The RPC inserts into `progress_events_seen` first and no-ops on conflict. Sync keeps the daily `select` (multi-device pull) and loses only the daily `upsert`.

**Tech Stack:** React 18 + Vite 5, Vitest, Supabase Postgres (RLS, `security definer` RPC), existing `/api/v1/progress` dispatcher (Hobby 12-function cap — do not add a new serverless file).

**Spec:** `docs/superpowers/specs/2026-09-04-e4-client-adoption.md` — read §1 (the inverted failure), §3 (shape), §4 (three problems, now locked), §5 (tests), §7 (rulings). Predecessor: `docs/superpowers/specs/2026-09-04-data-driven-engine.md`.

## Global Constraints

- **Two writers on `stats_daily` double-count, they do not lose increments.** `mergeDailyAdditive` is a three-way delta merge (`src/lib/sync/merge.js:51`), not whole-object LWW. Do not reintroduce the predecessor's inverted sentence.
- **RPC is the only server writer of `stats_daily`.** The daily `upsert` at `src/lib/sync.js:109` is removed. The daily `select` at `:93` stays.
- **Flush guest backlog on sign-in.** Never silently discard guest progress at conversion.
- **Dedupe table `progress_events_seen` is `EXCLUDED_TABLES`**, 30-day opportunistic prune inside the RPC, no new cron, no 13th Vercel function.
- **`applyEvent`, `normalizeDayAggregate`, `counters` shape, `xpForDay`:** untouched.
- **Other sync slices** (srs, settings, decks, learnedByDeck): untouched.
- **No new `localStorage` key renamed or migrated.** This epic *adds* `deutsch-app-progress-queue-v1` (new, like `deutsch-app-sync-meta-v1`). Do not rename `deutsch-app-state-v1` or `deutsch-app-sync-meta-v1`. Leave `lastSyncedCounters` inert — do not delete it.
- **Language-blind engine:** no German literals, no `language === 'de'` branch, no `card.de` in new `src/lib` or `api` code. `packId` is an opaque identifier defaulting to `'de'`.
- **Inline styles / theme tokens:** this epic has no UI. Do not restyle anything.
- **Hobby 12-function cap:** handlers stay in `api/_lib/progressHandlers.js`; `api/v1/progress.js` stays the one deployed file. Do not recreate `api/v1/progress/events.js` as a deployed function.
- **`.js` extensions on every relative import in `api/`.** `src/lib` matches its neighbours (stats.js omits extensions).
- **Error envelope unchanged.** Never `--no-verify`. Never push to `main`.
- **`lessons` / content lane:** out of scope.

---

## File Structure

| File | Action | Responsibility |
| --- | --- | --- |
| `docs/superpowers/specs/2026-09-04-data-driven-engine.md` | Modify §7.3 | Correct inverted failure in place |
| `docs/superpowers/plans/2026-09-04-data-driven-engine-e1-e3.md` | Modify the two-writers constraint | Same correction |
| `docs/api/progress.md` | Modify banner | Client now calls POST; failure is double-count |
| `docs/api/data.md` | Modify | List `progress_events_seen` as excluded user-owned |
| `api/_lib/progressHandlers.js` | Modify | Require `id`; pass `p_event_id`; fix header comment |
| `api/v1/progress/events.test.js` | Modify | `id` contract; invert no-caller → one-writer |
| `supabase/migrations/20260904140000_progress_events_seen.sql` | Create | Table, RLS, RPC overload drop+replace, prune |
| `supabase/tests/rls/progress-event.test.js` | Modify | Pass `p_event_id`; add idempotency + client-write-block |
| `supabase/tests/rls/cascade.test.js` | Modify | `USER_OWNED` + fixture row |
| `api/_lib/accountEndpoints.js` | Modify | `EXCLUDED_TABLES.progress_events_seen` |
| `api/v1/account/export.test.js` | Modify | `USER_OWNED` includes the new table |
| `src/lib/progressQueue.js` | Create | Persist, enqueue, expand guest leftover, flush |
| `src/lib/progressQueue.test.js` | Create | Queue / expand / flush / 429 / signed-out |
| `src/lib/stats.js` | Modify `recordEvent` only | Enqueue after `applyEvent` |
| `src/lib/stats.test.js` | Modify | `recordEvent` enqueues |
| `src/lib/sync.js` | Modify | Remove daily upsert; pull adopts `max`-safe via queue reconstruction |
| `src/lib/sync.test.js` | Modify | Daily is not upserted; pull still adopts remote |
| `src/lib/sync/merge.test.js` | Modify | Premise: stale baseline + RPC'd server ⇒ `+2` |
| `src/App.jsx` | Modify | Start/stop the flusher on auth, not only on `SYNC_ENABLED` |

---

## Rulings this plan makes

**Ruling 1 — `EXCLUDED_TABLES`, not exported.** Event ids are opaque. `stats_daily` already exports as `daily`. Exporting the dedupe table would grow the payload with tokens a learner cannot use.

**Ruling 2 — opportunistic prune, no cron.** After inserting a seen row, `DELETE FROM progress_events_seen WHERE user_id = p_user_id AND created_at < now() - interval '30 days'`. A new cron is a new serverless function; this project is at the Hobby cap.

**Ruling 3 — reconstruct local daily from `server + queue` on pull.** Per-leaf `max(local, server)` drops unflushed same-tab answers. After pull, `adopted[day] = addCounters(remote[day], countersFromQueue(queue)[day])`, then the existing concurrent-recovery (`clamp(sub(curDaily, localAtStart))`) still runs. Guests never pull.

**Ruling 4 — guest leftover expansion is `clamp(sub(local, add(remote, queueAsCounters)))`.** Live E4 answers are already in the queue. Pre-E4 aggregate-only days are the remainder. Synthetic events round-trip through `applyEvent`; bonusXp rides the first event, split if `> MAX_BONUS_XP`.

**Ruling 5 — flush gates on a JWT, not `VITE_SYNC_ENABLED`.** Sync off must not strand progress now that the RPC is the writer. No token ⇒ no POST (signed-out path unchanged).

**Ruling 6 — drop the 7-arg RPC.** `CREATE OR REPLACE` with a new arity overloads. `DROP FUNCTION public.apply_progress_event(uuid, text, date, text, text, text, integer)` first.

---

### Task 1: Correct the inverted failure in shipped docs

**Files:**
- Modify: `docs/superpowers/specs/2026-09-04-data-driven-engine.md` §7.3
- Modify: `docs/superpowers/plans/2026-09-04-data-driven-engine-e1-e3.md` (Global Constraints bullet about LWW)
- Modify: `docs/api/progress.md` (banner)
- Modify: `api/_lib/progressHandlers.js` (file header)
- Modify: `api/v1/progress/events.test.js` (comment on the no-caller describe — leave the assertion until Task 8)

**Interfaces:** none. Docs and comments only.

- [ ] **Step 1: Replace E1–E3 spec §7.3**

In `docs/superpowers/specs/2026-09-04-data-driven-engine.md`, replace the §7.3 table and the two paragraphs under it with:

```markdown
### 7.3 Two writers on `stats_daily` are forbidden in production

| Writer | Semantics | Status today |
|---|---|---|
| B2 sync adapter (daily slice) | Three-way **additive delta** against `lastSyncedCounters` (`mergeDailyAdditive`) | Live for signed-in users |
| `apply_progress_event` | Additive increment, server `updated_at` | This spec |

The predecessor draft called the daily adapter whole-object last-write-wins.
That is `mergeSettings`, a different slice. **Enabling both writers
double-counts:** `recordEvent` increments local, the RPC increments server,
and the next reconcile pushes `delta = local − lastSynced` on top of the
already-incremented row. E4 (`2026-09-04-e4-client-adoption.md`) is the plan
that removes the daily upsert so the RPC is the only writer.

**v1 rule:** ship the RPC and the endpoints. Do **not** call them from
`src/` until E4 lands in the same PR as the daily-upsert removal, with a
test that fails if both write.

Anonymous / offline: the engine remains a no-op on the network, as B2
specified. No JWT, no progress POST.
```

- [ ] **Step 2: Replace the E1–E3 plan constraint**

In `docs/superpowers/plans/2026-09-04-data-driven-engine-e1-e3.md`, replace the bullet that says two writers "will silently lose increments" / "whole-object LWW" with: two writers **double-count** because the daily adapter is `mergeDailyAdditive`, not LWW. E4 removes the upsert.

- [ ] **Step 3: Replace the `docs/api/progress.md` banner**

```markdown
> **E4: the signed-in app is the caller; the RPC is the only writer of
> `stats_daily`.** The daily sync adapter is a three-way additive delta merge
> (`mergeDailyAdditive`), not whole-object last-write-wins. Running this lane
> **and** the daily `upsert` double-counts one answer. The daily `select`
> (pull) stays so a second device still sees the first's progress. Events
> carry a client `id`; the server dedupes on `(user_id, event_id)` for 30 days.
```

Keep the rest of the page. Add `id` to the POST body table as required UUID.

- [ ] **Step 4: Replace the `progressHandlers.js` header comment** (lines 8–12)

```js
// The signed-in PWA calls this (E4). The daily sync upsert is gone; this RPC
// is the only writer of stats_daily. Running both would DOUBLE-COUNT because
// mergeDailyAdditive would push local−lastSynced on top of an already
// incremented row — see docs/superpowers/specs/2026-09-04-e4-client-adoption.md.
```

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-09-04-data-driven-engine.md \
        docs/superpowers/plans/2026-09-04-data-driven-engine-e1-e3.md \
        docs/api/progress.md api/_lib/progressHandlers.js
git commit -m "$(cat <<'EOF'
docs(engine): two writers on stats_daily double-count, they do not lose increments

The daily adapter is mergeDailyAdditive, not whole-object LWW. E4 is the
plan that leaves the RPC as the only writer.
EOF
)"
```

---

### Task 2: Dedupe table + idempotent RPC

**Files:**
- Create: `supabase/migrations/20260904140000_progress_events_seen.sql`
- Modify: `supabase/tests/rls/progress-event.test.js`
- Modify: `docs/api/data.md`

**Interfaces:**
- Consumes: existing `apply_progress_event` 7-arg function (dropped in this task).
- Produces: `public.progress_events_seen`; `apply_progress_event(..., p_event_id uuid)` that no-ops on a seen id and prunes this user's rows older than 30 days.

- [ ] **Step 1: Extend the RLS tests so they fail against today's 7-arg RPC**

In `supabase/tests/rls/progress-event.test.js`:

1. Every `rpc('apply_progress_event', …)` body gains `p_event_id: crypto.randomUUID()` (a **new** uuid per call except the idempotency cases).
2. `afterAll` also deletes `progress_events_seen` for `A.id`.
3. Add:

```js
describe('apply_progress_event: idempotency', () => {
  it('a replayed event_id does not increment again', async () => {
    const id = crypto.randomUUID();
    const day = '2026-09-06';
    const first = await callAsService({ p_day: day, p_event_id: id });
    expect(first.error).toBeNull();
    expect(first.data.total).toBe(1);
    const replay = await callAsService({ p_day: day, p_event_id: id });
    expect(replay.error).toBeNull();
    expect(replay.data.total).toBe(1);
    const { data } = await admin
      .from('stats_daily')
      .select('counters')
      .eq('user_id', A.id)
      .eq('day', day)
      .single();
    expect(data.counters.total).toBe(1);
  });

  it('a signed-in client CANNOT insert into progress_events_seen', async () => {
    const { error } = await A.client.from('progress_events_seen').insert({
      user_id: A.id,
      event_id: crypto.randomUUID(),
    });
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run RLS tests and watch the new cases fail**

Run: `npm run test:rls`
Expected: FAIL — `p_event_id` is not a parameter, and/or `progress_events_seen` does not exist.

If the suite cannot connect, that is the known two-CLI mix — report it; do not weaken the tests.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260904140000_progress_events_seen.sql`:

```sql
-- Idempotency keys for apply_progress_event. User-owned (cascade delete) but
-- EXCLUDED from export: opaque tokens, and the counters they protect already
-- ship as `daily`.

create table public.progress_events_seen (
  user_id    uuid not null references auth.users(id) on delete cascade,
  event_id   uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create index progress_events_seen_created_at_idx
  on public.progress_events_seen (user_id, created_at);

alter table public.progress_events_seen enable row level security;
-- No client policies: the RPC is the only writer, matching rate_limits.
revoke all on public.progress_events_seen from anon, authenticated;
grant all on public.progress_events_seen to service_role;

-- New arity; OR REPLACE would overload and leave the 7-arg form callable.
drop function if exists public.apply_progress_event(uuid, text, date, text, text, text, integer);

create or replace function public.apply_progress_event(
  p_user_id   uuid,
  p_pack_id   text,
  p_day       date,
  p_tab       text,
  p_level     text,
  p_verdict   text,
  p_bonus_xp  integer,
  p_event_id  uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_counters jsonb;
  inserted      uuid;
begin
  if p_event_id is null then
    raise exception 'event_id required';
  end if;
  if p_tab not in ('chat', 'alphabet', 'vocab', 'translate') then
    raise exception 'invalid tab: %', p_tab;
  end if;
  if p_level not in ('a1', 'a2', 'b1') then
    raise exception 'invalid level: %', p_level;
  end if;
  if p_verdict not in ('correct', 'almost', 'wrong') then
    raise exception 'invalid verdict: %', p_verdict;
  end if;

  insert into public.progress_events_seen (user_id, event_id)
  values (p_user_id, p_event_id)
  on conflict (user_id, event_id) do nothing
  returning event_id into inserted;

  if inserted is null then
    select counters into next_counters
      from public.stats_daily
     where user_id = p_user_id and pack_id = p_pack_id and day = p_day;
    return coalesce(next_counters, '{}'::jsonb);
  end if;

  insert into public.stats_daily (user_id, pack_id, day, counters, updated_at)
  values (
    p_user_id, p_pack_id, p_day,
    public.progress_counters_apply('{}'::jsonb, p_tab, p_level, p_verdict, p_bonus_xp),
    now()
  )
  on conflict (user_id, pack_id, day) do update
    set counters = public.progress_counters_apply(
          public.stats_daily.counters, p_tab, p_level, p_verdict, p_bonus_xp),
        updated_at = now()
  returning counters into next_counters;

  delete from public.progress_events_seen
   where user_id = p_user_id
     and created_at < now() - interval '30 days';

  return next_counters;
end $$;

revoke execute on function public.apply_progress_event(uuid, text, date, text, text, text, integer, uuid) from public;
revoke execute on function public.apply_progress_event(uuid, text, date, text, text, text, integer, uuid) from anon, authenticated;
grant  execute on function public.apply_progress_event(uuid, text, date, text, text, text, integer, uuid) to service_role;
```

- [ ] **Step 4: Apply and watch RLS pass**

Run: `npx supabase db reset && npm run test:rls`
Expected: PASS, including the new idempotency cases.

- [ ] **Step 5: Prove the replay test has teeth**

Temporarily comment out the `on conflict do nothing` / `inserted is null` branch so a replay increments. Reset + `npm run test:rls`. Expected: `'a replayed event_id does not increment again'` **FAILS** with total 2. Restore, reset, confirm green. Record the failure output.

- [ ] **Step 6: Document the table in `docs/api/data.md`**

Add a row for `progress_events_seen` PK `(user_id, event_id)`, holds idempotency keys, mirrors nothing in localStorage. Note it is user-owned, cascade-deleted, **excluded from export**, service-role-only (no client policies), 30-day prune inside the RPC.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260904140000_progress_events_seen.sql \
        supabase/tests/rls/progress-event.test.js docs/api/data.md
git commit -m "$(cat <<'EOF'
feat(db): dedupe progress events on (user_id, event_id) for 30 days

At-least-once delivery of an additive RPC would otherwise double-count.
EOF
)"
```

---

### Task 3: Classify the table + require `id` on POST

**Files:**
- Modify: `api/_lib/accountEndpoints.js` (`EXCLUDED_TABLES`)
- Modify: `api/v1/account/export.test.js` (`USER_OWNED`)
- Modify: `supabase/tests/rls/cascade.test.js` (`USER_OWNED` + fixture insert)
- Modify: `api/_lib/progressHandlers.js` (`validateEventBody`, RPC args)
- Modify: `api/v1/progress/events.test.js`

**Interfaces:**
- Consumes: Task 2's 8-arg RPC.
- Produces: POST body `{ …, id }` required UUID; export/cascade guards know the new table.

- [ ] **Step 1: Write the failing `id` cases in `events.test.js`**

Keep existing `VALID`. Add `id: '11111111-1111-4111-8111-111111111111'` to it (every happy-path POST must send it). Add:

```js
it('rejects a missing or non-uuid id', () => {
  expect(validateEventBody({ ...VALID, id: undefined }).ok).toBe(false);
  expect(validateEventBody({ ...VALID, id: 'not-a-uuid' }).ok).toBe(false);
});

it('passes p_event_id through to the RPC', async () => {
  const res = createRes();
  await handler(req(VALID), res);
  expect(rpcArgs.args.p_event_id).toBe(VALID.id);
});
```

Also update `USER_OWNED` in `export.test.js`:

```js
const USER_OWNED = [
  'profiles', 'srs_state', 'stats_daily', 'decks', 'settings',
  'league_members', 'progress_events_seen',
];
```

And in `cascade.test.js` the same array, plus a fixture insert:

```js
admin.from('progress_events_seen').insert({
  user_id: userId,
  event_id: '11111111-1111-4111-8111-111111111111',
}),
```

- [ ] **Step 2: Run and watch fail**

Run: `npx vitest run api/v1/progress/events.test.js api/v1/account/export.test.js`
Expected: FAIL — `id` not validated; classified set missing `progress_events_seen`.

- [ ] **Step 3: Implement**

`EXCLUDED_TABLES` in `api/_lib/accountEndpoints.js`:

```js
progress_events_seen:
  'idempotency keys for the progress RPC; counters already export as daily',
```

`validateEventBody`: after the verdict check,

```js
const EVENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (typeof body.id !== 'string' || !EVENT_ID.test(body.id)) {
  return { ok: false, message: 'id must be a UUID.' };
}
```

Include `id` in the returned `value`. Pass `p_event_id: parsed.value.id` to the RPC.

- [ ] **Step 4: Run and watch pass**

Run: `npx vitest run api/v1/progress/events.test.js api/v1/account/export.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/accountEndpoints.js api/_lib/progressHandlers.js \
        api/v1/account/export.test.js api/v1/progress/events.test.js \
        supabase/tests/rls/cascade.test.js
git commit -m "$(cat <<'EOF'
feat(api): require an event id and exclude the dedupe table from export

A missing classification is how decks vanished from "export my data".
EOF
)"
```

---

### Task 4: Progress queue (pure persist + expand + flush)

**Files:**
- Create: `src/lib/progressQueue.js`
- Create: `src/lib/progressQueue.test.js`

**Interfaces:**
- Consumes: `applyEvent` / `emptyDayAggregate` / `TABS` / `LEVELS` / `VERDICTS` from `stats.js`; `addCounters` / `subCounters` / `clampCounters` from `sync/merge.js`; `getAccessToken` from `auth.js`; `MAX_BONUS_XP` from `api/_lib/progressHandlers.js` **must not be imported from `api/` into `src/`** — duplicate the cap constant `500` here with a comment pointing at the handler, or export a tiny shared module under `src/lib`. Prefer `src/lib/progressEvent.js` only if a third copy appears; for two copies, a commented `QUEUE_MAX_BONUS_XP = 500` in this file is enough.
- Produces:
  - `QUEUE_KEY = 'deutsch-app-progress-queue-v1'`
  - `newEventId()` → uuid string (randomUUID with getRandomValues fallback, same idea as `customDecks.js`)
  - `loadQueue()` / `saveQueue(events)` / `enqueue(event)`
  - `eventsFromCounters(dateKey, packId, counters)` → event[]
  - `countersFromQueue(events)` → `{ [dateKey]: counters }`
  - `expandGuestBacklog({ localDaily, remoteDaily, queue })` → events to prepend
  - `flushQueue({ fetchImpl, token }?)` → posts one-by-one, drops on 200, retries 429 with Retry-After, leaves the event in the queue on network/5xx

- [ ] **Step 1: Write failing tests in `src/lib/progressQueue.test.js`**

Cover at least:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyEvent } from './stats.js';
import {
  QUEUE_KEY, enqueue, loadQueue, saveQueue, eventsFromCounters,
  countersFromQueue, expandGuestBacklog, flushQueue, newEventId,
} from './progressQueue.js';

beforeEach(() => localStorage.clear());

it('persists under deutsch-app-progress-queue-v1, not the state blob', () => {
  enqueue({ id: '11111111-1111-4111-8111-111111111111', dateKey: '2026-09-04', packId: 'de', tab: 'vocab', level: 'a1', verdict: 'correct', bonusXp: 0 });
  expect(localStorage.getItem('deutsch-app-state-v1')).toBeNull();
  expect(JSON.parse(localStorage.getItem(QUEUE_KEY))).toHaveLength(1);
});

it('eventsFromCounters round-trips through applyEvent', () => {
  let daily = {};
  daily = applyEvent(daily, '2026-09-04', 'vocab', 'a1', 'correct', 5);
  daily = applyEvent(daily, '2026-09-04', 'chat', 'a1', 'wrong', 0);
  const events = eventsFromCounters('2026-09-04', 'de', daily['2026-09-04']);
  let replayed = {};
  for (const e of events) replayed = applyEvent(replayed, e.dateKey, e.tab, e.level, e.verdict, e.bonusXp);
  expect(replayed['2026-09-04'].total).toBe(2);
  expect(replayed['2026-09-04'].bonusXp).toBe(5);
  expect(replayed['2026-09-04'].byTab.vocab).toBe(1);
  expect(replayed['2026-09-04'].byTab.chat).toBe(1);
});

it('expandGuestBacklog synthesises only the leftover not already queued or remote', () => {
  const local = { '2026-09-04': { total: 2, bonusXp: 0, byTab: { chat: 1, alphabet: 0, vocab: 1, translate: 0 }, byLevel: { a1: { correct: 2, almost: 0, wrong: 0 }, a2: { correct: 0, almost: 0, wrong: 0 }, b1: { correct: 0, almost: 0, wrong: 0 } } } };
  const queue = [{ id: 'a', dateKey: '2026-09-04', packId: 'de', tab: 'vocab', level: 'a1', verdict: 'correct', bonusXp: 0 }];
  const extra = expandGuestBacklog({ localDaily: local, remoteDaily: {}, queue });
  expect(extra).toHaveLength(1);
  expect(extra[0].tab).toBe('chat');
});

it('flushQueue POSTs each event and drops it on 200', async () => {
  enqueue({ id: '11111111-1111-4111-8111-111111111111', dateKey: '2026-09-04', packId: 'de', tab: 'vocab', level: 'a1', verdict: 'correct', bonusXp: 0 });
  const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ counters: { total: 1 } }) });
  await flushQueue({ fetchImpl, token: 'tok' });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  expect(fetchImpl.mock.calls[0][0]).toBe('/api/v1/progress/events');
  expect(loadQueue()).toEqual([]);
});

it('flushQueue does not POST without a token', async () => {
  enqueue({ id: '11111111-1111-4111-8111-111111111111', dateKey: '2026-09-04', packId: 'de', tab: 'vocab', level: 'a1', verdict: 'correct', bonusXp: 0 });
  const fetchImpl = vi.fn();
  await flushQueue({ fetchImpl, token: null });
  expect(fetchImpl).not.toHaveBeenCalled();
  expect(loadQueue()).toHaveLength(1);
});

it('flushQueue keeps the event on 5xx and retries 429 then continues', async () => {
  const e1 = { id: '11111111-1111-4111-8111-111111111111', dateKey: '2026-09-04', packId: 'de', tab: 'vocab', level: 'a1', verdict: 'correct', bonusXp: 0 };
  enqueue(e1);
  const fetchImpl = vi.fn()
    .mockResolvedValueOnce({ ok: false, status: 429, headers: { get: () => '0' } })
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
  await flushQueue({ fetchImpl, token: 'tok', sleep: async () => {} });
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  expect(loadQueue()).toEqual([]);
});
```

- [ ] **Step 2: Run and watch fail**

Run: `npx vitest run src/lib/progressQueue.test.js`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/lib/progressQueue.js`**

Shape (do not invent extra framework APIs):

- `loadQueue` / `saveQueue` — try/catch like `syncMeta.js`. Invalid JSON → `[]`.
- `enqueue` — append, skip if `id` already present.
- `eventsFromCounters` — walk `byLevel[level][verdict]` as slots and `byTab[tab]` as tabs; zip them; put `bonusXp` on the first event, splitting by 500 if needed; each event gets `newEventId()`, `dateKey`, `packId`.
- `expandGuestBacklog` — leftover = `clampCounters(subCounters(local[day], addCounters(remote[day], countersFromQueue(queue)[day])))` per day; if leftover.total > 0, `eventsFromCounters`.
- `flushQueue` — if no token, return. Sequential POST JSON body matching the API. 200 → drop. 429 → sleep Retry-After seconds (0 in tests via injected `sleep`) and retry the **same** event, cap 5 retries then stop the flush (leave remaining). 4xx other than 429 → leave in queue and stop (do not skip past a bad event). Network throw → stop.

Use the `customDecks.js` uuid fallback so insecure HTTP still enqueues.

- [ ] **Step 4: Run and watch pass**

Run: `npx vitest run src/lib/progressQueue.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/progressQueue.js src/lib/progressQueue.test.js
git commit -m "$(cat <<'EOF'
feat(progress): durable event queue with guest leftover expansion

Answers enqueue even while signed out so conversion can flush them.
EOF
)"
```

---

### Task 5: Stage the double-count, then remove the daily upsert

**Files:**
- Modify: `src/lib/sync/merge.test.js`
- Modify: `src/lib/sync.js`
- Modify: `src/lib/sync.test.js`

**Interfaces:**
- Consumes: `countersFromQueue`, `loadQueue` from Task 4; existing `addCounters` / `clampCounters` / `subCounters`.
- Produces: `pullAndMerge` no longer upserts `stats_daily`. Pull adopts `add(remote, queueCounters)` plus the existing concurrent recovery. `lastSyncedCounters` is still written (inert) so `syncMeta` shape does not change.

- [ ] **Step 1: Write the premise test (must PASS against today's merge)**

In `src/lib/sync/merge.test.js`:

```js
it('an RPC increment plus a stale lastSynced baseline double-counts (E4 premise)', () => {
  // local applyEvent → 1; RPC already wrote server → 1; lastSynced still 0
  const res = mergeDailyAdditive({
    local: { total: 1 },
    server: { total: 1 },
    lastSynced: { total: 0 },
  });
  expect(res.server.total).toBe(2);
});
```

Run: `npx vitest run src/lib/sync/merge.test.js`
Expected: **PASS**. If this fails, §1 of the spec is wrong — **stop**.

- [ ] **Step 2: Write the failing "daily is not upserted" tests**

Change `'pushAll reconciles and upserts srs/daily/settings rows'` to expect `['settings', 'srs_state']` (no `stats_daily`).

Replace `'pullAndMerge folds guest local stats into the account exactly once'` — that was the upsert fold-in. New cases:

```js
it('does not upsert stats_daily — the RPC is the only writer', async () => {
  localStorage.setItem('deutsch-app-state-v1', JSON.stringify({ daily: { [DAY]: counters(3, 3) } }));
  await pushAll('user-1');
  expect(fake._calls.upserts.filter((u) => u.table === 'stats_daily')).toEqual([]);
});

it('pull still adopts another device\'s counters into local', async () => {
  const seeded = makeFakeClient({ stats_daily: [{ day: DAY, counters: counters(7, 7) }] }, { persist: true });
  __setClientForTest(seeded);
  localStorage.setItem('deutsch-app-state-v1', JSON.stringify({ daily: {} }));
  await pullAndMerge('user-1');
  const daily = JSON.parse(localStorage.getItem('deutsch-app-state-v1')).daily;
  expect(daily[DAY].total).toBe(7);
});
```

Run: `npx vitest run src/lib/sync.test.js`
Expected: FAIL — daily still upserted; the new assertion is the red.

- [ ] **Step 3: Remove the upsert; reconstruct local from server + queue**

In `src/lib/sync.js`, replace the daily block (`:93–110` plus adoption `:117–124`) with:

```js
const dailyRemote = dailyFromRows((await c.from('stats_daily').select()).data ?? []);
const pending = countersFromQueue(loadQueue());
const mergedDaily = {};
for (const day of new Set([...Object.keys(dailyRemote), ...Object.keys(pending), ...Object.keys(s.daily ?? {})])) {
  mergedDaily[day] = addCounters(dailyRemote[day], pending[day]);
}
```

Do **not** call `c.from('stats_daily').upsert(...)`.

Keep concurrent recovery: `adoptedDaily[day] = addCounters(mergedDaily[day], clampCounters(subCounters(curDaily[day], local[day])))`.

Keep writing `lastSyncedCounters` as a copy of `dailyRemote` (inert baseline, not used for a push). Do not delete `syncMeta` fields.

- [ ] **Step 4: Run sync tests**

Run: `npx vitest run src/lib/sync.test.js src/lib/sync/merge.test.js`
Expected: PASS. Fix any remaining tests that expected a daily upsert (the guest fold-in and "reconcile after local activity" cases). Guest fold-in now lives in `expandGuestBacklog` + flush, not in sync — do not reimplement it here.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync.js src/lib/sync.test.js src/lib/sync/merge.test.js
git commit -m "$(cat <<'EOF'
fix(sync): stop upserting stats_daily so the RPC is the only writer

The daily select stays; pulling reconstructs local from server plus the
unflushed queue so a second device still converges.
EOF
)"
```

---

### Task 6: `recordEvent` enqueues; App flushes on auth

**Files:**
- Modify: `src/lib/stats.js` (`recordEvent` only)
- Modify: `src/lib/stats.test.js`
- Modify: `src/App.jsx`
- Modify: `src/App.test.jsx` as needed
- Modify: `api/v1/progress/events.test.js` (invert the no-caller guard)

**Interfaces:**
- Consumes: `enqueue`, `flushQueue`, `expandGuestBacklog`, `loadQueue`, `saveQueue` from Task 4; `getAccessToken` from `auth.js`.
- Produces: every `recordEvent` appends to the queue; a signed-in session flushes on progress, visibility, `online`, and sign-in. Signed-out: enqueue, never POST.

- [ ] **Step 1: Failing stats test**

```js
it('enqueues an event even when signed out', () => {
  recordEvent('chat', 'a1', 'correct');
  const q = JSON.parse(localStorage.getItem('deutsch-app-progress-queue-v1') ?? '[]');
  expect(q).toHaveLength(1);
  expect(q[0].tab).toBe('chat');
  expect(q[0].id).toMatch(/^[0-9a-f-]{36}$/i);
});
```

Run: `npx vitest run src/lib/stats.test.js`
Expected: FAIL.

- [ ] **Step 2: Enqueue from `recordEvent` after `saveState`**

```js
enqueue({
  id: newEventId(),
  dateKey: today,
  packId: 'de',
  tab,
  level,
  verdict,
  bonusXp: bonus,
});
```

Keep the `deutsch:progress` dispatch. Keep the try/catch — enqueue failure must not throw into React.

- [ ] **Step 3: Invert the no-caller guard**

Replace `the progress lane has no client caller` in `api/v1/progress/events.test.js` with:

```js
describe('the progress lane has one writer', () => {
  it('src/ may call /api/v1/progress/events and must not upsert stats_daily', () => {
    const files = walk('src');
    expect(files.length).toBeGreaterThan(50);
    const upserts = files.filter((f) => {
      const src = readFileSync(f, 'utf8');
      return /stats_daily['"]\)\s*\.upsert|from\('stats_daily'\)[\s\S]{0,200}upsert/.test(src);
    });
    expect(upserts).toEqual([]);
    const callers = files.filter((f) => /\/api\/v1\/progress\/events/.test(readFileSync(f, 'utf8')));
    expect(callers.length).toBeGreaterThan(0);
  });
});
```

Prove it: temporarily add `c.from('stats_daily').upsert([])` in `sync.js`, watch FAIL, revert.

- [ ] **Step 4: Flush lifecycle**

Export `startProgressFlush()` / `stopProgressFlush()` from `progressQueue.js`:

- On start: `online` listener, `visibilitychange` (visible ⇒ flush), immediate `flushNow`.
- `flushNow`: `token = await getAccessToken()`; if none, return. Load local `daily` + (if a supabase client is available via `getSupabase`) select `stats_daily` for leftover expansion; `saveQueue([...expandGuestBacklog(...), ...loadQueue()])`; `flushQueue`.
- Keep it serialized (same in-flight + rerun pattern as `reconcileNow`) so overlapping progress events cannot double-POST the same id before the first 200 drops it — the server dedupes too, but the client should not hammer.

In `App.jsx`, next to the sync effects:

```js
useEffect(() => {
  if (authStatus !== 'authenticated') {
    stopProgressFlush();
    return;
  }
  startProgressFlush();
  const onProgress = () => { void flushNow(); };
  window.addEventListener('deutsch:progress', onProgress);
  return () => {
    window.removeEventListener('deutsch:progress', onProgress);
    stopProgressFlush();
  };
}, [authStatus]);
```

Do **not** gate this on `SYNC_ENABLED` (Ruling 5). Debounce flush ~500ms so a 20-card drill is one burst of sequential POSTs, not 20 overlapping flushes. Inject the timer in tests.

Guest leftover expansion needs a remote snapshot. If `getSupabase()` is null (auth configured but sync client missing), treat remote as `{}` — converting a guest onto an empty account is the common case; a returning account with sync off still has the RPC GET, but do not add a second fetch to `/progress/daily` per day in v1. One `stats_daily.select()` on the RLS client is enough and matches the existing pull.

If `getSupabase()` is null, skip expansion (queue-only). Pre-E4 leftovers then wait until a client exists. **That is the one case that can still drop pre-queue aggregates** — call it out in the PR, and still enqueue live answers from this version forward.

- [ ] **Step 5: App tests**

Add a focused case: authenticated + `recordEvent` ⇒ `fetch` to `/api/v1/progress/events` (mock `getAccessToken` + `fetch`). Anonymous ⇒ `fetch` not called, queue length 1.

Keep existing `markDirty` tests — they still apply to srs/settings.

- [ ] **Step 6: Full suite**

Run: `npm test && npm run lint && npm run format:check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/stats.js src/lib/stats.test.js src/lib/progressQueue.js \
        src/lib/progressQueue.test.js src/App.jsx src/App.test.jsx \
        api/v1/progress/events.test.js
git commit -m "$(cat <<'EOF'
feat(progress): enqueue every answer and flush the RPC when signed in

Guest play still writes locally; conversion posts the backlog instead of
discarding it.
EOF
)"
```

---

## Opening the PR

Branch is `feat/e4-client-adoption`, already off `main` @ `344ffa7` (E1–E3).

```bash
git push -u origin HEAD
gh pr create --base main --title "feat(engine): E4 — queued progress events, RPC is the only writer" --body "$(cat <<'EOF'
## Summary
- Daily sync **upsert** is gone; the daily **select** stays so multi-device still converges.
- Every answer enqueues a client id; `apply_progress_event` dedupes on `(user_id, event_id)` with a 30-day prune.
- Guest backlog flushes on sign-in (synthetic events for pre-queue aggregates).
- Corrects the E1–E3 claim that two writers lose increments — they **double-count**.

## Test plan
- [ ] `npm test` / `npm run lint` / `npm run format:check`
- [ ] `npm run test:rls` (idempotency replay + client cannot write `progress_events_seen` + cascade)
- [ ] Signed-out: answer cards, no network POST, local XP moves
- [ ] Sign-in: queued events POST, Stats/XP match, no double
- [ ] Airplane mode signed-in: answers queue; back online they flush once
- [ ] Two devices: A plays, B pulls and sees A's totals
- [ ] 375px and 320px: no new chrome (this PR is headless)
EOF
)"
```

---

## Not in this PR

- Content lane client adoption (`GET /api/v1/content/lessons`).
- Batching events into one POST (trial-cap 60 fits the 60/5min user rate; 429 retry covers overflow).
- Deleting `lastSyncedCounters`.
- A general offline mutation queue for settings/decks/srs.
- A 13th Vercel function or a prune cron.
