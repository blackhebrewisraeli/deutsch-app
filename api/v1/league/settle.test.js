import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

vi.mock('../../_lib/supabase.js', () => ({ serviceClient: vi.fn() }));

import handler from './settle.js';
import { serviceClient } from '../../_lib/supabase.js';
import { createRes } from '../../_lib/test-helpers.js';

const req = (token = 'secret') => ({
  method: 'POST',
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
    { user_id: 'a', weekly_xp: 50, updated_at: 't1' },
    { user_id: 'b', weekly_xp: 10, updated_at: 't2' },
  ];
  const updateEq2 = vi.fn().mockResolvedValue({ error: null });
  const updates = [];
  const db = {
    from: vi.fn((table) => {
      if (table === 'leagues') {
        return {
          select: vi.fn().mockReturnThis(),
          lt: vi.fn().mockResolvedValue({ data: past, error: null }),
        };
      }
      // league_members
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ data: members, error: null }),
        update: vi.fn((vals) => ({
          eq: vi.fn().mockReturnThis(),
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
  // winner 'a' got rank 1
  const winner = updates.find((u) => u.m.user_id === 'a');
  expect(winner.vals.rank).toBe(1);
});
