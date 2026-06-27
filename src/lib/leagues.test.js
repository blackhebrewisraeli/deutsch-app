import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('./auth.js', () => ({ getAccessToken: vi.fn().mockResolvedValue('tok') }));

import { joinLeague, TIER_NAMES } from './leagues.js';

afterEach(() => vi.clearAllMocks());

describe('TIER_NAMES', () => {
  it('has five tiers Bronze..Ruby', () => {
    expect(TIER_NAMES).toEqual(['Bronze', 'Silver', 'Gold', 'Sapphire', 'Ruby']);
  });
});

describe('joinLeague', () => {
  it('POSTs with the bearer token and returns json', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ league_id: 'L1', tier: 0, period_start: '2026-06-22', handle: 'X' }),
    });
    const out = await joinLeague();
    expect(out.league_id).toBe('L1');
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/league/join',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: 'Bearer tok' }),
      })
    );
  });

  it('throws on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    await expect(joinLeague()).rejects.toThrow();
  });
});
