import { it, expect, vi, afterEach } from 'vitest';

vi.mock('../../_lib/supabase.js', () => ({ serviceClient: vi.fn() }));
vi.mock('../../_lib/auth-middleware.js', () => ({ requireAuth: vi.fn() }));

import handler from './join.js';
import { serviceClient } from '../../_lib/supabase.js';
import { requireAuth } from '../../_lib/auth-middleware.js';
import { createRes } from '../../_lib/test-helpers.js';
import { currentPeriodStart } from '../../_lib/leagueLogic.js';

// Placement itself (tier derivation, cohort filling, the concurrency lock) is
// SQL and is exercised against a real Postgres in
// supabase/tests/rls/league-bucket.test.js. This file covers the HTTP shell.

const USER = { userId: 'uid-1', email: 'a@b.com' };
const req = (method = 'POST') => ({ method, headers: { authorization: 'Bearer t' } });
const MEMBERSHIP = { league_id: 'L1', tier: 1, period_start: '2026-09-21', handle: 'learner_1' };

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

it('places the authenticated user for the current week and returns the membership', async () => {
  requireAuth.mockResolvedValue(USER);
  const rpc = vi.fn().mockResolvedValue({ data: MEMBERSHIP, error: null });
  serviceClient.mockReturnValue({ rpc });

  const res = createRes();
  await handler(req(), res);

  // The user id comes from the token, never the body; the period from the
  // shared league-week definition.
  expect(rpc).toHaveBeenCalledWith('assign_user_to_bucket', {
    p_user_id: 'uid-1',
    p_period: currentPeriodStart(),
  });
  expect(res.statusCode).toBe(200);
  expect(res.body).toEqual(MEMBERSHIP);
});

it('returns 500 when the placement RPC fails', async () => {
  requireAuth.mockResolvedValue(USER);
  serviceClient.mockReturnValue({
    rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } }),
  });
  const res = createRes();
  await handler(req(), res);
  expect(res.statusCode).toBe(500);
});
