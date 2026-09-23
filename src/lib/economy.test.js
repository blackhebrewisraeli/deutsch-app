import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./auth.js', () => ({ getSupabase: vi.fn() }));

import { getSupabase } from './auth.js';
import { awardTokens, spendTokens, fetchMyTokens, questRewardKey } from './economy.js';

function tokensQuery(result) {
  const q = {
    select: vi.fn(() => q),
    eq: vi.fn(() => q),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  return q;
}

describe('economy', () => {
  beforeEach(() => vi.clearAllMocks());

  it('awards by REASON only — the client never sends an amount', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 5010, error: null });
    getSupabase.mockResolvedValue({ rpc });
    await expect(awardTokens('daily_quest', questRewardKey('2026-09-23', 'q1'))).resolves.toBe(
      5010
    );
    expect(rpc).toHaveBeenCalledWith('award_tokens', {
      p_reason: 'daily_quest',
      p_key: '2026-09-23:q1',
    });
  });

  it('rejects when the RPC errors, so the caller can reconcile', async () => {
    const error = { code: 'P0001', message: 'insufficient tokens' };
    getSupabase.mockResolvedValue({ rpc: vi.fn().mockResolvedValue({ data: null, error }) });
    await expect(spendTokens(10, 'test', 'k')).rejects.toBe(error);
  });

  it('reads the balance from its own query', async () => {
    const q = tokensQuery({ data: { tokens: 5000 }, error: null });
    getSupabase.mockResolvedValue({ from: vi.fn(() => q) });
    await expect(fetchMyTokens('u1')).resolves.toBe(5000);
    expect(q.select).toHaveBeenCalledWith('tokens');
  });

  // The deploy/migration window: main ships on merge, the column lands when
  // the owner applies the migration. The read must degrade to "unknown".
  it('returns null — not a throw — when the column does not exist yet', async () => {
    const q = tokensQuery({
      data: null,
      error: { code: '42703', message: 'column does not exist' },
    });
    getSupabase.mockResolvedValue({ from: vi.fn(() => q) });
    await expect(fetchMyTokens('u1')).resolves.toBeNull();
  });

  it('returns null signed out or without a backend', async () => {
    await expect(fetchMyTokens(null)).resolves.toBeNull();
    getSupabase.mockResolvedValue(null);
    await expect(fetchMyTokens('u1')).resolves.toBeNull();
  });
});
