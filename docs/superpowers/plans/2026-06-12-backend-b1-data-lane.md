# Backend B1 — Supabase Data Lane: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **For Cursor:** ignore the line above — execute the tasks in order, checking off checkboxes, committing at each task's commit step. Task 11 is OWNER-ONLY.

**Goal:** Stand up the database half of the developer interface — six RLS-guarded tables in versioned migrations, an atomic `increment_rate_limit` RPC that makes B0's rate limiting durable, an adversarial RLS test suite behind `npm run test:rls`, and a CI job that runs it — with zero app-behavior change.

**Architecture:** Per `docs/superpowers/specs/2026-06-12-backend-b1-data-lane-design.md`. SQL lives in `supabase/migrations/` (RLS enabled in the same migration as each table). The JS side adds `SupabaseStore` behind B0's existing `store.increment(key, windowStart)` interface, selected at module load when `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` exist, falling back to `MemoryStore` with a one-time warning; a thrown store call **fails open**. The RLS suite runs against the local stack (`supabase start`, Docker) through real PostgREST — never in `npm test` or the pre-commit hook.

**Tech Stack:** Supabase CLI (local stack + migrations), Postgres RLS, `@supabase/supabase-js`, Vitest (two configs: main jsdom config untouched; new node-env `vitest.rls.config.js`).

**Branch:** `feature/backend-b1-data-lane`, from up-to-date `main`.

---

## Preconditions (verify before Task 1 — STOP and report if any fails)

1. `docker info` exits 0 (Docker Desktop running). If not: **stop** — the owner must start Docker Desktop.
2. `supabase --version` prints a version. If not: **stop** — the owner must run `brew install supabase/tap/supabase`.
3. This plan file exists on `main` (the B1 docs PR merged).
4. `git checkout main && git pull && npm test` → 41 files / 327 tests green (baseline). Then `git checkout -b feature/backend-b1-data-lane`.

**TDD note:** the JS layer (Tasks 5–6) is strict test-first. SQL migrations (Tasks 3–4) are validated by `supabase db reset` plus the adversarial suite in Tasks 7–8 — the suite needs the tables to exist, so for SQL the loop is *write migration → reset → test*, not test-first.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `supabase/config.toml` | Create (`supabase init`) | Local stack config |
| `supabase/migrations/<ts>_rate_limits.sql` | Create | `rate_limits` table + RPC + grants |
| `supabase/migrations/<ts>_user_tables.sql` | Create | Five user tables + RLS policies + profiles trigger |
| `supabase/tests/rls/helpers.js` | Create | Env-driven admin/anon/signed-in clients |
| `supabase/tests/rls/policies.test.js` | Create | Cross-user adversarial suite (25 tests) |
| `supabase/tests/rls/ratelimit.test.js` | Create | RPC privilege + counting tests (5 tests) |
| `vitest.rls.config.js` | Create | Separate node-env config for the suite |
| `api/_lib/supabase.js` | Create | Service-role client factory (null when unconfigured) |
| `api/_lib/supabase.test.js` | Create | 3 unit tests (module-reset pattern) |
| `api/_lib/ratelimit.js` | Modify | `SupabaseStore`, `defaultStore()`, fail-open guard |
| `api/_lib/ratelimit.test.js` | Modify | +6 unit tests |
| `api/_lib/handler.js` | Modify | One line: pass `store: defaultStore()` |
| `package.json` | Modify | dependency, `test:rls`, lint reach |
| `.github/workflows/ci.yml` | Modify | `rls-policy-tests` job |
| `eslint.config.js` | Modify | Node globals for `supabase/tests/**` |
| `.env.example` | Modify | Document the two new vars |
| `docs/api/data.md` | Create | Data-contract page |

---

### Task 1: Toolchain reach (dependency, scripts, configs)

**Files:**
- Modify: `package.json`
- Modify: `eslint.config.js`
- Create: `vitest.rls.config.js`

- [x] **Step 1: Install the dependency**

Run: `npm install @supabase/supabase-js`
(`.npmrc` already sets `legacy-peer-deps=true`.)
Expected: `@supabase/supabase-js` appears under `"dependencies"` in `package.json`.

- [x] **Step 2: Add the script and widen lint**

In `package.json` scripts, change/add these lines (leave the rest untouched):

```json
    "lint": "eslint src/ api/ supabase/",
    "lint:fix": "eslint src/ api/ supabase/ --fix",
    "test:rls": "vitest run --config vitest.rls.config.js",
```

In the `lint-staged` block, add (keep existing entries):

```json
    "supabase/**/*.js": [
      "eslint --fix",
      "prettier --write"
    ],
```

- [x] **Step 3: Give supabase test files Node globals in ESLint**

In `eslint.config.js`, find the server-side block and add the new glob:

```js
  // Server-side files: Vercel serverless functions and build/config scripts
  // run in Node, not the browser — give them Node globals (process, etc.).
  {
    files: ['api/**/*.js', '*.config.js', 'scripts/**/*.js', 'supabase/tests/**/*.js'],
```

- [x] **Step 4: Create `vitest.rls.config.js`**

```js
import { defineConfig } from 'vitest/config';

// RLS adversarial suite — requires a running local Supabase stack
// (`supabase start`, Docker). Deliberately separate from the main config so
// `npm test` and the pre-commit hook never need Docker.
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['supabase/tests/**/*.test.js'],
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});
```

- [x] **Step 5: Verify nothing broke**

Run: `npm test` → 41 files / 327 tests, green (the rls config is separate; no new tests yet).
Run: `npm run lint` → exit 0.
Run: `npm run test:rls` → "No test files found" (expected — suite arrives in Task 7).

- [x] **Step 6: Commit**

```bash
git add package.json package-lock.json eslint.config.js vitest.rls.config.js
git commit -m "chore(b1): supabase-js dep, test:rls script, lint reach"
```

---

### Task 2: Initialize the Supabase project directory

**Files:**
- Create: `supabase/config.toml` (generated)
- Modify: `.gitignore` (only if needed)

- [x] **Step 1: Init**

Run: `supabase init`
Expected: `supabase/config.toml` created. If the CLI offers to generate VS Code/Deno settings, answer **no**.

- [x] **Step 2: Keep the repo clean**

Check `.gitignore`: if `supabase init` did not already create ignore rules for the CLI's scratch dirs, append this block to the repo `.gitignore`:

```
# Supabase local-stack scratch (generated by the CLI)
supabase/.temp/
supabase/.branches/
```

- [x] **Step 3: First boot of the local stack**

Run: `supabase start`
Expected: first run pulls Docker images (several minutes), then prints a block with `API URL: http://127.0.0.1:54321`, anon key, and service_role key. Run `supabase status` afterwards — same values, stack healthy.

- [x] **Step 4: Commit**

```bash
git add supabase/config.toml .gitignore
git commit -m "chore(b1): supabase init — local stack config"
```

---

### Task 3: Migration 1 — `rate_limits` + atomic RPC

**Files:**
- Create: `supabase/migrations/<ts>_rate_limits.sql` (timestamp via CLI)

- [x] **Step 1: Create the migration file**

Run: `supabase migration new rate_limits`
Expected: empty file `supabase/migrations/<timestamp>_rate_limits.sql` created.

- [x] **Step 2: Fill it with exactly this SQL**

```sql
create table public.rate_limits (
  key          text not null,
  window_start bigint not null,   -- epoch ms, matches api/_lib/ratelimit.js window math
  count        integer not null default 1,
  primary key (key, window_start)
);

alter table public.rate_limits enable row level security;
-- no policies on purpose: invisible to anon and authenticated; service role only

create or replace function public.increment_rate_limit(p_key text, p_window_start bigint)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare new_count integer;
begin
  -- opportunistic cleanup of this key's expired windows (bounded, indexed)
  delete from public.rate_limits
    where key = p_key and window_start < p_window_start;

  insert into public.rate_limits (key, window_start, count)
    values (p_key, p_window_start, 1)
  on conflict (key, window_start)
    do update set count = public.rate_limits.count + 1
  returning count into new_count;

  return new_count;
end $$;

revoke execute on function public.increment_rate_limit(text, bigint) from public;
revoke execute on function public.increment_rate_limit(text, bigint) from anon, authenticated;
grant  execute on function public.increment_rate_limit(text, bigint) to service_role;
```

- [x] **Step 3: Apply**

Run: `supabase db reset`
Expected: ends with `Finished supabase db reset` and lists the migration as applied. Any SQL error = fix the file, reset again.

- [x] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(b1): rate_limits table + atomic increment_rate_limit RPC"
```

---

### Task 4: Migration 2 — user tables, RLS, profiles trigger

**Files:**
- Create: `supabase/migrations/<ts>_user_tables.sql`

- [x] **Step 1: Create the migration file**

Run: `supabase migration new user_tables`

- [x] **Step 2: Fill it with exactly this SQL**

```sql
-- Five user-owned tables. RLS is enabled in the same migration as each
-- table; pack_id defaults to 'de' (platform Phase 4 interlock).

create table public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now()
);

create table public.srs_state (
  user_id       uuid not null references auth.users(id) on delete cascade,
  pack_id       text not null default 'de',
  srs_key       text not null,  -- the engine's full key, verbatim: '<deckId>:<cardId>'
  box           smallint not null default 1 check (box between 1 and 5),
  last_reviewed timestamptz,
  next_due      timestamptz,
  reps          integer not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (user_id, pack_id, srs_key)
);

create table public.stats_daily (
  user_id    uuid not null references auth.users(id) on delete cascade,
  pack_id    text not null default 'de',
  day        date not null,
  counters   jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, pack_id, day)
);

create table public.decks (
  user_id    uuid not null references auth.users(id) on delete cascade,
  pack_id    text not null default 'de',
  deck_id    text not null,
  name       text not null,
  cards      jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  primary key (user_id, pack_id, deck_id)
);

create table public.settings (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- ── RLS ──────────────────────────────────────────────────────────────

alter table public.profiles    enable row level security;
alter table public.srs_state   enable row level security;
alter table public.stats_daily enable row level security;
alter table public.decks       enable row level security;
alter table public.settings    enable row level security;

-- profiles: select / insert / update own. NO delete policy — account
-- deletion is a B3 server-side operation (FK cascade handles the rows).
create policy "select own profile" on public.profiles
  for select using (auth.uid() = user_id);
create policy "insert own profile" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "update own profile" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "select own rows" on public.srs_state
  for select using (auth.uid() = user_id);
create policy "insert own rows" on public.srs_state
  for insert with check (auth.uid() = user_id);
create policy "update own rows" on public.srs_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own rows" on public.srs_state
  for delete using (auth.uid() = user_id);

create policy "select own rows" on public.stats_daily
  for select using (auth.uid() = user_id);
create policy "insert own rows" on public.stats_daily
  for insert with check (auth.uid() = user_id);
create policy "update own rows" on public.stats_daily
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own rows" on public.stats_daily
  for delete using (auth.uid() = user_id);

create policy "select own rows" on public.decks
  for select using (auth.uid() = user_id);
create policy "insert own rows" on public.decks
  for insert with check (auth.uid() = user_id);
create policy "update own rows" on public.decks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own rows" on public.decks
  for delete using (auth.uid() = user_id);

create policy "select own rows" on public.settings
  for select using (auth.uid() = user_id);
create policy "insert own rows" on public.settings
  for insert with check (auth.uid() = user_id);
create policy "update own rows" on public.settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own rows" on public.settings
  for delete using (auth.uid() = user_id);

-- ── profiles auto-create on signup (canonical Supabase pattern) ─────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [x] **Step 3: Apply**

Run: `supabase db reset`
Expected: both migrations applied, no errors.

- [x] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(b1): user tables with RLS-in-migration + profiles trigger"
```

---

### Task 5: `api/_lib/supabase.js` — service-role client factory (TDD)

**Files:**
- Test: `api/_lib/supabase.test.js`
- Create: `api/_lib/supabase.js`

- [x] **Step 1: Write the failing test**

The factory caches at module scope, so each test reloads the module (`vi.resetModules` + dynamic import):

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const load = () => import('./supabase.js');

describe('serviceClient', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns null when the data lane is not configured', async () => {
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    const { serviceClient } = await load();
    expect(serviceClient()).toBeNull();
  });

  it('returns a client with an rpc method when configured', async () => {
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
    const { serviceClient } = await load();
    const client = serviceClient();
    expect(client).not.toBeNull();
    expect(typeof client.rpc).toBe('function');
  });

  it('caches the client across calls', async () => {
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
    const { serviceClient } = await load();
    expect(serviceClient()).toBe(serviceClient());
  });
});
```

- [x] **Step 2: Run to verify it fails**

Run: `npx vitest run api/_lib/supabase.test.js`
Expected: FAIL — cannot find module `./supabase.js`.

- [x] **Step 3: Implement**

```js
import { createClient } from '@supabase/supabase-js';

let cached = null;

// Service-role client for server functions. Returns null when the data lane
// is not configured — callers fall back gracefully (B1 spec: fail open).
// The service-role key bypasses RLS; it must never reach the client bundle.
export function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!cached) {
    cached = createClient(url, key, { auth: { persistSession: false } });
  }
  return cached;
}
```

- [x] **Step 4: Run to verify it passes**

Run: `npx vitest run api/_lib/supabase.test.js`
Expected: PASS (3 tests).

- [x] **Step 5: Commit**

```bash
git add api/_lib/supabase.js api/_lib/supabase.test.js
git commit -m "feat(b1): service-role client factory (null when unconfigured)"
```

---

### Task 6: Durable store + fail-open limiter (TDD)

**Files:**
- Modify: `api/_lib/ratelimit.test.js` (append tests)
- Modify: `api/_lib/ratelimit.js`
- Modify: `api/_lib/handler.js`

- [x] **Step 1: Append the failing tests to `api/_lib/ratelimit.test.js`**

Add these imports to the existing import line: `SupabaseStore`, `defaultStore` (final line reads:)

```js
import { createRateLimiter, MemoryStore, SupabaseStore, defaultStore, clientKey } from './ratelimit.js';
```

Append at the end of the file:

```js
describe('SupabaseStore', () => {
  it('calls the RPC with the right args and returns the count', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: 7, error: null }) };
    const store = new SupabaseStore(client);
    const count = await store.increment('ip:1.1.1.1', 60000);
    expect(client.rpc).toHaveBeenCalledWith('increment_rate_limit', {
      p_key: 'ip:1.1.1.1',
      p_window_start: 60000,
    });
    expect(count).toBe(7);
  });

  it('throws when the RPC reports an error', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'down' } }) };
    const store = new SupabaseStore(client);
    await expect(store.increment('k', 0)).rejects.toThrow('down');
  });

  it('throws when the RPC itself rejects', async () => {
    const client = { rpc: vi.fn().mockRejectedValue(new Error('network')) };
    const store = new SupabaseStore(client);
    await expect(store.increment('k', 0)).rejects.toThrow('network');
  });
});

describe('fail-open behavior', () => {
  it('allows the request and logs when the store throws', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = { increment: vi.fn().mockRejectedValue(new Error('boom')) };
    const check = createRateLimiter({ windowMs: 1000, max: 1, store, now: () => 0 });
    const result = await check({ headers: { 'x-forwarded-for': '1.1.1.1' } });
    expect(result.allowed).toBe(true);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

describe('defaultStore', () => {
  it('picks SupabaseStore when the data lane is configured', async () => {
    vi.resetModules();
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
    const { defaultStore: freshDefaultStore, SupabaseStore: FreshSupabaseStore } =
      await import('./ratelimit.js');
    expect(freshDefaultStore()).toBeInstanceOf(FreshSupabaseStore);
    vi.unstubAllEnvs();
  });

  it('falls back to MemoryStore and warns exactly once when unconfigured', async () => {
    vi.resetModules();
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { defaultStore: freshDefaultStore, MemoryStore: FreshMemoryStore } =
      await import('./ratelimit.js');
    expect(freshDefaultStore()).toBeInstanceOf(FreshMemoryStore);
    freshDefaultStore();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
    vi.unstubAllEnvs();
  });
});
```

- [x] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run api/_lib/ratelimit.test.js`
Expected: FAIL — `SupabaseStore` / `defaultStore` are not exported.

- [x] **Step 3: Implement in `api/_lib/ratelimit.js`**

Add at the top of the file:

```js
import { serviceClient } from './supabase.js';
```

Add after the `MemoryStore` class:

```js
export class SupabaseStore {
  constructor(client) {
    this.client = client;
  }
  async increment(key, windowStart) {
    const { data, error } = await this.client.rpc('increment_rate_limit', {
      p_key: key,
      p_window_start: windowStart,
    });
    if (error) throw new Error(error.message);
    return data;
  }
}

let warned = false;

// Store selection at module load: durable when the data lane is configured,
// per-instance memory otherwise (warn once so deploy logs show the mode).
export function defaultStore() {
  const client = serviceClient();
  if (client) return new SupabaseStore(client);
  if (!warned) {
    warned = true;
    console.warn('rate limiting: SUPABASE_* env not set — using per-instance MemoryStore');
  }
  return new MemoryStore();
}
```

Replace the body of `createRateLimiter` with the fail-open version:

```js
export function createRateLimiter({ windowMs, max, store = new MemoryStore(), now = Date.now }) {
  return async function check(req) {
    const windowStart = Math.floor(now() / windowMs) * windowMs;
    let count;
    try {
      count = await store.increment(clientKey(req), windowStart);
    } catch (err) {
      // Fail open: AI-lane availability outranks limiter strictness (B1 spec).
      console.error('rate-limit store failure (failing open):', err.message);
      return { allowed: true };
    }
    if (count <= max) return { allowed: true };
    const retryAfterSec = Math.ceil((windowStart + windowMs - now()) / 1000);
    return { allowed: false, retryAfterSec };
  };
}
```

- [x] **Step 4: Wire the handler**

In `api/_lib/handler.js`, add `defaultStore` to the ratelimit import and pass it:

```js
import { createRateLimiter, defaultStore } from './ratelimit.js';
```

```js
  const checkRate = createRateLimiter({ ...rate, store: defaultStore() });
```

(One changed line each. Everything else in the handler stays as-is.)

- [x] **Step 5: Run the full suite**

Run: `npm test`
Expected: 43 files / 336 tests, all green (327 baseline + 3 from Task 5 + 6 here). A few `console.warn` lines about MemoryStore in stderr are expected — vitest isolates test files, so the warn-once fires once per file that loads the limiter without `SUPABASE_*` env (handler, endpoints, ratelimit tests).

- [x] **Step 6: Commit**

```bash
git add api/_lib/ratelimit.js api/_lib/ratelimit.test.js api/_lib/handler.js
git commit -m "feat(b1): durable SupabaseStore with fail-open limiter"
```

---

### Task 7: RLS adversarial suite — helpers + policies

**Files:**
- Create: `supabase/tests/rls/helpers.js`
- Create: `supabase/tests/rls/policies.test.js`

Requires the local stack from Task 2 (`supabase status` → healthy; if not, `supabase start`).

- [x] **Step 1: Create `supabase/tests/rls/helpers.js`**

```js
import { createClient } from '@supabase/supabase-js';

// Local-stack coordinates. Env first (CI exports these), then the Supabase
// CLI's well-known local demo JWTs so `supabase start` + `npm run test:rls`
// works with no manual exporting. The demo keys are public constants
// shipped with the CLI — they are not secrets.
const URL = process.env.SUPABASE_URL || process.env.API_URL || 'http://127.0.0.1:54321';
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

export function adminClient() {
  return createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });
}

export function anonClient() {
  return createClient(URL, ANON_KEY, { auth: { persistSession: false } });
}

// Creates a confirmed user via the admin API and returns a signed-in client.
export async function createSignedInUser(label) {
  const email = `rls-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`;
  const password = 'test-password-123';
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(error.message);
  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(signInError.message);
  return { id: data.user.id, client };
}
```

- [x] **Step 2: Create `supabase/tests/rls/policies.test.js`**

```js
import { describe, it, expect, beforeAll } from 'vitest';
import { anonClient, createSignedInUser } from './helpers.js';

// Adversarial RLS suite: authenticated as user A, attempt every cross-user
// operation against user B through real PostgREST. Any success = RLS hole.

let A;
let B;

beforeAll(async () => {
  A = await createSignedInUser('a');
  B = await createSignedInUser('b');
});

// Per-table row factories — minimal valid rows owned by the given user.
const TABLES = [
  { name: 'srs_state', row: (uid) => ({ user_id: uid, srs_key: 'greetings:Hallo', box: 2 }) },
  { name: 'stats_daily', row: (uid) => ({ user_id: uid, day: '2026-06-12', counters: { total: 1 } }) },
  { name: 'decks', row: (uid) => ({ user_id: uid, deck_id: 'custom', name: 'My deck', cards: [] }) },
  { name: 'settings', row: (uid) => ({ user_id: uid, data: { soundOn: true } }) },
];

for (const t of TABLES) {
  describe(`RLS: ${t.name}`, () => {
    it('A inserts an own row', async () => {
      const { error } = await A.client.from(t.name).insert(t.row(A.id));
      expect(error).toBeNull();
    });

    it("B inserts an own row (fixture for cross-user attempts)", async () => {
      const { error } = await B.client.from(t.name).insert(t.row(B.id));
      expect(error).toBeNull();
    });

    it("A cannot see B's rows", async () => {
      const { data, error } = await A.client.from(t.name).select('*').eq('user_id', B.id);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it('A cannot insert a row claiming to be B', async () => {
      const { error } = await A.client.from(t.name).insert(t.row(B.id));
      expect(error).not.toBeNull();
    });

    it("A cannot update or delete B's rows (zero rows affected)", async () => {
      const { data: updated, error: updateError } = await A.client
        .from(t.name)
        .update({ updated_at: new Date().toISOString() })
        .eq('user_id', B.id)
        .select();
      expect(updateError).toBeNull();
      expect(updated).toEqual([]);

      const { data: deleted, error: deleteError } = await A.client
        .from(t.name)
        .delete()
        .eq('user_id', B.id)
        .select();
      expect(deleteError).toBeNull();
      expect(deleted).toEqual([]);
    });
  });
}

describe('RLS: profiles', () => {
  it('the signup trigger created A their own profile, visible to A', async () => {
    const { data, error } = await A.client.from('profiles').select('*');
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0].user_id).toBe(A.id);
  });

  it("A cannot see B's profile", async () => {
    const { data, error } = await A.client.from('profiles').select('*').eq('user_id', B.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("A cannot update B's profile (zero rows affected)", async () => {
    const { data, error } = await A.client
      .from('profiles')
      .update({ display_name: 'pwned' })
      .eq('user_id', B.id)
      .select();
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

describe('RLS: anonymous access', () => {
  it('a bare anon client sees zero rows in every user table', async () => {
    const anon = anonClient();
    for (const table of ['profiles', 'srs_state', 'stats_daily', 'decks', 'settings']) {
      const { data, error } = await anon.from(table).select('*');
      expect(error, `table ${table}`).toBeNull();
      expect(data, `table ${table}`).toEqual([]);
    }
  });
});

describe('RLS: rate_limits', () => {
  it('is invisible to authenticated users', async () => {
    const { data, error } = await A.client.from('rate_limits').select('*');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
```

- [x] **Step 3: Run the suite**

Run: `npm run test:rls`
Expected: PASS — `policies.test.js` 25 tests (4 tables × 5 + profiles 3 + anon 1 + rate_limits 1), green against the local stack.

- [x] **Step 4: Commit**

```bash
git add supabase/tests/
git commit -m "test(b1): adversarial RLS suite — cross-user access denied everywhere"
```

---

### Task 8: RLS suite — RPC privileges + counting

**Files:**
- Create: `supabase/tests/rls/ratelimit.test.js`

- [x] **Step 1: Write the tests**

```js
import { describe, it, expect, beforeAll } from 'vitest';
import { adminClient, createSignedInUser } from './helpers.js';

// The increment RPC: service-role only, atomic counting, window cleanup.

const admin = adminClient();
const rpc = (key, windowStart) =>
  admin.rpc('increment_rate_limit', { p_key: key, p_window_start: windowStart });

let user;

beforeAll(async () => {
  user = await createSignedInUser('rpc');
});

describe('increment_rate_limit', () => {
  it('counts 1, 2, 3 within one window', async () => {
    const key = `test:${Date.now()}`;
    expect((await rpc(key, 1000)).data).toBe(1);
    expect((await rpc(key, 1000)).data).toBe(2);
    expect((await rpc(key, 1000)).data).toBe(3);
  });

  it('resets in a new window and cleans up the old one', async () => {
    const key = `test:cleanup:${Date.now()}`;
    await rpc(key, 1000);
    await rpc(key, 1000);
    expect((await rpc(key, 2000)).data).toBe(1);
    const { data } = await admin.from('rate_limits').select('window_start').eq('key', key);
    expect(data).toHaveLength(1);
    expect(Number(data[0].window_start)).toBe(2000);
  });

  it('tracks keys independently', async () => {
    const a = `test:a:${Date.now()}`;
    const b = `test:b:${Date.now()}`;
    expect((await rpc(a, 1000)).data).toBe(1);
    expect((await rpc(b, 1000)).data).toBe(1);
    expect((await rpc(a, 1000)).data).toBe(2);
  });

  it('is denied to authenticated users', async () => {
    const { error } = await user.client.rpc('increment_rate_limit', {
      p_key: 'attack',
      p_window_start: 0,
    });
    expect(error).not.toBeNull();
  });

  it('is denied to bare anon', async () => {
    const { anonClient } = await import('./helpers.js');
    const { error } = await anonClient().rpc('increment_rate_limit', {
      p_key: 'attack',
      p_window_start: 0,
    });
    expect(error).not.toBeNull();
  });
});
```

- [x] **Step 2: Run the full RLS suite**

Run: `npm run test:rls`
Expected: PASS — 2 files / 30 tests (25 + 5).

- [x] **Step 3: Commit**

```bash
git add supabase/tests/rls/ratelimit.test.js
git commit -m "test(b1): RPC privilege + atomic counting tests"
```

---

### Task 9: CI job, env docs, data contract page

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.env.example`
- Create: `docs/api/data.md`

- [x] **Step 1: Append the CI job**

At the end of `.github/workflows/ci.yml` (same indentation as the `verify:` job, i.e. nested under `jobs:`):

```yaml
  rls-policy-tests:
    name: RLS Policy Tests
    runs-on: ubuntu-latest
    env:
      HUSKY: 0
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Set up Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Start local Supabase (applies migrations)
        run: supabase start

      - name: Run RLS adversarial suite
        run: |
          eval "$(supabase status -o env)"
          export SUPABASE_URL="${SUPABASE_URL:-$API_URL}"
          export SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-$ANON_KEY}"
          export SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-$SERVICE_ROLE_KEY}"
          npm run test:rls
```

- [x] **Step 2: Document the env vars in `.env.example`**

Append:

```
# Supabase data lane (B1) — server-side only; the browser gets nothing.
# Values come from the Supabase project dashboard (Settings → API).
# When unset, the AI lane falls back to per-instance in-memory rate limiting.
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

- [x] **Step 3: Create `docs/api/data.md`**

```markdown
# Data contract — Supabase (phase B1)

The database half of the developer interface. Spec:
`docs/superpowers/specs/2026-06-12-backend-b1-data-lane-design.md`.
Schema source of truth: `supabase/migrations/` (versioned SQL).

## Tables

| Table | PK | Holds | Mirrors (localStorage) |
|---|---|---|---|
| `profiles` | `user_id` | display name; auto-created on signup by trigger | — |
| `srs_state` | `(user_id, pack_id, srs_key)` | Leitner state: `box`, `last_reviewed`, `next_due`, `reps` | `srs['<deckId>:<cardId>']` — `srs_key` holds that key verbatim |
| `stats_daily` | `(user_id, pack_id, day)` | `counters jsonb` | `daily['YYYY-MM-DD']` |
| `decks` | `(user_id, pack_id, deck_id)` | `name`, `cards jsonb` | custom decks |
| `settings` | `user_id` | `data jsonb` | the `gamification` key |
| `rate_limits` | `(key, window_start)` | AI-lane counters | — (server-only) |

All user tables carry `pack_id text default 'de'` (multi-language Phase 4
interlock) and `updated_at` (set by the writer — the B2 sync's
last-write-wins comparison value; no server trigger overwrites it).

## Guarantees (enforced by RLS, verified adversarially in CI)

- Every user table: RLS enabled in the same migration that creates it;
  policies allow exactly `auth.uid() = user_id` for select / insert /
  update / delete (profiles: no delete — account deletion is a B3
  server-side operation).
- `rate_limits` has **no policies** — invisible to anon and authenticated;
  only the service role reads or writes it, via
  `increment_rate_limit(key, window_start)` (SECURITY DEFINER, execute
  revoked from client roles).
- The CI job `rls-policy-tests` boots the real stack and attempts every
  cross-user operation; any success fails the build.

## Verifying locally

```bash
supabase start      # Docker required; applies all migrations
npm run test:rls    # 30 adversarial tests
```
```

- [x] **Step 4: Verify everything still green**

Run: `npm test` → 336. Run: `npm run lint` → exit 0. Run: `npm run format:check` → exit 0.

- [x] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml .env.example docs/api/data.md
git commit -m "ci(b1): RLS policy-test job + env docs + data contract page"
```

---

### Task 10: Final gate, PR, report-back

- [x] **Step 1: Full local gate**

```bash
npm test && npm run lint && npm run format:check && npm run test:rls
```
All four green (the last needs the local stack running).

- [x] **Step 2: Push and open the PR**

```bash
git push -u origin feature/backend-b1-data-lane
gh pr create --title "feat: B1 — Supabase data lane (schema, RLS, durable rate limiting)" --body "Implements docs/superpowers/plans/2026-06-12-backend-b1-data-lane.md: six RLS-guarded tables in versioned migrations, atomic increment_rate_limit RPC, SupabaseStore with fail-open selection in the AI lane, 30-test adversarial RLS suite behind npm run test:rls, and a dedicated CI job. Zero app-behavior change; npm test stays Docker-free."
```

Note: this PR's CI run is the **first real execution** of the `rls-policy-tests` job — watch that it passes.

- [x] **Step 3: Report back** to Claude Code with the `CURSOR_TASKS.md` template. Do **not** merge. Task 11 is owner-only.

---

### Task 11: Cloud rollout runbook — OWNER ONLY (after Claude Code merges the PR)

- [x] **Step 1 (owner):** supabase.com → New project (free tier), region **EU (Frankfurt)**. While in the dashboard: Authentication → Sign In / Up → enable **anonymous sign-ins** (needed at B2, free now).
- [x] **Step 2 (owner, in the repo):** `supabase link --project-ref <ref-from-dashboard-url>` then `supabase db push` (applies both migrations to the cloud — verify it lists them).
- [x] **Step 3 (owner):** add the env vars:

```bash
vercel env add SUPABASE_URL              # value: https://<ref>.supabase.co — NOT sensitive; all three environments
vercel env add SUPABASE_SERVICE_ROLE_KEY # dashboard → Settings → API; SENSITIVE = Yes; all three environments
```

Append both (real values) to the local `.env` as well — `vercel dev` can't pull sensitive values.

- [x] **Step 4 (owner or Claude Code):** redeploy (merge to main already did; otherwise `vercel redeploy`), then verify:
  - The B0 production battery still passes (chat 200, legacy 200, foreign origin 403, garbage 400).
  - Vercel function logs show **no** "using per-instance MemoryStore" warning.
  - After 2–3 prod AI calls: dashboard → Table Editor → `rate_limits` shows rows accruing.
- [x] **Step 5 (owner):** report completion to Claude Code so the arc memory and CURSOR_TASKS.md get updated and B2 design can start.
