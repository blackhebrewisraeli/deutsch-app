import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./supabase.js', () => ({ serviceClient: vi.fn() }));
vi.mock('./auth-middleware.js', () => ({ requireAuth: vi.fn() }));

import {
  meHandler,
  feedbackGetHandler,
  feedbackPatchHandler,
  feedbackDeleteHandler,
  usersHandler,
  blockHandler,
} from './adminEndpoints.js';
import { serviceClient } from './supabase.js';
import { requireAuth } from './auth-middleware.js';
import { createRes } from './test-helpers.js';

const ADMIN_EMAIL = 'esterkinshimon712@gmail.com';
const OTHER_EMAIL = 'blackhebrewisraeli@gmail.com';
const FEEDBACK_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

const adminAuth = {
  userId: 'admin-1',
  email: ADMIN_EMAIL,
  user: {
    id: 'admin-1',
    email: ADMIN_EMAIL,
    email_confirmed_at: '2026-09-18T00:00:00Z',
    identities: [
      { provider: 'google', identity_data: { email: ADMIN_EMAIL, email_verified: true } },
    ],
  },
};

const otherAuth = {
  userId: USER_ID,
  email: OTHER_EMAIL,
  user: {
    id: USER_ID,
    email: OTHER_EMAIL,
    email_confirmed_at: '2026-09-18T00:00:00Z',
  },
};

let seq = 0;
const req = (overrides = {}) => {
  seq += 1;
  return {
    method: 'GET',
    headers: { 'x-forwarded-for': `10.20.0.${seq}`, authorization: 'Bearer tok' },
    query: {},
    body: {},
    ...overrides,
  };
};

function chain(resolved) {
  const c = {
    select: vi.fn(() => c),
    eq: vi.fn(() => c),
    order: vi.fn(() => c),
    limit: vi.fn(() => c),
    update: vi.fn(() => c),
    delete: vi.fn(() => c),
    maybeSingle: vi.fn().mockResolvedValue(resolved),
    then(onFulfilled, onRejected) {
      return Promise.resolve(resolved).then(onFulfilled, onRejected);
    },
  };
  return c;
}

let fromCalls;
let listUsers;
let getUserById;
let chains;

function mockDb() {
  fromCalls = [];
  chains = [];
  listUsers = vi.fn().mockResolvedValue({ data: { users: [] }, error: null });
  getUserById = vi.fn().mockResolvedValue({ data: { user: otherAuth.user }, error: null });
  return {
    from: vi.fn((table) => {
      fromCalls.push(table);
      const next = chain({ data: table === 'feedback' ? [] : { blocked_at: null }, error: null });
      chains.push(next);
      return next;
    }),
    auth: { admin: { listUsers, getUserById } },
  };
}

describe('admin me', () => {
  beforeEach(() => {
    serviceClient.mockReturnValue(mockDb());
  });
  afterEach(() => vi.clearAllMocks());

  it('returns flags for a verified admin', async () => {
    requireAuth.mockResolvedValue(adminAuth);
    const res = createRes();
    await meHandler(req(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ isAdmin: true, isSystemAccount: true, blocked: false });
  });

  it('returns no privileges for blackhebrewisraeli@gmail.com', async () => {
    requireAuth.mockResolvedValue(otherAuth);
    const res = createRes();
    await meHandler(req(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.isAdmin).toBe(false);
    expect(res.body.isSystemAccount).toBe(false);
  });

  it('does not take isAdmin from the query or body', async () => {
    requireAuth.mockResolvedValue(otherAuth);
    const res = createRes();
    await meHandler(req({ query: { isAdmin: 'true' }, body: { isAdmin: true } }), res);
    expect(res.body.isAdmin).toBe(false);
  });
});

describe('admin feedback / users / block — access denial', () => {
  beforeEach(() => {
    serviceClient.mockReturnValue(mockDb());
    requireAuth.mockResolvedValue(otherAuth);
  });
  afterEach(() => vi.clearAllMocks());

  it('403s a non-admin listing feedback, even with body.isAdmin', async () => {
    const res = createRes();
    await feedbackGetHandler(req({ body: { isAdmin: true } }), res);
    expect(res.statusCode).toBe(403);
    expect(fromCalls).not.toContain('feedback');
  });

  it('403s a non-admin patching feedback status', async () => {
    const res = createRes();
    await feedbackPatchHandler(
      req({ method: 'PATCH', body: { id: FEEDBACK_ID, status: 'handled', isAdmin: true } }),
      res
    );
    expect(res.statusCode).toBe(403);
  });

  it('403s a non-admin deleting feedback', async () => {
    const res = createRes();
    await feedbackDeleteHandler(req({ method: 'DELETE', query: { id: FEEDBACK_ID } }), res);
    expect(res.statusCode).toBe(403);
  });

  it('403s a non-admin listing users', async () => {
    const res = createRes();
    await usersHandler(req(), res);
    expect(res.statusCode).toBe(403);
    expect(listUsers).not.toHaveBeenCalled();
  });

  it('403s a non-admin blocking a user', async () => {
    const res = createRes();
    await blockHandler(req({ method: 'POST', body: { userId: USER_ID, isAdmin: true } }), res);
    expect(res.statusCode).toBe(403);
  });

  it('401s when the token is missing', async () => {
    requireAuth.mockRejectedValue({
      code: 'unauthorized',
      message: 'Missing authorization token.',
    });
    const res = createRes();
    await feedbackGetHandler(req(), res);
    expect(res.statusCode).toBe(401);
  });
});

describe('admin feedback / users / block — admin path', () => {
  beforeEach(() => {
    serviceClient.mockReturnValue(mockDb());
    requireAuth.mockResolvedValue(adminAuth);
  });
  afterEach(() => vi.clearAllMocks());

  it('lists feedback for an admin', async () => {
    const items = [{ id: FEEDBACK_ID, status: 'open', message: 'hi' }];
    serviceClient.mockReturnValue({
      from: vi.fn(() => chain({ data: items, error: null })),
      auth: { admin: { listUsers, getUserById } },
    });
    const res = createRes();
    await feedbackGetHandler(req(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.items).toEqual(items);
  });

  it('marks feedback handled', async () => {
    const stored = { id: FEEDBACK_ID, status: 'handled' };
    const c = chain({ data: stored, error: null });
    serviceClient.mockReturnValue({
      from: vi.fn(() => c),
      auth: { admin: { listUsers, getUserById } },
    });
    const res = createRes();
    await feedbackPatchHandler(
      req({ method: 'PATCH', body: { id: FEEDBACK_ID, status: 'handled' } }),
      res
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('handled');
    expect(c.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'handled', handled_by: 'admin-1' })
    );
  });

  it('deletes feedback', async () => {
    const c = chain({ data: { id: FEEDBACK_ID }, error: null });
    serviceClient.mockReturnValue({
      from: vi.fn(() => c),
      auth: { admin: { listUsers, getUserById } },
    });
    const res = createRes();
    await feedbackDeleteHandler(req({ method: 'DELETE', query: { id: FEEDBACK_ID } }), res);
    expect(res.statusCode).toBe(204);
    expect(c.delete).toHaveBeenCalled();
  });

  it('lists users with computed flags, not a client-supplied role', async () => {
    listUsers = vi.fn().mockResolvedValue({
      data: {
        users: [
          adminAuth.user,
          {
            ...otherAuth.user,
            user_metadata: { role: 'admin' },
          },
        ],
      },
      error: null,
    });
    serviceClient.mockReturnValue({
      from: vi.fn(() =>
        chain({
          data: [
            { user_id: 'admin-1', handle: 'sys', blocked_at: null, created_at: 'c' },
            { user_id: USER_ID, handle: 'sam', blocked_at: null, created_at: 'c' },
          ],
          error: null,
        })
      ),
      auth: { admin: { listUsers, getUserById } },
    });
    const res = createRes();
    await usersHandler(req(), res);
    expect(res.statusCode).toBe(200);
    const byEmail = Object.fromEntries(res.body.items.map((u) => [u.email, u]));
    expect(byEmail[ADMIN_EMAIL].isAdmin).toBe(true);
    expect(byEmail[ADMIN_EMAIL].isSystemAccount).toBe(true);
    expect(byEmail[OTHER_EMAIL].isAdmin).toBe(false);
    expect(byEmail[OTHER_EMAIL].isSystemAccount).toBe(false);
  });

  it('refuses to block an admin identity', async () => {
    const adminId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    getUserById = vi.fn().mockResolvedValue({ data: { user: adminAuth.user }, error: null });
    const c = chain({ data: { blocked_at: null }, error: null });
    serviceClient.mockReturnValue({
      from: vi.fn(() => c),
      auth: { admin: { listUsers, getUserById } },
    });
    const res = createRes();
    await blockHandler(req({ method: 'POST', body: { userId: adminId } }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toMatch(/cannot be blocked/i);
    expect(c.update).not.toHaveBeenCalled();
  });

  it('blocks a regular user via service-role update, not a request field', async () => {
    const c = chain({ data: { blocked_at: null }, error: null });
    c.maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: { blocked_at: null }, error: null })
      .mockResolvedValueOnce({
        data: { user_id: USER_ID, blocked_at: '2026-09-18T00:00:00Z' },
        error: null,
      });
    getUserById = vi.fn().mockResolvedValue({ data: { user: otherAuth.user }, error: null });
    serviceClient.mockReturnValue({
      from: vi.fn(() => c),
      auth: { admin: { listUsers, getUserById } },
    });
    const res = createRes();
    await blockHandler(req({ method: 'POST', body: { userId: USER_ID } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.userId).toBe(USER_ID);
    expect(res.body.blockedAt).toBeTruthy();
    expect(c.update).toHaveBeenCalledWith({ blocked_at: expect.any(String) });
  });
});
