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
    league_id: 'L1',
    handle: 'BlueFuchs01',
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
