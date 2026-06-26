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
    requireAuth.mockRejectedValue({
      code: 'unauthorized',
      message: 'Missing authorization token.',
    });
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
