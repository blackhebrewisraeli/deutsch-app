import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../../_lib/supabase.js', () => ({ serviceClient: vi.fn() }));
vi.mock('../../_lib/auth-middleware.js', () => ({ requireAuth: vi.fn() }));

import handler, { longestStreak } from './profile.js';
import { serviceClient } from '../../_lib/supabase.js';
import { requireAuth } from '../../_lib/auth-middleware.js';
import { createRes } from '../../_lib/test-helpers.js';

const USER = { userId: 'me', email: 'a@b.com' };
const req = (userId) => ({
  method: 'GET',
  query: { userId },
  headers: { authorization: 'Bearer t' },
});

afterEach(() => vi.clearAllMocks());

describe('longestStreak', () => {
  it('finds the longest run of consecutive days', () => {
    expect(longestStreak(['2026-06-20', '2026-06-21', '2026-06-23'])).toBe(2);
    expect(longestStreak([])).toBe(0);
  });
});

it('rejects when requester shares no league with target (403)', async () => {
  requireAuth.mockResolvedValue(USER);
  const sharedRpc = vi.fn().mockResolvedValue({ data: false, error: null });
  serviceClient.mockReturnValue({ rpc: sharedRpc });
  const res = createRes();
  await handler(req('other'), res);
  expect(res.statusCode).toBe(403);
});

it('returns 400 when userId missing', async () => {
  requireAuth.mockResolvedValue(USER);
  serviceClient.mockReturnValue({ rpc: vi.fn() });
  const res = createRes();
  await handler(req(undefined), res);
  expect(res.statusCode).toBe(400);
});
