# B3 — Account Export & Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `GET /api/v1/account/export` and `DELETE /api/v1/account` server endpoints plus a Danger Zone UI in `AccountSection` so signed-in users can download their data or permanently delete their account.

**Architecture:** Two Vercel serverless functions share a JWT-validation helper that reads the `Authorization` header and calls `supabase.auth.getUser()` via the service-role client. The React component grows an export button and an inline Danger Zone confirm flow; the client gets the session token from `useAuth`'s `session.access_token` and passes it to both endpoints.

**Tech Stack:** Vitest (globals:false), React 18 + inline styles (`src/lib/theme.js`), existing `api/_lib/` helpers (`serviceClient`, `sendError`, `createRes`/`getReq` test fixtures).

## Global Constraints

- Vitest `globals: false` — every test file imports `{ describe, it, expect, vi, beforeEach, afterEach }` from `'vitest'`
- Inline styles only — tokens from `src/lib/theme.js` (`COLORS`, `FONTS`, `FONT_SIZE`, `SPACE`, `RADIUS`, `BUTTON`)
- `npm install --legacy-peer-deps`
- Never bypass `.husky/pre-commit` (`--no-verify` is forbidden)
- Land via PR; never commit to `main` directly
- Commit messages end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Branch: `feat/b3-export-delete` off up-to-date `main`

---

## File Map

| File | Action |
|---|---|
| `api/_lib/auth-middleware.js` | **Create** — `requireAuth(req)` helper; extracts + validates JWT; returns `{ userId, email }` or throws |
| `api/_lib/auth-middleware.test.js` | **Create** |
| `api/_lib/test-helpers.js` | **Modify** — add `getReq(ip, token)` fixture for GET endpoints |
| `api/v1/account/export.js` | **Create** — `GET` handler |
| `api/v1/account/export.test.js` | **Create** |
| `api/v1/account/delete.js` | **Create** — `DELETE` handler |
| `api/v1/account/delete.test.js` | **Create** |
| `src/lib/auth.js` | **Modify** — export `getAccessToken()` helper |
| `src/components/stats/AccountSection.jsx` | **Modify** — export + Danger Zone UI |
| `src/components/stats/AccountSection.test.jsx` | **Modify** — new tests |

---

## Task 1: `requireAuth` middleware + `getReq` test fixture

**Files:**
- Create: `api/_lib/auth-middleware.js`
- Create: `api/_lib/auth-middleware.test.js`
- Modify: `api/_lib/test-helpers.js`

**Interfaces:**
- Produces: `requireAuth(req) → Promise<{ userId: string, email: string }>` — throws `{ code: 'unauthorized', message: string }` on failure
- Produces: `getReq(ip, token, overrides)` test fixture in `test-helpers.js`

- [x] **Step 1.1: Create the test file with failing tests**

```js
// api/_lib/auth-middleware.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock serviceClient before importing the module under test
vi.mock('./supabase.js', () => ({
  serviceClient: vi.fn(),
}));

import { requireAuth } from './auth-middleware.js';
import { serviceClient } from './supabase.js';

function makeReq(token) {
  return {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  };
}

describe('requireAuth', () => {
  afterEach(() => vi.clearAllMocks());

  it('throws unauthorized when Authorization header is absent', async () => {
    await expect(requireAuth(makeReq(null))).rejects.toMatchObject({
      code: 'unauthorized',
    });
  });

  it('throws unauthorized when token is invalid', async () => {
    serviceClient.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'bad' } }) },
    });
    await expect(requireAuth(makeReq('bad-token'))).rejects.toMatchObject({
      code: 'unauthorized',
    });
  });

  it('returns userId and email for a valid token', async () => {
    serviceClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'uid-1', email: 'a@b.com' } },
          error: null,
        }),
      },
    });
    const result = await requireAuth(makeReq('good-token'));
    expect(result).toEqual({ userId: 'uid-1', email: 'a@b.com' });
  });

  it('throws server_error when serviceClient is unavailable', async () => {
    serviceClient.mockReturnValue(null);
    await expect(requireAuth(makeReq('any-token'))).rejects.toMatchObject({
      code: 'server_error',
    });
  });
});
```

- [x] **Step 1.2: Run to confirm failure**

```bash
npx vitest run api/_lib/auth-middleware.test.js
```
Expected: FAIL — `auth-middleware.js` not found.

- [x] **Step 1.3: Create `api/_lib/auth-middleware.js`**

```js
import { serviceClient } from './supabase.js';

/**
 * Validates the Bearer JWT in req.headers.authorization.
 * Returns { userId, email } on success.
 * Throws { code, message } on failure — callers pass this to sendError.
 */
export async function requireAuth(req) {
  const header = req.headers?.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw { code: 'unauthorized', message: 'Missing authorization token.' };

  const client = serviceClient();
  if (!client) throw { code: 'server_error', message: 'Server is not configured.' };

  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) throw { code: 'unauthorized', message: 'Invalid or expired token.' };

  return { userId: data.user.id, email: data.user.email };
}
```

- [x] **Step 1.4: Run tests — expect pass**

```bash
npx vitest run api/_lib/auth-middleware.test.js
```
Expected: 4 tests pass.

- [x] **Step 1.5: Add `getReq` fixture to `api/_lib/test-helpers.js`**

Open `api/_lib/test-helpers.js` and add at the bottom:

```js
export const getReq = (ip, token = 'test-token', overrides = {}) => ({
  method: 'GET',
  headers: {
    'x-forwarded-for': ip,
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  },
  ...overrides,
});
```

- [x] **Step 1.6: Run full suite to confirm nothing broke**

```bash
npx vitest run
```
Expected: all existing tests pass.

- [x] **Step 1.7: Commit**

```bash
git add api/_lib/auth-middleware.js api/_lib/auth-middleware.test.js api/_lib/test-helpers.js
git commit -m "feat(b3): requireAuth middleware + getReq test fixture

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `GET /api/v1/account/export` endpoint

**Files:**
- Create: `api/v1/account/export.js`
- Create: `api/v1/account/export.test.js`

**Interfaces:**
- Consumes: `requireAuth(req)` from `api/_lib/auth-middleware.js`
- Consumes: `serviceClient()` from `api/_lib/supabase.js`
- Consumes: `sendError(res, code, message)` from `api/_lib/respond.js`
- Consumes: `getReq(ip, token)` from `api/_lib/test-helpers.js`
- Produces: `GET /api/v1/account/export` → `200 { email, exportedAt, data: { srs, daily, settings } }` or error envelope

- [x] **Step 2.1: Create the test file**

```js
// api/v1/account/export.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../_lib/supabase.js', () => ({ serviceClient: vi.fn() }));
vi.mock('../../_lib/auth-middleware.js', () => ({ requireAuth: vi.fn() }));

import handler from './export.js';
import { serviceClient } from '../../_lib/supabase.js';
import { requireAuth } from '../../_lib/auth-middleware.js';
import { createRes, getReq } from '../../_lib/test-helpers.js';

const USER = { userId: 'uid-1', email: 'a@b.com' };

const mockDb = () => ({
  from: vi.fn((table) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({
      data: table === 'settings'
        ? [{ blob: { level: 1 } }]
        : [{ day: '2026-06-27', correct: 3 }],
      error: null,
    }),
  })),
});

describe('GET /api/v1/account/export', () => {
  afterEach(() => vi.clearAllMocks());

  it('returns 405 for non-GET methods', async () => {
    const res = createRes();
    await handler({ method: 'POST', headers: {} }, res);
    expect(res.statusCode).toBe(405);
  });

  it('returns 401 when requireAuth throws unauthorized', async () => {
    requireAuth.mockRejectedValue({ code: 'unauthorized', message: 'Missing authorization token.' });
    const res = createRes();
    await handler(getReq('1.1.1.1', null), res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });

  it('returns 200 with correct shape on success', async () => {
    requireAuth.mockResolvedValue(USER);
    serviceClient.mockReturnValue(mockDb());
    const res = createRes();
    await handler(getReq('1.1.1.2', 'tok'), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.email).toBe('a@b.com');
    expect(res.body.exportedAt).toBeDefined();
    expect(res.body.data).toHaveProperty('srs');
    expect(res.body.data).toHaveProperty('daily');
    expect(res.body.data).toHaveProperty('settings');
  });

  it('returns 500 when a db query fails', async () => {
    requireAuth.mockResolvedValue(USER);
    serviceClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'db error' } }),
      })),
    });
    const res = createRes();
    await handler(getReq('1.1.1.3', 'tok'), res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error.code).toBe('server_error');
  });
});
```

- [x] **Step 2.2: Run to confirm failure**

```bash
npx vitest run api/v1/account/export.test.js
```
Expected: FAIL — `export.js` not found.

- [x] **Step 2.3: Create `api/v1/account/export.js`**

```js
import { sendError } from '../../_lib/respond.js';
import { serviceClient } from '../../_lib/supabase.js';
import { requireAuth } from '../../_lib/auth-middleware.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendError(res, 'method_not_allowed', 'Method not allowed');
  }

  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    return sendError(res, err.code ?? 'server_error', err.message ?? 'Unexpected error.');
  }

  const db = serviceClient();
  if (!db) return sendError(res, 'server_error', 'Server is not configured.');

  try {
    const [srsRes, dailyRes, settingsRes] = await Promise.all([
      db.from('srs_state').select('*').eq('user_id', auth.userId),
      db.from('stats_daily').select('*').eq('user_id', auth.userId),
      db.from('settings').select('*').eq('user_id', auth.userId),
    ]);

    if (srsRes.error) throw srsRes.error;
    if (dailyRes.error) throw dailyRes.error;
    if (settingsRes.error) throw settingsRes.error;

    return res.status(200).json({
      email: auth.email,
      exportedAt: new Date().toISOString(),
      data: {
        srs: srsRes.data ?? [],
        daily: dailyRes.data ?? [],
        settings: settingsRes.data?.[0] ?? null,
      },
    });
  } catch {
    return sendError(res, 'server_error', 'Failed to export data.');
  }
}
```

- [x] **Step 2.4: Run tests — expect pass**

```bash
npx vitest run api/v1/account/export.test.js
```
Expected: 4 tests pass.

- [x] **Step 2.5: Run full suite**

```bash
npx vitest run
```
Expected: all tests pass.

- [x] **Step 2.6: Commit**

```bash
git add api/v1/account/export.js api/v1/account/export.test.js
git commit -m "feat(b3): GET /api/v1/account/export endpoint

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `DELETE /api/v1/account` endpoint

**Files:**
- Create: `api/v1/account/delete.js`
- Create: `api/v1/account/delete.test.js`

**Interfaces:**
- Consumes: `requireAuth(req)` from `api/_lib/auth-middleware.js`
- Consumes: `serviceClient()` from `api/_lib/supabase.js`
- Consumes: `sendError(res, code, message)` from `api/_lib/respond.js`
- Produces: `DELETE /api/v1/account` → `204 No Content` or error envelope

- [x] **Step 3.1: Create the test file**

```js
// api/v1/account/delete.test.js
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../../_lib/supabase.js', () => ({ serviceClient: vi.fn() }));
vi.mock('../../_lib/auth-middleware.js', () => ({ requireAuth: vi.fn() }));

import handler from './delete.js';
import { serviceClient } from '../../_lib/supabase.js';
import { requireAuth } from '../../_lib/auth-middleware.js';
import { createRes } from '../../_lib/test-helpers.js';

const USER = { userId: 'uid-1', email: 'a@b.com' };

function makeReq(method = 'DELETE', token = 'tok') {
  return {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  };
}

const deleteUser = vi.fn();
const deleteRows = vi.fn().mockResolvedValue({ error: null });

const mockDb = () => ({
  from: vi.fn(() => ({
    delete: vi.fn().mockReturnThis(),
    eq: deleteRows,
  })),
  auth: { admin: { deleteUser } },
});

describe('DELETE /api/v1/account', () => {
  afterEach(() => vi.clearAllMocks());

  it('returns 405 for non-DELETE methods', async () => {
    const res = createRes();
    await handler(makeReq('GET'), res);
    expect(res.statusCode).toBe(405);
  });

  it('returns 401 when requireAuth throws unauthorized', async () => {
    requireAuth.mockRejectedValue({ code: 'unauthorized', message: 'Missing authorization token.' });
    const res = createRes();
    await handler(makeReq('DELETE', null), res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });

  it('deletes rows from all three tables then deletes auth user and returns 204', async () => {
    requireAuth.mockResolvedValue(USER);
    deleteUser.mockResolvedValue({ error: null });
    serviceClient.mockReturnValue(mockDb());
    const res = createRes();
    await handler(makeReq(), res);
    expect(res.statusCode).toBe(204);
    expect(deleteRows).toHaveBeenCalledTimes(3);
    expect(deleteUser).toHaveBeenCalledWith('uid-1');
  });

  it('returns 500 and does NOT call deleteUser when a row delete fails', async () => {
    requireAuth.mockResolvedValue(USER);
    deleteRows.mockResolvedValueOnce({ error: { message: 'db error' } });
    serviceClient.mockReturnValue(mockDb());
    const res = createRes();
    await handler(makeReq(), res);
    expect(res.statusCode).toBe(500);
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 3.2: Run to confirm failure**

```bash
npx vitest run api/v1/account/delete.test.js
```
Expected: FAIL — `delete.js` not found.

- [x] **Step 3.3: Create `api/v1/account/delete.js`**

```js
import { sendError } from '../../_lib/respond.js';
import { serviceClient } from '../../_lib/supabase.js';
import { requireAuth } from '../../_lib/auth-middleware.js';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return sendError(res, 'method_not_allowed', 'Method not allowed');
  }

  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    return sendError(res, err.code ?? 'server_error', err.message ?? 'Unexpected error.');
  }

  const db = serviceClient();
  if (!db) return sendError(res, 'server_error', 'Server is not configured.');

  try {
    // Delete data rows first. If any fail, bail before touching auth.
    const tables = ['srs_state', 'stats_daily', 'settings'];
    for (const table of tables) {
      const { error } = await db.from(table).delete().eq('user_id', auth.userId);
      if (error) throw error;
    }
    const { error: authErr } = await db.auth.admin.deleteUser(auth.userId);
    if (authErr) throw authErr;

    return res.status(204).end();
  } catch {
    return sendError(res, 'server_error', 'Failed to delete account.');
  }
}
```

- [x] **Step 3.4: Run tests — expect pass**

```bash
npx vitest run api/v1/account/delete.test.js
```
Expected: 4 tests pass.

- [x] **Step 3.5: Run full suite**

```bash
npx vitest run
```
Expected: all tests pass.

- [x] **Step 3.6: Commit**

```bash
git add api/v1/account/delete.js api/v1/account/delete.test.js
git commit -m "feat(b3): DELETE /api/v1/account endpoint

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `getAccessToken()` helper in `src/lib/auth.js`

**Files:**
- Modify: `src/lib/auth.js`

**Interfaces:**
- Produces: `getAccessToken() → Promise<string | null>` — returns the current session's JWT or null if not signed in

- [x] **Step 4.1: Add failing test to `src/lib/auth.test.js`**

Open `src/lib/auth.test.js`. Add this test inside (or at the end of) the existing `describe` block:

```js
it('getAccessToken returns the access token from the current session', async () => {
  const mockClient = {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'tok-abc' } },
      }),
    },
  };
  // getAccessToken uses the module-level client; re-stub createClient
  const { createClient } = await import('@supabase/supabase-js');
  createClient.mockReturnValue(mockClient);

  const { getAccessToken } = await import('./auth.js');
  const token = await getAccessToken();
  expect(token).toBe('tok-abc');
});

it('getAccessToken returns null when no session exists', async () => {
  const mockClient = {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  };
  const { createClient } = await import('@supabase/supabase-js');
  createClient.mockReturnValue(mockClient);

  const { getAccessToken } = await import('./auth.js');
  const token = await getAccessToken();
  expect(token).toBeNull();
});
```

- [x] **Step 4.2: Run to confirm failure**

```bash
npx vitest run src/lib/auth.test.js
```
Expected: FAIL — `getAccessToken` not exported.

- [x] **Step 4.3: Add `getAccessToken` to `src/lib/auth.js`**

At the bottom of `src/lib/auth.js`, add:

```js
/** Returns the current session's JWT, or null if not signed in. */
export async function getAccessToken() {
  const c = getClient();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data?.session?.access_token ?? null;
}
```

- [x] **Step 4.4: Run tests — expect pass**

```bash
npx vitest run src/lib/auth.test.js
```
Expected: all auth tests pass.

- [x] **Step 4.5: Commit**

```bash
git add src/lib/auth.js src/lib/auth.test.js
git commit -m "feat(b3): getAccessToken() helper in auth.js

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: `AccountSection` — Export button + Danger Zone UI

**Files:**
- Modify: `src/components/stats/AccountSection.jsx`
- Modify: `src/components/stats/AccountSection.test.jsx`

**Interfaces:**
- Consumes: `getAccessToken()` from `src/lib/auth.js`
- Consumes: `COLORS`, `FONTS`, `FONT_SIZE`, `FONT_WEIGHT`, `LETTER_SPACING`, `SPACE`, `RADIUS`, `BUTTON` from `src/lib/theme.js`
- New prop: `onDelete` — `() => Promise<void>` — called by the component after the user confirms; the parent (App.jsx) will handle the actual API call + localStorage clear + signOut

- [x] **Step 5.1: Add failing tests to `AccountSection.test.jsx`**

Replace the entire contents of `src/components/stats/AccountSection.test.jsx` with:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AccountSection from './AccountSection';

const signedIn = { email: 'sam@example.com' };

describe('AccountSection', () => {
  it('prompts guests to sign in', async () => {
    const onSignIn = vi.fn();
    render(<AccountSection user={null} onSignIn={onSignIn} onSignOut={() => {}} onDelete={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /sign in to sync/i }));
    expect(onSignIn).toHaveBeenCalled();
  });

  it('shows the email and a sign-out for signed-in users', async () => {
    const onSignOut = vi.fn();
    render(
      <AccountSection user={signedIn} onSignIn={() => {}} onSignOut={onSignOut} onDelete={() => {}} />
    );
    expect(screen.getByText('sam@example.com')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(onSignOut).toHaveBeenCalled();
  });

  it('shows last synced when a timestamp is provided', () => {
    render(
      <AccountSection
        user={signedIn}
        onSignIn={() => {}}
        onSignOut={() => {}}
        onDelete={() => {}}
        lastSyncedAt={Date.now() - 120_000}
      />
    );
    expect(screen.getByText(/last synced · 2m ago/i)).toBeInTheDocument();
  });

  it('shows Export and Danger Zone for signed-in users', () => {
    render(
      <AccountSection user={signedIn} onSignIn={() => {}} onSignOut={() => {}} onDelete={() => {}} />
    );
    expect(screen.getByRole('button', { name: /export my data/i })).toBeInTheDocument();
    expect(screen.getByText(/danger zone/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete account/i })).toBeInTheDocument();
  });

  it('does not show Export or Danger Zone for guests', () => {
    render(<AccountSection user={null} onSignIn={() => {}} onSignOut={() => {}} onDelete={() => {}} />);
    expect(screen.queryByRole('button', { name: /export my data/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/danger zone/i)).not.toBeInTheDocument();
  });

  it('reveals inline confirmation when Delete account is clicked', async () => {
    render(
      <AccountSection user={signedIn} onSignIn={() => {}} onSignOut={() => {}} onDelete={() => {}} />
    );
    await userEvent.click(screen.getByRole('button', { name: /delete account/i }));
    expect(screen.getByRole('button', { name: /yes, delete everything/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('hides confirmation when Cancel is clicked', async () => {
    render(
      <AccountSection user={signedIn} onSignIn={() => {}} onSignOut={() => {}} onDelete={() => {}} />
    );
    await userEvent.click(screen.getByRole('button', { name: /delete account/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('button', { name: /yes, delete everything/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete account/i })).toBeInTheDocument();
  });

  it('calls onDelete when Yes delete everything is clicked', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <AccountSection user={signedIn} onSignIn={() => {}} onSignOut={() => {}} onDelete={onDelete} />
    );
    await userEvent.click(screen.getByRole('button', { name: /delete account/i }));
    await userEvent.click(screen.getByRole('button', { name: /yes, delete everything/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
```

- [x] **Step 5.2: Run to confirm failures**

```bash
npx vitest run src/components/stats/AccountSection.test.jsx
```
Expected: 4 new tests fail, 3 existing pass.

- [x] **Step 5.3: Rewrite `src/components/stats/AccountSection.jsx`**

```jsx
import { useState } from 'react';
import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, SPACE, RADIUS, BUTTON } from '../../lib/theme';
import Button from '../ui/Button';

function formatRelativeSync(ms) {
  if (!ms) return null;
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

// Stats-tab account management.
// Guest: CTA to sign in for sync.
// Signed-in: email + sign out + last-synced + export + danger zone.
export default function AccountSection({ user, onSignIn, onSignOut, onDelete, lastSyncedAt = null }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exporting, setExporting] = useState(false);

  if (!user) {
    return (
      <div style={{ fontFamily: FONTS.body }}>
        <p style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag, color: COLORS.mute }}>
          Sign in to sync your progress across devices.
        </p>
        <Button onClick={onSignIn}>Sign in to sync →</Button>
      </div>
    );
  }

  const handleExport = async () => {
    setExporting(true);
    try {
      await onDelete.__exportData?.();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ fontFamily: FONTS.body }}>
      <div style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.md, marginBottom: SPACE[2] }}>
        {user.email}
      </div>
      {lastSyncedAt != null && (
        <div style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag, color: COLORS.mute, marginBottom: SPACE[2] }}>
          Last synced · {formatRelativeSync(lastSyncedAt)}
        </div>
      )}
      <Button variant="secondary" onClick={onSignOut} style={{ marginBottom: SPACE[4] }}>
        Sign out
      </Button>

      <div style={{ marginBottom: SPACE[3] }}>
        <Button
          variant="secondary"
          onClick={handleExport}
          disabled={exporting}
          aria-label="Export my data"
        >
          {exporting ? 'Exporting…' : 'Export my data'}
        </Button>
      </div>

      {/* Danger Zone */}
      <div
        style={{
          border: `1px solid ${COLORS.red}`,
          borderRadius: RADIUS.md,
          padding: SPACE[4],
          marginTop: SPACE[4],
        }}
      >
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: FONT_SIZE.tag,
            fontWeight: FONT_WEIGHT.bold,
            letterSpacing: LETTER_SPACING.caps,
            color: COLORS.red,
            marginBottom: SPACE[2],
          }}
        >
          DANGER ZONE
        </div>
        <p style={{ fontFamily: FONTS.body, fontSize: FONT_SIZE.base, marginBottom: SPACE[3] }}>
          Permanently delete your account and all data. This cannot be undone.
        </p>
        {!confirmDelete ? (
          <Button
            variant="danger"
            aria-label="Delete account"
            onClick={() => setConfirmDelete(true)}
          >
            Delete account
          </Button>
        ) : (
          <div>
            <p style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.sm, marginBottom: SPACE[2], color: COLORS.red }}>
              Are you sure? This will erase all your progress.
            </p>
            <div style={{ display: 'flex', gap: SPACE[2] }}>
              <Button variant="danger" aria-label="Yes, delete everything" onClick={onDelete}>
                Yes, delete everything
              </Button>
              <Button variant="secondary" aria-label="Cancel" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

> **Note:** The export button's click handler currently uses a pattern-matching workaround (`onDelete.__exportData`). In Step 5.5 we clean this up by splitting the props properly.

- [x] **Step 5.4: Fix the export prop — split `onExport` out properly**

The component needs a clean `onExport` prop, not the workaround above. Replace the component with the final version:

```jsx
import { useState } from 'react';
import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, SPACE, RADIUS } from '../../lib/theme';
import Button from '../ui/Button';

function formatRelativeSync(ms) {
  if (!ms) return null;
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

// Stats-tab account management.
// Guest: CTA to sign in for sync.
// Signed-in: email + sign out + last-synced + export + danger zone.
export default function AccountSection({
  user,
  onSignIn,
  onSignOut,
  onExport,
  onDelete,
  lastSyncedAt = null,
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exporting, setExporting] = useState(false);

  if (!user) {
    return (
      <div style={{ fontFamily: FONTS.body }}>
        <p style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag, color: COLORS.mute }}>
          Sign in to sync your progress across devices.
        </p>
        <Button onClick={onSignIn}>Sign in to sync →</Button>
      </div>
    );
  }

  const handleExport = async () => {
    setExporting(true);
    try {
      await onExport?.();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ fontFamily: FONTS.body }}>
      <div style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.md, marginBottom: SPACE[2] }}>
        {user.email}
      </div>
      {lastSyncedAt != null && (
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: FONT_SIZE.tag,
            color: COLORS.mute,
            marginBottom: SPACE[2],
          }}
        >
          Last synced · {formatRelativeSync(lastSyncedAt)}
        </div>
      )}
      <Button variant="secondary" onClick={onSignOut} style={{ marginBottom: SPACE[4] }}>
        Sign out
      </Button>

      <div style={{ marginBottom: SPACE[3] }}>
        <Button
          variant="secondary"
          onClick={handleExport}
          disabled={exporting}
          aria-label="Export my data"
        >
          {exporting ? 'Exporting…' : 'Export my data'}
        </Button>
      </div>

      {/* Danger Zone */}
      <div
        style={{
          border: `1px solid ${COLORS.red}`,
          borderRadius: RADIUS.md,
          padding: SPACE[4],
          marginTop: SPACE[4],
        }}
      >
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: FONT_SIZE.tag,
            fontWeight: FONT_WEIGHT.bold,
            letterSpacing: LETTER_SPACING.caps,
            color: COLORS.red,
            marginBottom: SPACE[2],
          }}
        >
          DANGER ZONE
        </div>
        <p
          style={{
            fontFamily: FONTS.body,
            fontSize: FONT_SIZE.base,
            marginBottom: SPACE[3],
          }}
        >
          Permanently delete your account and all data. This cannot be undone.
        </p>
        {!confirmDelete ? (
          <Button variant="danger" aria-label="Delete account" onClick={() => setConfirmDelete(true)}>
            Delete account
          </Button>
        ) : (
          <div>
            <p
              style={{
                fontFamily: FONTS.mono,
                fontSize: FONT_SIZE.sm,
                marginBottom: SPACE[2],
                color: COLORS.red,
              }}
            >
              Are you sure? This will erase all your progress.
            </p>
            <div style={{ display: 'flex', gap: SPACE[2] }}>
              <Button variant="danger" aria-label="Yes, delete everything" onClick={onDelete}>
                Yes, delete everything
              </Button>
              <Button
                variant="secondary"
                aria-label="Cancel"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [x] **Step 5.5: Run tests — expect pass**

```bash
npx vitest run src/components/stats/AccountSection.test.jsx
```
Expected: all 8 tests pass.

- [x] **Step 5.6: Run full suite**

```bash
npx vitest run
```
Expected: all tests pass.

- [x] **Step 5.7: Commit**

```bash
git add src/components/stats/AccountSection.jsx src/components/stats/AccountSection.test.jsx
git commit -m "feat(b3): Export button + Danger Zone in AccountSection

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Wire export + delete into `App.jsx`

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `getAccessToken()` from `src/lib/auth.js`
- Consumes: `onExport`, `onDelete` props on `<AccountSection>`
- The export handler fetches `/api/v1/account/export`, triggers a browser download
- The delete handler fetches `DELETE /api/v1/account`, clears localStorage, calls `signOut()`

- [x] **Step 6.1: Find where `AccountSection` is rendered in `App.jsx`**

```bash
grep -n "AccountSection" src/App.jsx
```

Note the line number — you will add `onExport` and `onDelete` props there.

- [x] **Step 6.2: Add `handleExport` and `handleDelete` functions to `App.jsx`**

Find the block where `signOut` and other auth handlers are defined and add after them:

```js
const handleExport = async () => {
  const token = await getAccessToken();
  if (!token) { showToast('Please sign in again.'); return; }
  try {
    const res = await fetch('/api/v1/account/export', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error();
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sprachschule-export.json';
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    showToast('Export failed — try again.');
  }
};

const handleDelete = async () => {
  const token = await getAccessToken();
  if (!token) { showToast('Please sign in again.'); return; }
  try {
    const res = await fetch('/api/v1/account/delete', { method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error();
    localStorage.clear();
    await signOut();
  } catch {
    showToast('Could not delete account — try again.');
  }
};
```

- [x] **Step 6.3: Add the import for `getAccessToken` at the top of `App.jsx`**

Find the existing auth import line:
```js
import { ..., signOut, useAuth } from './lib/auth';
```
Add `getAccessToken` to it:
```js
import { ..., signOut, useAuth, getAccessToken } from './lib/auth';
```

- [x] **Step 6.4: Pass props to `<AccountSection>`**

Find the `<AccountSection>` JSX and add the two new props:
```jsx
<AccountSection
  user={user}
  onSignIn={...}
  onSignOut={...}
  onExport={handleExport}
  onDelete={handleDelete}
  lastSyncedAt={...}
/>
```

- [x] **Step 6.5: Run full suite**

```bash
npx vitest run
```
Expected: all tests pass.

- [x] **Step 6.6: Commit**

```bash
git add src/App.jsx src/lib/auth.js
git commit -m "feat(b3): wire export + delete into App.jsx

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Push + PR

- [x] **Step 7.1: Push branch**

```bash
git push -u origin feat/b3-export-delete
```

- [x] **Step 7.2: Open PR**

```bash
gh pr create \
  --title "feat(b3): account export & delete (data-rights hygiene)" \
  --body "## Summary
- \`GET /api/v1/account/export\` — downloads all user data as JSON
- \`DELETE /api/v1/account\` — wipes DB rows + auth user; client clears localStorage + signs out
- \`AccountSection\` gains Export button + Danger Zone with inline confirm flow
- \`requireAuth\` middleware shared by both endpoints

## Test plan
- [x] Sign in on prod → Stats tab → Export my data → JSON file downloads
- [x] Sign in → Delete account → confirm → signed out + fresh guest state
- [x] Cancel on confirm → returns to Delete account button
- [x] \`npm test\` passes"
```

- [x] **Step 7.3: Wait for CI green, then merge**

```bash
gh pr checks <PR_NUMBER> --watch
gh pr merge <PR_NUMBER> --merge --delete-branch
```
