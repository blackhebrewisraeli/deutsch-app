// api/v1/account/delete.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../_lib/supabase.js', () => ({ serviceClient: vi.fn() }));
vi.mock('../../_lib/auth-middleware.js', () => ({ requireAuth: vi.fn() }));

import handler from './delete.js';
import { serviceClient } from '../../_lib/supabase.js';
import { requireAuth } from '../../_lib/auth-middleware.js';
import { createRes } from '../../_lib/test-helpers.js';

const USER = { userId: 'uid-1', email: 'a@b.com' };

// The route is a module singleton and its quota counters live for the whole test
// process, so every test gets a fresh IP and a fresh user id.
let seq = 0;
function makeReq(method = 'DELETE', token = 'tok') {
  seq += 1;
  return {
    method,
    headers: {
      'x-forwarded-for': `172.16.0.${seq}`,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  };
}
const freshUser = () => ({ ...USER, userId: `uid-${++seq}` });

const deleteUser = vi.fn();
// `from` must never be reached; if it is, the test that asserts so will say which.
const from = vi.fn(() => ({
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockResolvedValue({ error: null }),
}));
const mockDb = () => ({ from, auth: { admin: { deleteUser } } });

describe('DELETE /api/v1/account', () => {
  beforeEach(() => {
    requireAuth.mockResolvedValue(freshUser());
    deleteUser.mockResolvedValue({ error: null });
    serviceClient.mockReturnValue(mockDb());
  });
  afterEach(() => vi.clearAllMocks());

  it('returns 405 for non-DELETE methods', async () => {
    const res = createRes();
    await handler(makeReq('GET'), res);
    expect(res.statusCode).toBe(405);
  });

  it('returns 401 when requireAuth throws unauthorized', async () => {
    requireAuth.mockRejectedValue({
      code: 'unauthorized',
      message: 'Missing authorization token.',
    });
    const res = createRes();
    await handler(makeReq('DELETE', null), res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });

  it('deletes the auth user and returns 204', async () => {
    const user = freshUser();
    requireAuth.mockResolvedValue(user);
    const res = createRes();
    await handler(makeReq(), res);
    expect(res.statusCode).toBe(204);
    expect(deleteUser).toHaveBeenCalledWith(user.userId);
  });

  it('issues exactly ONE delete and touches no table directly — the FK cascade is the mechanism', async () => {
    const res = createRes();
    await handler(makeReq(), res);

    expect(res.statusCode).toBe(204);
    expect(deleteUser).toHaveBeenCalledTimes(1);
    // The old handler pre-deleted srs_state, stats_daily and settings before
    // calling deleteUser. That ordering is what allowed "data gone, account
    // alive" when the second step failed. Any table touched here reintroduces it.
    expect(from).not.toHaveBeenCalled();
  });

  it('returns 500 without a partial delete when deleteUser fails', async () => {
    deleteUser.mockResolvedValue({ error: { message: 'auth down' } });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = createRes();
    await handler(makeReq(), res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error.message).toBe('Failed to delete account.');
    // Nothing else was deleted, so the account is untouched rather than gutted.
    expect(from).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('logs the failure with the endpoint and the user, instead of swallowing it', async () => {
    const user = freshUser();
    requireAuth.mockResolvedValue(user);
    deleteUser.mockRejectedValue(new Error('network partition'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = createRes();
    await handler(makeReq(), res);

    expect(res.statusCode).toBe(500);
    const logged = spy.mock.calls.flat().join(' ');
    expect(logged).toContain('account.delete');
    expect(logged).toContain(user.userId);
    expect(logged).toContain('network partition');
    spy.mockRestore();
  });

  it('rate limits a repeat caller rather than accepting unlimited attempts', async () => {
    const ip = '172.31.7.7';
    const user = freshUser();
    requireAuth.mockResolvedValue(user);
    const mk = () => ({
      method: 'DELETE',
      headers: { 'x-forwarded-for': ip, authorization: 'Bearer tok' },
    });

    let limited = null;
    // userRate max is 5/hour; the 6th must be refused.
    for (let i = 0; i < 8 && !limited; i += 1) {
      const res = createRes();
      await handler(mk(), res);
      if (res.statusCode === 429) limited = res;
    }

    expect(limited).not.toBeNull();
    expect(limited.body.error.code).toBe('rate_limited');
    expect(limited.headers['Retry-After']).toBeDefined();
  });
});
