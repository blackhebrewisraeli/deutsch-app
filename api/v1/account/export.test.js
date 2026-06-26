import { describe, it, expect, vi, afterEach } from 'vitest';

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
      data: table === 'settings' ? [{ blob: { level: 1 } }] : [{ day: '2026-06-27', correct: 3 }],
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
    requireAuth.mockRejectedValue({
      code: 'unauthorized',
      message: 'Missing authorization token.',
    });
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
