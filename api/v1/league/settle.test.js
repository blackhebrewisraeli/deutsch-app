import { it, expect, vi, afterEach, beforeEach } from 'vitest';

vi.mock('../../_lib/supabase.js', () => ({ serviceClient: vi.fn() }));

import handler from './settle.js';
import { serviceClient } from '../../_lib/supabase.js';
import { createRes } from '../../_lib/test-helpers.js';

const req = (token = 'secret', method = 'POST') => ({
  method,
  headers: { authorization: `Bearer ${token}` },
});

beforeEach(() => {
  process.env.CRON_SECRET = 'secret';
});
afterEach(() => vi.clearAllMocks());

it('rejects without the cron secret (401)', async () => {
  serviceClient.mockReturnValue({});
  const res = createRes();
  await handler(req('wrong'), res);
  expect(res.statusCode).toBe(401);
});

it('settles past leagues and writes ranks/results', async () => {
  const past = [{ id: 'L1', period_start: '2026-06-15' }];
  const members = [
    { user_id: 'a', weekly_xp: 50, updated_at: 't1', rank: null },
    { user_id: 'b', weekly_xp: 10, updated_at: 't2', rank: null },
  ];
  const updates = [];
  const db = {
    from: vi.fn((table) => {
      if (table === 'leagues') {
        return {
          select: vi.fn().mockReturnThis(),
          lt: vi.fn().mockResolvedValue({ data: past, error: null }),
        };
      }
      // league_members: select(...).eq('league_id', id) resolves the full set
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: members, error: null }),
        update: vi.fn((vals) => ({
          match: vi.fn((m) => {
            updates.push({ vals, m });
            return Promise.resolve({ error: null });
          }),
        })),
      };
    }),
  };
  serviceClient.mockReturnValue(db);

  const res = createRes();
  await handler(req('secret'), res);
  expect(res.statusCode).toBe(200);
  expect(res.body.settled).toBe(1);
  expect(res.body.failed).toBe(0);
  // winner 'a' got rank 1
  const winner = updates.find((u) => u.m.user_id === 'a');
  expect(winner.vals.rank).toBe(1);
});

it('skips a league that is already fully settled (idempotent)', async () => {
  const past = [{ id: 'L1', period_start: '2026-06-15' }];
  const members = [
    { user_id: 'a', weekly_xp: 50, updated_at: 't1', rank: 1 },
    { user_id: 'b', weekly_xp: 10, updated_at: 't2', rank: 2 },
  ];
  const updateSpy = vi.fn();
  const db = {
    from: vi.fn((table) => {
      if (table === 'leagues') {
        return {
          select: vi.fn().mockReturnThis(),
          lt: vi.fn().mockResolvedValue({ data: past, error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: members, error: null }),
        update: updateSpy,
      };
    }),
  };
  serviceClient.mockReturnValue(db);

  const res = createRes();
  await handler(req('secret'), res);
  expect(res.statusCode).toBe(200);
  expect(res.body.settled).toBe(0);
  expect(updateSpy).not.toHaveBeenCalled();
});

it('isolates a failing league and still settles the others (200, failed counted)', async () => {
  const past = [
    { id: 'L_bad', period_start: '2026-06-15' },
    { id: 'L_ok', period_start: '2026-06-15' },
  ];
  const membersByLeague = {
    L_bad: [{ user_id: 'x', weekly_xp: 30, updated_at: 't1', rank: null }],
    L_ok: [{ user_id: 'y', weekly_xp: 20, updated_at: 't2', rank: null }],
  };
  const okUpdates = [];
  const db = {
    from: vi.fn((table) => {
      if (table === 'leagues') {
        return {
          select: vi.fn().mockReturnThis(),
          lt: vi.fn().mockResolvedValue({ data: past, error: null }),
        };
      }
      // league_members: resolve the member set for the scoped league_id
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn((_col, id) => Promise.resolve({ data: membersByLeague[id], error: null })),
        update: vi.fn(() => ({
          match: vi.fn((m) => {
            if (m.league_id === 'L_bad') {
              return Promise.resolve({ error: { message: 'DB write failed' } });
            }
            okUpdates.push(m);
            return Promise.resolve({ error: null });
          }),
        })),
      };
    }),
  };
  serviceClient.mockReturnValue(db);

  const res = createRes();
  await handler(req('secret'), res);
  expect(res.statusCode).toBe(200);
  expect(res.body.settled).toBe(1); // L_ok
  expect(res.body.failed).toBe(1); // L_bad
  expect(okUpdates.some((m) => m.user_id === 'y')).toBe(true);
});

// Vercel Cron triggers its path with a GET, not a POST. This endpoint opened
// with a POST-only guard that ran *before* the secret check, so every scheduled
// run since launch was answered with 405 and no league was ever settled — which
// also killed tier progression, because join.js derives the next tier from a
// settled `result` and filters `.not('result', 'is', null)`.
//
// The original suite could not catch it: its request helper hardcoded POST, so
// the test encoded the same wrong assumption as the code it was checking.
it('settles when Vercel Cron issues a GET', async () => {
  const past = [{ id: 'L1', period_start: '2026-06-15' }];
  const members = [
    { user_id: 'a', weekly_xp: 50, updated_at: 't1', rank: null },
    { user_id: 'b', weekly_xp: 10, updated_at: 't2', rank: null },
  ];
  const updates = [];
  const db = {
    from: vi.fn((table) => {
      if (table === 'leagues') {
        return {
          select: vi.fn().mockReturnThis(),
          lt: vi.fn().mockResolvedValue({ data: past, error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: members, error: null }),
        update: vi.fn((vals) => ({
          match: vi.fn((m) => {
            updates.push({ vals, m });
            return Promise.resolve({ error: null });
          }),
        })),
      };
    }),
  };
  serviceClient.mockReturnValue(db);

  const res = createRes();
  await handler(req('secret', 'GET'), res);
  expect(res.statusCode).toBe(200);
  expect(res.body.settled).toBe(1);
  expect(updates.find((u) => u.m.user_id === 'a').vals.rank).toBe(1);
});

// Accepting GET must not widen the security boundary: the secret is what
// protects this endpoint, and it is now the *only* thing protecting it.
it('rejects a GET without the cron secret (401)', async () => {
  serviceClient.mockReturnValue({});
  const res = createRes();
  await handler(req('wrong', 'GET'), res);
  expect(res.statusCode).toBe(401);
});

it('still rejects methods neither Vercel nor a manual run uses (405)', async () => {
  serviceClient.mockReturnValue({});
  const res = createRes();
  await handler(req('secret', 'DELETE'), res);
  expect(res.statusCode).toBe(405);
});
