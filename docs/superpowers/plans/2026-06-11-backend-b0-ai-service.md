# Backend B0 — AI Service Lane Hardening: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.
> **For Cursor:** ignore the line above — execute the tasks in order, checking off checkboxes, committing at each task's commit step.

**Goal:** Replace the single raw Anthropic proxy (`api/chat.js`) with three versioned, rate-limited, contract-documented endpoints (`/api/v1/ai/chat|grade|deck`) sharing one middleware chain, rename the server secret to `ANTHROPIC_API_KEY`, and unify dev/prod on the same serverless code path.

**Architecture:** Per `docs/superpowers/specs/2026-06-10-backend-architecture-design.md` (lane 1). Shared helpers live in `api/_lib/` (underscore paths are not deployed as routes by Vercel); each endpoint file is a 3-line quota configuration of one handler factory. Rate limiting uses a fixed window with a **pluggable store** — B0 ships an in-memory store (per warm function instance, best effort); phase B1 swaps in the durable Supabase-backed store behind the same interface. The legacy `/api/chat` route stays as a re-export shim for already-cached PWA bundles.

**Tech Stack:** Vercel serverless functions (plain JS, ESM), Vitest (jsdom env is fine for these tests — `fetch` is stubbed, `process.env` is available), existing ESLint flat config (already grants `api/**` Node globals).

**Branch:** `feature/backend-b0-ai-service`, from up-to-date `main`.

---

## Preconditions (verify before Task 1 — STOP if any fails)

1. Cursor missions **A6** (`cursor/phase1-card-identity`) and **A7** (`cursor/component-tests-translate`) are **merged into `main`**. Check: `git log main --oneline | head -15` shows the card-identity re-key and translate-test commits.
2. Owner has run the env step (B0 section of the spec's Manual steps):
   `vercel env ls` shows `ANTHROPIC_API_KEY` in **Development, Preview, Production** (the old `VITE_ANTHROPIC_API_KEY` still present — it is removed only after deploy verification) and `ALLOWED_ORIGINS` in **Production**.
3. Record the baseline: `git checkout main && git pull && npm test` → note the passing test-file/test counts (referred to below as "baseline"). Then `git checkout -b feature/backend-b0-ai-service`.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `api/_lib/respond.js` | Create | The error envelope — single definition of codes → HTTP statuses |
| `api/_lib/origin.js` | Create | Origin allow-list check (env-driven, soft semantics) |
| `api/_lib/validate.js` | Create | Body parsing/validation/capping → clean `safeBody` |
| `api/_lib/ratelimit.js` | Create | Fixed-window limiter + `MemoryStore` + IP key extraction |
| `api/_lib/anthropic.js` | Create | The one upstream call to Anthropic |
| `api/_lib/handler.js` | Create | Factory composing the chain into an endpoint handler |
| `api/_lib/*.test.js` | Create | Tests for all of the above (in `_lib/` so Vercel never deploys them as routes) |
| `api/v1/ai/chat.js`, `grade.js`, `deck.js` | Create | 3-line quota configs of the factory |
| `api/chat.js` | Rewrite | Legacy shim → re-export of the v1 chat handler |
| `vercel.json` | Modify | Functions glob `api/*.js` → `api/**/*.js` |
| `vitest.config.js` | Modify | Include `api/**/*.test.js`; coverage over `api/**` |
| `package.json` | Modify | `lint`/`lint:fix` cover `api/`; lint-staged for `api/**`; add `dev:full` |
| `src/lib/claude.js` | Rewrite | Endpoint-routed client (`chat`/`grade`/`deck`), one URL scheme everywhere |
| `src/lib/claude.test.js` | Modify | Exact URL assertion + endpoint-routing test |
| `src/components/translate/TypingExercise.jsx` | Modify | Route grading call to `grade` |
| `src/components/translate/generateSentences.js` | Modify | Route sentence generation to `grade` (the "exercise lane") |
| `src/components/VocabTab.jsx` | Modify | Route deck generation to `deck` |
| `vite.config.js` | Rewrite | Delete the dev proxy + `loadEnv` (PWA config unchanged) |
| `.env.example` | Rewrite | New secret names |
| `docs/api/README.md`, `docs/api/ai.md`, `docs/api/packs.md` | Create | The developer-interface contract docs |
| `README.md` | Modify | 4 spot-edits: proxy section, quick start, scripts, deploy |

`src/components/ChatTab.jsx` is **intentionally untouched** — its `callClaude(...)` call uses the default `chat` endpoint.

---

### Task 1: Point the toolchain at `api/`

**Files:**
- Modify: `vitest.config.js`
- Modify: `package.json`

- [x] **Step 1: Extend vitest to pick up api tests and cover api code**

In `vitest.config.js`, change the `include` line and the coverage `include`/`exclude` arrays:

```js
    include: ['src/**/*.test.{js,jsx}', 'api/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**', 'src/data/**', 'src/components/**', 'api/**'],
      exclude: ['src/**/*.test.{js,jsx}', 'api/**/*.test.js'],
    },
```

- [x] **Step 2: Extend lint + scripts in package.json**

In `package.json`, change these four script lines (leave the rest untouched):

```json
    "dev": "vite",
    "dev:full": "vercel dev",
    "lint": "eslint src/ api/",
    "lint:fix": "eslint src/ api/ --fix",
```

(`dev` stays plain Vite for UI-only work — AI calls fail politely there; `dev:full` runs the real functions. `vercel dev` invokes the Vite framework preset directly, so there is no script recursion.)

And in the `lint-staged` block, add an entry for api files (keep the two existing entries):

```json
  "lint-staged": {
    "src/**/*.{js,jsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "api/**/*.js": [
      "eslint --fix",
      "prettier --write"
    ],
    "src/**/*.{json,md,css}": [
      "prettier --write"
    ]
  },
```

- [x] **Step 3: Verify nothing changed behaviorally**

Run: `npm test` → same counts as baseline (no api tests exist yet).
Run: `npm run lint` → exit 0 (existing `api/chat.js` already lints under the flat config's Node-globals block).

- [x] **Step 4: Commit**

```bash
git add vitest.config.js package.json
git commit -m "chore(b0): vitest + lint + scripts reach api/"
```

---

### Task 2: Error envelope — `api/_lib/respond.js`

**Files:**
- Create: `api/_lib/respond.js`
- Test: `api/_lib/respond.test.js`

- [x] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { sendError, ERROR_CODES } from './respond.js';

function createRes() {
  return {
    statusCode: 0,
    headers: {},
    body: undefined,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe('sendError', () => {
  it('maps every code to its HTTP status and wraps the envelope', () => {
    expect(ERROR_CODES).toEqual({
      bad_request: 400,
      unauthorized: 401,
      forbidden: 403,
      method_not_allowed: 405,
      rate_limited: 429,
      upstream_error: 502,
      server_error: 500,
    });
    const res = createRes();
    sendError(res, 'bad_request', 'nope');
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: { code: 'bad_request', message: 'nope' } });
  });

  it('sets extra headers when provided', () => {
    const res = createRes();
    sendError(res, 'rate_limited', 'slow down', { 'Retry-After': '42' });
    expect(res.statusCode).toBe(429);
    expect(res.headers['Retry-After']).toBe('42');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/_lib/respond.test.js`
Expected: FAIL — cannot find module `./respond.js`.

- [x] **Step 3: Write the implementation**

```js
// The error envelope — the single definition of machine codes → HTTP status.
// Contract: docs/api/README.md. `unauthorized` is reserved for phase B2 (JWTs).

export const ERROR_CODES = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  method_not_allowed: 405,
  rate_limited: 429,
  upstream_error: 502,
  server_error: 500,
};

export function sendError(res, code, message, extraHeaders = {}) {
  for (const [key, value] of Object.entries(extraHeaders)) {
    res.setHeader(key, value);
  }
  return res.status(ERROR_CODES[code]).json({ error: { code, message } });
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/_lib/respond.test.js`
Expected: PASS (2 tests).

- [x] **Step 5: Commit**

```bash
git add api/_lib/respond.js api/_lib/respond.test.js
git commit -m "feat(b0): shared error envelope for the AI lane"
```

---

### Task 3: Origin allow-list — `api/_lib/origin.js`

**Files:**
- Create: `api/_lib/origin.js`
- Test: `api/_lib/origin.test.js`

- [x] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { originAllowed, parseAllowedOrigins } from './origin.js';

describe('parseAllowedOrigins', () => {
  it('splits, trims, and drops empties', () => {
    expect(parseAllowedOrigins(' https://a.com , https://b.com ,')).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
    expect(parseAllowedOrigins(undefined)).toEqual([]);
  });
});

describe('originAllowed', () => {
  it('passes everything when no allow-list is configured', () => {
    expect(originAllowed({ headers: { origin: 'https://evil.com' } }, [])).toBe(true);
  });

  it('passes requests without an Origin header (non-browser clients)', () => {
    expect(originAllowed({ headers: {} }, ['https://a.com'])).toBe(true);
  });

  it('passes a listed origin and rejects an unlisted one', () => {
    const allowed = ['https://a.com'];
    expect(originAllowed({ headers: { origin: 'https://a.com' } }, allowed)).toBe(true);
    expect(originAllowed({ headers: { origin: 'https://evil.com' } }, allowed)).toBe(false);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/_lib/origin.test.js`
Expected: FAIL — cannot find module `./origin.js`.

- [x] **Step 3: Write the implementation**

```js
// Origin allow-list (mandatory in production via the ALLOWED_ORIGINS env var,
// unset elsewhere). A present-but-unlisted Origin is rejected; an absent
// Origin passes — non-browser clients can omit or spoof it, so per-identity
// rate limiting remains the real abuse control.

export function parseAllowedOrigins(raw) {
  return (raw || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export function originAllowed(req, allowed = parseAllowedOrigins(process.env.ALLOWED_ORIGINS)) {
  const origin = req.headers.origin;
  if (allowed.length === 0 || !origin) return true;
  return allowed.includes(origin);
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/_lib/origin.test.js`
Expected: PASS (4 tests).

- [x] **Step 5: Commit**

```bash
git add api/_lib/origin.js api/_lib/origin.test.js
git commit -m "feat(b0): origin allow-list helper"
```

---

### Task 4: Request validation — `api/_lib/validate.js`

**Files:**
- Create: `api/_lib/validate.js`
- Test: `api/_lib/validate.test.js`

- [x] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { validateAiBody, ALLOWED_MODELS, MAX_TOKENS_CAP } from './validate.js';

const valid = () => ({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 1000,
  system: 'You are a tutor',
  messages: [{ role: 'user', content: 'Hallo' }],
});

describe('validateAiBody', () => {
  it('accepts a valid body and returns only known-safe fields', () => {
    const result = validateAiBody({ ...valid(), tools: [{ evil: true }], metadata: { x: 1 } });
    expect(result.ok).toBe(true);
    expect(result.safeBody).toEqual({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: 'You are a tutor',
      messages: [{ role: 'user', content: 'Hallo' }],
    });
    expect(Object.keys(result.safeBody).sort()).toEqual(['max_tokens', 'messages', 'model', 'system']);
  });

  it('parses a JSON string body and rejects a malformed one', () => {
    expect(validateAiBody(JSON.stringify(valid())).ok).toBe(true);
    expect(validateAiBody('{not json').ok).toBe(false);
  });

  it('rejects non-object bodies', () => {
    expect(validateAiBody(null).ok).toBe(false);
    expect(validateAiBody(42).ok).toBe(false);
  });

  it('rejects unknown models', () => {
    expect(validateAiBody({ ...valid(), model: 'claude-opus-4-8' }).ok).toBe(false);
    expect(ALLOWED_MODELS).toContain('claude-haiku-4-5-20251001');
  });

  it('clamps max_tokens to the cap and defaults bad values', () => {
    expect(validateAiBody({ ...valid(), max_tokens: 999999 }).safeBody.max_tokens).toBe(MAX_TOKENS_CAP);
    expect(validateAiBody({ ...valid(), max_tokens: 'lots' }).safeBody.max_tokens).toBe(1000);
    expect(validateAiBody({ ...valid(), max_tokens: -5 }).safeBody.max_tokens).toBe(1000);
  });

  it('rejects a non-string system prompt', () => {
    expect(validateAiBody({ ...valid(), system: { inject: true } }).ok).toBe(false);
  });

  it('omits system from safeBody when not provided', () => {
    const body = valid();
    delete body.system;
    const result = validateAiBody(body);
    expect(result.ok).toBe(true);
    expect('system' in result.safeBody).toBe(false);
  });

  it('rejects empty, oversized, or malformed message arrays', () => {
    expect(validateAiBody({ ...valid(), messages: [] }).ok).toBe(false);
    expect(validateAiBody({ ...valid(), messages: 'hi' }).ok).toBe(false);
    const tooMany = Array.from({ length: 101 }, () => ({ role: 'user', content: 'x' }));
    expect(validateAiBody({ ...valid(), messages: tooMany }).ok).toBe(false);
    expect(validateAiBody({ ...valid(), messages: [{ role: 'system', content: 'x' }] }).ok).toBe(false);
    expect(validateAiBody({ ...valid(), messages: [{ role: 'user', content: 7 }] }).ok).toBe(false);
  });

  it('rejects when total characters exceed the budget', () => {
    const huge = 'x'.repeat(100001);
    expect(validateAiBody({ ...valid(), messages: [{ role: 'user', content: huge }] }).ok).toBe(false);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/_lib/validate.test.js`
Expected: FAIL — cannot find module `./validate.js`.

- [x] **Step 3: Write the implementation**

(Constraint values are carried over unchanged from the pre-B0 `api/chat.js`.)

```js
// Validates and constrains an AI-lane request body, returning a rebuilt
// clean body — only known-safe fields are ever forwarded upstream.

export const ALLOWED_MODELS = ['claude-haiku-4-5-20251001'];
export const MAX_TOKENS_CAP = 1024;
export const MAX_MESSAGES = 100;
export const MAX_TOTAL_CHARS = 100000; // system prompt + all message content

// Returns { ok: true, safeBody } or { ok: false, message }.
export function validateAiBody(rawBody) {
  let body = rawBody;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return { ok: false, message: 'Invalid JSON body' };
    }
  }
  if (!body || typeof body !== 'object') {
    return { ok: false, message: 'Invalid request body' };
  }

  const { model, system, messages } = body;

  if (!ALLOWED_MODELS.includes(model)) {
    return { ok: false, message: 'Unsupported model' };
  }

  let maxTokens = Number(body.max_tokens);
  if (!Number.isFinite(maxTokens) || maxTokens <= 0) maxTokens = 1000;
  maxTokens = Math.min(Math.floor(maxTokens), MAX_TOKENS_CAP);

  if (system !== undefined && typeof system !== 'string') {
    return { ok: false, message: 'Invalid system prompt' };
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, message: 'messages must be a non-empty array' };
  }
  if (messages.length > MAX_MESSAGES) {
    return { ok: false, message: 'Too many messages' };
  }

  let totalChars = system ? system.length : 0;
  for (const m of messages) {
    if (
      !m ||
      typeof m !== 'object' ||
      (m.role !== 'user' && m.role !== 'assistant') ||
      typeof m.content !== 'string'
    ) {
      return { ok: false, message: 'Invalid message format' };
    }
    totalChars += m.content.length;
  }
  if (totalChars > MAX_TOTAL_CHARS) {
    return { ok: false, message: 'Request too large' };
  }

  const safeBody = { model, max_tokens: maxTokens, messages };
  if (system) safeBody.system = system;
  return { ok: true, safeBody };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/_lib/validate.test.js`
Expected: PASS (9 tests).

- [x] **Step 5: Commit**

```bash
git add api/_lib/validate.js api/_lib/validate.test.js
git commit -m "feat(b0): AI request validation with rebuilt clean body"
```

---

### Task 5: Rate limiting — `api/_lib/ratelimit.js`

**Files:**
- Create: `api/_lib/ratelimit.js`
- Test: `api/_lib/ratelimit.test.js`

- [x] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { createRateLimiter, MemoryStore, clientKey } from './ratelimit.js';

const reqFrom = (ip) => ({ headers: ip ? { 'x-forwarded-for': ip } : {} });

describe('clientKey', () => {
  it('uses the first x-forwarded-for hop', () => {
    expect(clientKey(reqFrom('1.2.3.4, 10.0.0.1'))).toBe('ip:1.2.3.4');
  });

  it('falls back to unknown without the header', () => {
    expect(clientKey(reqFrom(null))).toBe('ip:unknown');
  });
});

describe('createRateLimiter', () => {
  it('allows up to max requests, then blocks with a Retry-After', async () => {
    let t = 0;
    const check = createRateLimiter({ windowMs: 1000, max: 2, store: new MemoryStore(), now: () => t });
    expect((await check(reqFrom('1.1.1.1'))).allowed).toBe(true);
    expect((await check(reqFrom('1.1.1.1'))).allowed).toBe(true);
    t = 250;
    const blocked = await check(reqFrom('1.1.1.1'));
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(1); // ceil((1000 - 250) / 1000)
  });

  it('resets when the window rolls over', async () => {
    let t = 0;
    const check = createRateLimiter({ windowMs: 1000, max: 1, store: new MemoryStore(), now: () => t });
    expect((await check(reqFrom('2.2.2.2'))).allowed).toBe(true);
    expect((await check(reqFrom('2.2.2.2'))).allowed).toBe(false);
    t = 1001;
    expect((await check(reqFrom('2.2.2.2'))).allowed).toBe(true);
  });

  it('tracks each client key independently', async () => {
    const check = createRateLimiter({ windowMs: 1000, max: 1, store: new MemoryStore(), now: () => 0 });
    expect((await check(reqFrom('3.3.3.3'))).allowed).toBe(true);
    expect((await check(reqFrom('4.4.4.4'))).allowed).toBe(true);
    expect((await check(reqFrom('3.3.3.3'))).allowed).toBe(false);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/_lib/ratelimit.test.js`
Expected: FAIL — cannot find module `./ratelimit.js`.

- [x] **Step 3: Write the implementation**

```js
// Fixed-window rate limiter with a pluggable store.
// B0 ships MemoryStore: counters live in the warm function instance, so
// limits are best-effort per instance (and per deployed function). Phase B1
// replaces it with a Supabase-backed store behind the same interface:
//   store.increment(key, windowStart) -> Promise<count within window>
// In B2, clientKey() gains a user-id branch when requests carry a JWT.

export class MemoryStore {
  constructor() {
    this.windows = new Map();
  }
  async increment(key, windowStart) {
    const entry = this.windows.get(key);
    if (!entry || entry.windowStart !== windowStart) {
      this.windows.set(key, { windowStart, count: 1 });
      return 1;
    }
    entry.count += 1;
    return entry.count;
  }
}

export function clientKey(req) {
  // Behind Vercel's proxy the client address is the first x-forwarded-for hop.
  const fwd = req.headers['x-forwarded-for'];
  const ip = typeof fwd === 'string' && fwd.length > 0 ? fwd.split(',')[0].trim() : 'unknown';
  return `ip:${ip}`;
}

export function createRateLimiter({ windowMs, max, store = new MemoryStore(), now = Date.now }) {
  return async function check(req) {
    const windowStart = Math.floor(now() / windowMs) * windowMs;
    const count = await store.increment(clientKey(req), windowStart);
    if (count <= max) return { allowed: true };
    const retryAfterSec = Math.ceil((windowStart + windowMs - now()) / 1000);
    return { allowed: false, retryAfterSec };
  };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/_lib/ratelimit.test.js`
Expected: PASS (5 tests).

- [x] **Step 5: Commit**

```bash
git add api/_lib/ratelimit.js api/_lib/ratelimit.test.js
git commit -m "feat(b0): fixed-window rate limiter with pluggable store"
```

---

### Task 6: Upstream call + handler factory — `api/_lib/anthropic.js`, `api/_lib/handler.js`

**Files:**
- Create: `api/_lib/anthropic.js`
- Create: `api/_lib/handler.js`
- Test: `api/_lib/handler.test.js`

- [x] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAiHandler } from './handler.js';

function createRes() {
  return {
    statusCode: 0,
    headers: {},
    body: undefined,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

const validBody = () => ({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 100,
  system: 'sys',
  messages: [{ role: 'user', content: 'Hallo' }],
});

const postReq = (overrides = {}) => ({
  method: 'POST',
  headers: { 'x-forwarded-for': '9.9.9.9' },
  body: validBody(),
  ...overrides,
});

const wideOpen = { rate: { windowMs: 60000, max: 100 } };

describe('createAiHandler', () => {
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubEnv('ALLOWED_ORIGINS', '');
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          status: 200,
          json: () => Promise.resolve({ content: [{ type: 'text', text: 'ok' }] }),
        })
      )
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('rejects non-POST methods with the envelope', async () => {
    const res = createRes();
    await createAiHandler(wideOpen)(postReq({ method: 'GET' }), res);
    expect(res.statusCode).toBe(405);
    expect(res.body.error.code).toBe('method_not_allowed');
  });

  it('rejects an unlisted Origin when the allow-list is configured', async () => {
    vi.stubEnv('ALLOWED_ORIGINS', 'https://good.example');
    const res = createRes();
    await createAiHandler(wideOpen)(
      postReq({ headers: { origin: 'https://evil.example', 'x-forwarded-for': '9.9.9.9' } }),
      res
    );
    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe('forbidden');
  });

  it('responds 500 when the server has no API key', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const res = createRes();
    await createAiHandler(wideOpen)(postReq(), res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error.code).toBe('server_error');
  });

  it('enforces the per-endpoint quota with Retry-After', async () => {
    const handler = createAiHandler({ rate: { windowMs: 60000, max: 2 } });
    const r1 = createRes();
    const r2 = createRes();
    const r3 = createRes();
    await handler(postReq(), r1);
    await handler(postReq(), r2);
    await handler(postReq(), r3);
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    expect(r3.statusCode).toBe(429);
    expect(r3.body.error.code).toBe('rate_limited');
    expect(Number(r3.headers['Retry-After'])).toBeGreaterThan(0);
  });

  it('rejects invalid bodies before calling upstream', async () => {
    const res = createRes();
    await createAiHandler(wideOpen)(postReq({ body: { model: 'nope' } }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('bad_request');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('forwards a clean body with server-side credentials and passes the response through', async () => {
    const res = createRes();
    await createAiHandler(wideOpen)(postReq({ body: { ...validBody(), tools: ['x'] } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ content: [{ type: 'text', text: 'ok' }] });
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(options.headers['x-api-key']).toBe('test-key');
    expect(options.headers['anthropic-version']).toBe('2023-06-01');
    const sent = JSON.parse(options.body);
    expect('tools' in sent).toBe(false);
  });

  it('passes upstream error statuses through unchanged', async () => {
    fetch.mockResolvedValueOnce({
      status: 429,
      json: () => Promise.resolve({ type: 'error', error: { type: 'rate_limit_error', message: 'busy' } }),
    });
    const res = createRes();
    await createAiHandler(wideOpen)(postReq(), res);
    expect(res.statusCode).toBe(429);
    expect(res.body.error.message).toBe('busy');
  });

  it('maps network failures to 502 upstream_error', async () => {
    fetch.mockRejectedValueOnce(new Error('boom'));
    const res = createRes();
    await createAiHandler(wideOpen)(postReq(), res);
    expect(res.statusCode).toBe(502);
    expect(res.body.error.code).toBe('upstream_error');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/_lib/handler.test.js`
Expected: FAIL — cannot find module `./handler.js`.

- [x] **Step 3: Write `api/_lib/anthropic.js`**

```js
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

// The one upstream call. Returns { status, data }; throws on network failure
// (the handler maps that to a 502 envelope).
export async function forwardToAnthropic(safeBody, apiKey) {
  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(safeBody),
  });
  const data = await response.json();
  return { status: response.status, data };
}
```

- [x] **Step 4: Write `api/_lib/handler.js`**

```js
import { sendError } from './respond.js';
import { originAllowed } from './origin.js';
import { validateAiBody } from './validate.js';
import { createRateLimiter } from './ratelimit.js';
import { forwardToAnthropic } from './anthropic.js';

// One factory builds every AI endpoint: same chain, per-endpoint quotas.
// Rate limiting runs before validation on purpose — malformed requests
// still consume quota, so garbage cannot be free.
export function createAiHandler({ rate }) {
  const checkRate = createRateLimiter(rate);

  return async function handler(req, res) {
    if (req.method !== 'POST') {
      return sendError(res, 'method_not_allowed', 'Method not allowed');
    }
    if (!originAllowed(req)) {
      return sendError(res, 'forbidden', 'Origin not allowed');
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return sendError(res, 'server_error', 'Server is not configured.');
    }

    const limit = await checkRate(req);
    if (!limit.allowed) {
      return sendError(res, 'rate_limited', 'Too many requests — slow down.', {
        'Retry-After': String(limit.retryAfterSec),
      });
    }

    const result = validateAiBody(req.body);
    if (!result.ok) {
      return sendError(res, 'bad_request', result.message);
    }

    try {
      const { status, data } = await forwardToAnthropic(result.safeBody, apiKey);
      return res.status(status).json(data);
    } catch (err) {
      console.error('AI lane upstream failure:', err.message);
      return sendError(res, 'upstream_error', 'Upstream request failed');
    }
  };
}
```

- [x] **Step 5: Run test to verify it passes**

Run: `npx vitest run api/_lib/handler.test.js`
Expected: PASS (8 tests).

- [x] **Step 6: Commit**

```bash
git add api/_lib/anthropic.js api/_lib/handler.js api/_lib/handler.test.js
git commit -m "feat(b0): AI endpoint handler factory with full middleware chain"
```

---

### Task 7: Endpoints, legacy shim, Vercel config

**Files:**
- Create: `api/v1/ai/chat.js`, `api/v1/ai/grade.js`, `api/v1/ai/deck.js`
- Rewrite: `api/chat.js`
- Modify: `vercel.json`
- Test: `api/_lib/endpoints.test.js`

- [x] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import chat from '../v1/ai/chat.js';
import grade from '../v1/ai/grade.js';
import deck from '../v1/ai/deck.js';
import legacy from '../chat.js';

describe('AI endpoints', () => {
  it('every route exports a handler function', () => {
    expect(typeof chat).toBe('function');
    expect(typeof grade).toBe('function');
    expect(typeof deck).toBe('function');
    expect(typeof legacy).toBe('function');
  });

  it('the legacy /api/chat route is the v1 chat handler', () => {
    expect(legacy).toBe(chat);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/_lib/endpoints.test.js`
Expected: FAIL — cannot find module `../v1/ai/chat.js`.

- [x] **Step 3: Create the three endpoint files**

`api/v1/ai/chat.js` (quota: 20 requests / 5 minutes — spec §Lane 1):

```js
import { createAiHandler } from '../../_lib/handler.js';

// Anna conversation turns.
export default createAiHandler({ rate: { windowMs: 5 * 60 * 1000, max: 20 } });
```

`api/v1/ai/grade.js` (quota: 60 / 5 minutes — the "exercise lane": grading AND exercise-sentence generation):

```js
import { createAiHandler } from '../../_lib/handler.js';

// Exercise lane: answer/translation grading and exercise-sentence generation.
export default createAiHandler({ rate: { windowMs: 5 * 60 * 1000, max: 60 } });
```

`api/v1/ai/deck.js` (quota: 5 / hour):

```js
import { createAiHandler } from '../../_lib/handler.js';

// Custom deck generation.
export default createAiHandler({ rate: { windowMs: 60 * 60 * 1000, max: 5 } });
```

- [x] **Step 4: Rewrite `api/chat.js` as the legacy shim**

Replace the entire file with:

```js
// Legacy alias for already-cached PWA bundles — same handler as
// /api/v1/ai/chat. Remove one release cycle after B0 ships.
// Note: Vercel deploys this as a separate function, so in B0 (in-memory
// store) its quota pool is separate from /api/v1/ai/chat; B1's durable
// store unifies them.
export { default } from './v1/ai/chat.js';
```

- [x] **Step 5: Update `vercel.json` so nested functions get the duration cap**

Replace the `functions` block key:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "functions": {
    "api/**/*.js": {
      "maxDuration": 30
    }
  }
}
```

- [x] **Step 6: Run tests to verify they pass**

Run: `npx vitest run api/_lib/endpoints.test.js`
Expected: PASS (2 tests).
Run: `npm test`
Expected: PASS — baseline + 30 new api tests, zero failures.

- [x] **Step 7: Commit**

```bash
git add api/v1 api/chat.js vercel.json api/_lib/endpoints.test.js
git commit -m "feat(b0): versioned /api/v1/ai endpoints + legacy /api/chat shim"
```

---

### Task 8: Client routing — `src/lib/claude.js` and call sites

**Files:**
- Rewrite: `src/lib/claude.js`
- Modify: `src/lib/claude.test.js`
- Modify: `src/components/translate/TypingExercise.jsx` (line ~42)
- Modify: `src/components/translate/generateSentences.js` (line ~19)
- Modify: `src/components/VocabTab.jsx` (line ~149)

- [x] **Step 1: Add the failing endpoint-routing test**

In `src/lib/claude.test.js`, inside the existing `describe('callClaude', ...)` block, add:

```js
  it('routes to the requested endpoint and defaults to chat', async () => {
    await callClaude('sys', 'msg');
    expect(fetch.mock.calls[0][0]).toBe('/api/v1/ai/chat');

    await callClaude('sys', 'msg', [], { endpoint: 'grade' });
    expect(fetch.mock.calls[1][0]).toBe('/api/v1/ai/grade');

    await callClaude('sys', 'msg', [], { endpoint: 'deck' });
    expect(fetch.mock.calls[2][0]).toBe('/api/v1/ai/deck');
  });
```

Also tighten the URL assertion in the first existing test — replace
`expect(url).toMatch(/\/api\//);` with `expect(url).toBe('/api/v1/ai/chat');`.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/claude.test.js`
Expected: FAIL — `callClaude` does not accept an options argument yet, URLs differ.

- [x] **Step 3: Rewrite `src/lib/claude.js`**

```js
// Claude API client. Every environment calls our versioned serverless API —
// the key never exists in the browser. Locally, `npm run dev:full`
// (vercel dev) serves the same functions that run in production;
// plain `npm run dev` has no /api routes, so AI features fail politely.
// Contract: docs/api/ai.md.

const ENDPOINTS = {
  chat: '/api/v1/ai/chat',
  grade: '/api/v1/ai/grade',
  deck: '/api/v1/ai/deck',
};

export const callClaude = async (
  systemPrompt,
  userMessage,
  conversationHistory = [],
  { endpoint = 'chat' } = {}
) => {
  const messages = [...conversationHistory, { role: 'user', content: userMessage }];

  const response = await fetch(ENDPOINTS[endpoint], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const detail = errorData?.error?.message || JSON.stringify(errorData);
    console.error('Claude API error:', response.status, detail);
    throw new Error(`API call failed (${response.status}): ${detail}`);
  }

  const data = await response.json();
  return data.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
};
```

- [x] **Step 4: Route the three non-chat call sites**

In `src/components/translate/TypingExercise.jsx`, find
`const raw = await callClaude(system, user);` and change to:

```js
      const raw = await callClaude(system, user, [], { endpoint: 'grade' });
```

In `src/components/translate/generateSentences.js`, find
`const raw = await callClaude(system, user);` and change to:

```js
  const raw = await callClaude(system, user, [], { endpoint: 'grade' });
```

In `src/components/VocabTab.jsx`, find
`const raw = await callClaude(systemPrompt, userMsg);` and change to:

```js
      const raw = await callClaude(systemPrompt, userMsg, [], { endpoint: 'deck' });
```

(Indentation: keep each line's existing indentation. `ChatTab.jsx` keeps the
default `chat` endpoint — do not modify it.)

- [x] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS — all tests green, including A7's translate component tests
(they mock the claude module, so the extra argument is compatible).

- [x] **Step 6: Commit**

```bash
git add src/lib/claude.js src/lib/claude.test.js src/components/translate/TypingExercise.jsx src/components/translate/generateSentences.js src/components/VocabTab.jsx
git commit -m "feat(b0): client routes per-feature AI endpoints"
```

---

### Task 9: Dev story — retire the Vite proxy, rename the local secret

**Files:**
- Rewrite: `vite.config.js`
- Rewrite: `.env.example`

- [x] **Step 1: Rewrite `vite.config.js`** (drop `loadEnv` + the `server.proxy` block; the PWA config is byte-identical to before):

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
// API calls go to /api/v1/ai/* — Vercel functions in production, served
// locally by `npm run dev:full` (vercel dev). No dev proxy, no key in Vite.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Service worker caches all app assets for offline use
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Don't cache API calls — those need to be live
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
      manifest: {
        name: 'Deutsch. Sprachschule',
        short_name: 'Deutsch.',
        description: 'Learn German with AI-powered guided exercises',
        theme_color: '#16110b',
        background_color: '#FDF3C0',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});
```

- [x] **Step 2: Rewrite `.env.example`**

```
# Server-side secret — read by the Vercel functions (api/), never by the
# browser bundle. Get a key at https://console.anthropic.com
# Cloud values live in Vercel project env settings (all three environments);
# `npm run dev:full` (vercel dev) injects the Development values automatically,
# so a local .env is only a fallback.
# IMPORTANT: never commit your real .env file to git.
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here

# Optional origin allow-list — set in Vercel Production only (comma-separated).
# ALLOWED_ORIGINS=https://deutsch-app-dusky.vercel.app
```

- [x] **Step 3: Verify build + suite**

Run: `npm run build` → completes without errors.
Run: `npm test` → all green.
Run: `grep -rn "VITE_ANTHROPIC_API_KEY" src/ api/ vite.config.js .env.example` → **no matches** (README still matches until Task 10).

- [x] **Step 4: Commit**

```bash
git add vite.config.js .env.example
git commit -m "feat(b0): one code path for dev and prod — vercel dev, no Vite proxy"
```

---

### Task 10: Contract docs + README

**Files:**
- Create: `docs/api/README.md`, `docs/api/ai.md`, `docs/api/packs.md`
- Modify: `README.md` (four spots)

- [x] **Step 1: Create `docs/api/README.md`**

```markdown
# deutsch-app API — conventions

The REST half of the **developer interface** (the other half is the database
contract, arriving in phase B1). Spec:
`docs/superpowers/specs/2026-06-10-backend-architecture-design.md`.

- **Base path:** `/api/v1/` — breaking changes mean `/api/v2/`; shipped `/v1`
  contracts stay stable.
- **Auth:** none in B0. Phase B2 adds optional Supabase JWTs (anonymous-first).
- **Error envelope** — every non-2xx produced by our functions:

  ```json
  { "error": { "code": "<machine_code>", "message": "<human text>" } }
  ```

  | code | HTTP | meaning |
  |---|---|---|
  | `bad_request` | 400 | body failed validation |
  | `unauthorized` | 401 | reserved for B2 (JWT auth) |
  | `forbidden` | 403 | Origin present but not allow-listed |
  | `method_not_allowed` | 405 | only POST is accepted |
  | `rate_limited` | 429 | quota exceeded — honor `Retry-After` (seconds) |
  | `upstream_error` | 502 | Anthropic unreachable / network failure |
  | `server_error` | 500 | missing server configuration or unexpected failure |

  Upstream Anthropic **error responses pass through unchanged** (their own
  `{ "type": "error", "error": { ... } }` shape and status).
- **Rate limits** are per client IP in B0 (per user id once B2 ships JWTs),
  fixed windows, best-effort per function instance until B1's durable store.
```

- [x] **Step 2: Create `docs/api/ai.md`**

```markdown
# AI endpoints — `/api/v1/ai/*`

Three endpoints, one shared contract. The split exists for per-feature rate
quotas and future server-side prompt assembly without a breaking change.
Prompts are client-assembled and pack-owned (platform Phase 1.3).

| Endpoint | Used by | Quota (B0 initial) |
|---|---|---|
| `POST /api/v1/ai/chat` | Anna conversation turns | 20 req / 5 min |
| `POST /api/v1/ai/grade` | Exercise lane: answer grading **and** exercise-sentence generation | 60 req / 5 min |
| `POST /api/v1/ai/deck` | Custom deck generation | 5 req / hour |

## Request (all endpoints)

```json
{
  "model": "claude-haiku-4-5-20251001",
  "max_tokens": 1000,
  "system": "optional system prompt",
  "messages": [{ "role": "user", "content": "..." }]
}
```

Constraints (requests violating any → `400 bad_request`):
- `model` must be on the allow-list (`api/_lib/validate.js`)
- `max_tokens` clamped to 1024; non-numeric values default to 1000
- 1–100 messages; roles only `user`/`assistant`; string content
- ≤ 100,000 total characters (system + all message content)
- unknown fields are stripped, never forwarded

## Response

2xx: the Anthropic Messages response, passed through unchanged.
Non-2xx: see the envelope table in `README.md`; Anthropic's own errors pass
through with their status.

## Legacy alias

`POST /api/chat` → same handler as `/api/v1/ai/chat`. Kept for already-cached
PWA bundles; scheduled for removal one release cycle after B0 ships.
```

- [x] **Step 3: Create `docs/api/packs.md`**

```markdown
# Pack delivery — `/api/v1/packs` (reserved, NOT implemented)

Contract reserved by the backend architecture spec (lane 3). Implementation
is triggered by the existence of a second language pack — until then packs
ship bundled in the build and these routes do not exist.

| Endpoint | Returns |
|---|---|
| `GET /api/v1/packs` | `[{ "id": "de", "name": "German", "nativeName": "Deutsch", "version": "1.0.0" }]` |
| `GET /api/v1/packs/:id` | Pack manifest + content (shape finalized in the B4 sub-spec) |

Do not implement, stub, or route these in B0–B3.
```

- [x] **Step 4: Update `README.md` — four spot-edits**

**(a)** Replace the section body under `### The API proxy — keeping your key safe`
(the paragraph starting "In **development**, Vite proxies", the ASCII diagram,
and the paragraph starting "In **production** (Vercel)") with:

```markdown
Every environment calls the same versioned serverless endpoints — `/api/v1/ai/chat`, `/api/v1/ai/grade`, `/api/v1/ai/deck` ([contract docs](./docs/api/ai.md)):

```
Browser                Vercel function (/api/v1/ai/*)        Anthropic API
   │                            │                                  │
   │  POST /api/v1/ai/chat      │                                  │
   │  ─────────────────────────►│  validate · rate-limit · rebuild │
   │                            │  x-api-key: [ANTHROPIC_API_KEY]  │
   │                            │  ────────────────────────────── ►│
   │                            │◄─────────────────────────────────│
   │◄───────────────────────────│                                  │
```

In production the functions read `ANTHROPIC_API_KEY` from Vercel's environment. Locally, `npm run dev:full` (vercel dev) runs the **same functions** with the Development environment injected — the key never appears in the browser bundle, in any environment. Endpoints are rate-limited per IP and reject bodies that fail validation ([error envelope](./docs/api/README.md)).
```

**(b)** In **Quick Start**, replace steps 3–4 of the code block:

```bash
# 3. Link Vercel (serves the API locally; injects the Development env)
npx vercel link

# 4. Start the full dev server (app + API)
npm run dev:full     # UI-only work: npm run dev (AI calls disabled)
```

and delete the now-stale comment line `# Edit .env → VITE_ANTHROPIC_API_KEY=...`.

**(c)** In **Available scripts**, replace the `npm run dev` and `npm run lint` lines with:

```bash
npm run dev          # Vite only — UI work, no API routes (AI calls fail politely)
npm run dev:full     # vercel dev — app + serverless functions, like production
npm run lint         # ESLint across src/ and api/
```

**(d)** In **Deploy to Production**, change step 3 of the numbered block to:

```
3. Environment Variables → ANTHROPIC_API_KEY = sk-ant-api03-...  (+ optional ALLOWED_ORIGINS)
```

and in the sentence below it, change "registers `/api/chat.js` as a serverless function" to "registers everything under `api/` as serverless functions"; in **What gets deployed**, change the last bullet to "`api/` — Node.js serverless functions (versioned AI endpoints + legacy alias)".

- [x] **Step 5: Verify and commit**

Run: `npm test` → green. Run: `npm run lint` → exit 0.
Run: `grep -rn "VITE_ANTHROPIC_API_KEY" . --include="*.md" --include="*.js" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.vercel` → **no matches**.

```bash
git add docs/api README.md
git commit -m "docs(b0): API contract pages + README dev/deploy flow"
```

---

### Task 11: Final verification + PR

- [x] **Step 1: Full gate**

Run all three, expect all green:
```bash
npm test && npm run lint && npm run format:check
```

- [x] **Step 2: Push and open the PR**

```bash
git push -u origin feature/backend-b0-ai-service
gh pr create --title "feat: B0 — versioned AI service lane (/api/v1/ai/*)" --body "Implements the B0 phase of docs/superpowers/specs/2026-06-10-backend-architecture-design.md: versioned endpoints, shared middleware (origin allow-list, validation, per-IP rate limiting, error envelope), ANTHROPIC_API_KEY rename, vercel dev story, legacy /api/chat shim, docs/api contract pages. Plan: docs/superpowers/plans/2026-06-11-backend-b0-ai-service.md"
```

- [x] **Step 3: Report back** to Claude Code with the template from `CURSOR_TASKS.md` for review before merge. Do **not** merge.

---

### Task 12: Deploy verification runbook — OWNER ONLY (humans, not Cursor)

- [x] **Step 1 (pre-merge, owner):** confirm `vercel env ls` shows `ANTHROPIC_API_KEY` in Development+Preview+Production and `ALLOWED_ORIGINS` in Production (precondition 2 — re-check it survived).
- [x] **Step 2 (owner):** merge the reviewed PR; wait for the Vercel production deploy.
- [x] **Step 3 (owner or Claude Code):** verify production:

```bash
# happy path through the new route (expect HTTP 200 + JSON content)
curl -sS -X POST https://deutsch-app-dusky.vercel.app/api/v1/ai/chat \
  -H 'Content-Type: application/json' \
  -d '{"model":"claude-haiku-4-5-20251001","max_tokens":16,"messages":[{"role":"user","content":"Sag Hallo"}]}' | head -c 400

# legacy alias still answers (expect 200)
curl -sS -o /dev/null -w "%{http_code}\n" -X POST https://deutsch-app-dusky.vercel.app/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"model":"claude-haiku-4-5-20251001","max_tokens":16,"messages":[{"role":"user","content":"Hallo"}]}'

# foreign browser origin is rejected (expect 403)
curl -sS -o /dev/null -w "%{http_code}\n" -X POST https://deutsch-app-dusky.vercel.app/api/v1/ai/chat \
  -H 'Content-Type: application/json' -H 'Origin: https://evil.example' \
  -d '{"model":"claude-haiku-4-5-20251001","max_tokens":16,"messages":[{"role":"user","content":"Hallo"}]}'

# garbage body gets the envelope (expect 400 + {"error":{"code":"bad_request",...}})
curl -sS -X POST https://deutsch-app-dusky.vercel.app/api/v1/ai/chat \
  -H 'Content-Type: application/json' -d '{"model":"gpt-4"}'
```

- [x] **Step 4 (owner, only after Step 3 passes):** remove the old secret:

```bash
vercel env rm VITE_ANTHROPIC_API_KEY preview
vercel env rm VITE_ANTHROPIC_API_KEY production
```

- [x] **Step 5 (owner):** open the production PWA, run one chat turn, one translate grading, one deck generation. Rename the key in your local `.env` to `ANTHROPIC_API_KEY` (it is only a fallback — `vercel dev` injects the cloud Development value). Schedule the legacy-shim removal for the next release cycle (tracked in CURSOR_TASKS.md backlog).
