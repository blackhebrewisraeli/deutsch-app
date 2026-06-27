import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../../_lib/supabase.js', () => ({ serviceClient: vi.fn() }));
vi.mock('../../_lib/auth-middleware.js', () => ({ requireAuth: vi.fn() }));

import handler from './refresh.js';
import { serviceClient } from '../../_lib/supabase.js';
import { requireAuth } from '../../_lib/auth-middleware.js';
import { createRes } from '../../_lib/test-helpers.js';

const USER = { userId: 'uid-1', email: 'a@b.com' };
const req = (method = 'POST') => ({ method, headers: { authorization: 'Bearer t' } });
const counters = (correct) => ({ byLevel: { a1: { correct, almost: 0, wrong: 0 } }, bonusXp: 0 });

afterEach(() => vi.clearAllMocks());

it('returns 405 for non-POST', async () => {
  const res = createRes();
  await handler(req('GET'), res);
  expect(res.statusCode).toBe(405);
});

it('computes weekly xp from stats and updates only the caller row', async () => {
  requireAuth.mockResolvedValue(USER);
  const statsChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockResolvedValue({
      data: [{ day: '2026-06-23', counters: counters(2) }], // 20 xp
      error: null,
    }),
  };
  const updateEq2 = vi.fn().mockResolvedValue({ error: null });
  const updateEq1 = vi.fn(() => ({ eq: updateEq2 }));
  const membersChain = { update: vi.fn(() => ({ eq: updateEq1 })) };
  serviceClient.mockReturnValue({
    from: vi.fn((table) => (table === 'stats_daily' ? statsChain : membersChain)),
  });

  const res = createRes();
  await handler(req(), res);
  expect(res.statusCode).toBe(200);
  expect(res.body.weekly_xp).toBe(20);
  // update scoped to caller user_id
  expect(updateEq1).toHaveBeenCalledWith('user_id', 'uid-1');
});
