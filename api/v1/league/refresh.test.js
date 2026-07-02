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
// Seed the stats row for "today" so it is always >= the current league period
// (currentPeriodStart = this week's Monday). A hardcoded date silently falls out
// of the period as the weeks roll by and makes weeklyXpFromRows sum to 0.
const TODAY = new Date().toISOString().slice(0, 10);

afterEach(() => vi.clearAllMocks());

it('returns 405 for non-POST', async () => {
  const res = createRes();
  await handler(req('GET'), res);
  expect(res.statusCode).toBe(405);
});

it('computes weekly xp from stats and updates only the current-period league row', async () => {
  requireAuth.mockResolvedValue(USER);

  const statsChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockResolvedValue({
      data: [{ day: TODAY, counters: counters(2) }], // 20 xp
      error: null,
    }),
  };

  // membership lookup chain: select().eq().eq().maybeSingle()
  const membershipMaybeSingle = vi.fn().mockResolvedValue({
    data: { league_id: 'L1' },
    error: null,
  });
  const membershipEq2 = vi.fn(() => ({ maybeSingle: membershipMaybeSingle }));
  const membershipEq1 = vi.fn(() => ({ eq: membershipEq2 }));
  const membershipSelect = vi.fn(() => ({ eq: membershipEq1 }));

  // update chain: update().eq().eq()
  const updateEq2 = vi.fn().mockResolvedValue({ error: null });
  const updateEq1 = vi.fn(() => ({ eq: updateEq2 }));
  const membersUpdate = vi.fn(() => ({ eq: updateEq1 }));

  // league_members from() must handle both select (membership lookup) and update calls
  let memberSelectCallCount = 0;
  const membersChain = {
    select: (...args) => {
      memberSelectCallCount++;
      return { eq: membershipEq1 };
    },
    update: membersUpdate,
  };

  serviceClient.mockReturnValue({
    from: vi.fn((table) => (table === 'stats_daily' ? statsChain : membersChain)),
  });

  const res = createRes();
  await handler(req(), res);
  expect(res.statusCode).toBe(200);
  expect(res.body.weekly_xp).toBe(20);

  // stats_daily read was filtered to the period
  expect(statsChain.gte).toHaveBeenCalledWith('day', expect.any(String));

  // update scoped to both user_id and league_id
  expect(updateEq1).toHaveBeenCalledWith('user_id', 'uid-1');
  expect(updateEq2).toHaveBeenCalledWith('league_id', 'L1');
});

it('returns weekly_xp without updating when user has no current-period membership', async () => {
  requireAuth.mockResolvedValue(USER);

  const statsChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockResolvedValue({
      data: [{ day: TODAY, counters: counters(2) }],
      error: null,
    }),
  };

  const membershipMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const membershipEq2 = vi.fn(() => ({ maybeSingle: membershipMaybeSingle }));
  const membershipEq1 = vi.fn(() => ({ eq: membershipEq2 }));
  const membersUpdate = vi.fn();
  const membersChain = {
    select: vi.fn(() => ({ eq: membershipEq1 })),
    update: membersUpdate,
  };

  serviceClient.mockReturnValue({
    from: vi.fn((table) => (table === 'stats_daily' ? statsChain : membersChain)),
  });

  const res = createRes();
  await handler(req(), res);
  expect(res.statusCode).toBe(200);
  expect(res.body.weekly_xp).toBe(20);
  // no update should have been called
  expect(membersUpdate).not.toHaveBeenCalled();
});
