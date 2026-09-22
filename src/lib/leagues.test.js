import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('./auth.js', () => ({ getAccessToken: vi.fn().mockResolvedValue('tok') }));

import { joinLeague, TIER_NAMES, tierName, fetchMyResults, fetchMyMembership } from './leagues.js';
import { TIER_NAMES as pureTierNames, tierName as pureTierName } from './leagueTier.js';

afterEach(() => vi.clearAllMocks());

describe('TIER_NAMES', () => {
  it('has five tiers Bronze..Ruby', () => {
    expect(TIER_NAMES).toEqual(['Bronze', 'Silver', 'Gold', 'Sapphire', 'Ruby']);
  });

  it('re-exports the pure module rather than redefining it', () => {
    // A second copy here would be a second definition, free to drift from the
    // one components render. Identity, not equality: two arrays with the same
    // contents is exactly the failure this is meant to catch.
    expect(TIER_NAMES).toBe(pureTierNames);
    expect(tierName).toBe(pureTierName);
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

describe('fetchMyResults', () => {
  it('queries league_members filtered by user_id and non-null result', async () => {
    const rows = [{ league_id: 'L1', rank: 1, result: 'promoted' }];
    const notMock = vi.fn().mockResolvedValue({ data: rows, error: null });
    const eqMock = vi.fn().mockReturnValue({ not: notMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });
    const supabase = { from: fromMock };

    const result = await fetchMyResults(supabase, 'me');

    expect(fromMock).toHaveBeenCalledWith('league_members');
    expect(selectMock).toHaveBeenCalledWith('league_id, rank, result');
    expect(eqMock).toHaveBeenCalledWith('user_id', 'me');
    expect(notMock).toHaveBeenCalledWith('result', 'is', null);
    expect(result).toEqual(rows);
  });

  it('throws when supabase returns an error', async () => {
    const notMock = vi.fn().mockResolvedValue({ data: null, error: new Error('db error') });
    const eqMock = vi.fn().mockReturnValue({ not: notMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });
    const supabase = { from: fromMock };

    await expect(fetchMyResults(supabase, 'me')).rejects.toThrow('db error');
  });
});

describe('fetchMyMembership', () => {
  const build = (row, error = null) => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: row, error });
    const eq2 = vi.fn().mockReturnValue({ maybeSingle });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const select = vi.fn().mockReturnValue({ eq: eq1 });
    const from = vi.fn().mockReturnValue({ select });
    return { supabase: { from }, from, select, eq1, eq2 };
  };

  it('reads one own row scoped to the given period, with its league tier', async () => {
    const row = { league_id: 'L1', weekly_xp: 120, leagues: { tier: 2 } };
    const { supabase, from, select, eq1, eq2 } = build(row);

    const out = await fetchMyMembership(supabase, 'me', '2026-06-22');

    expect(from).toHaveBeenCalledWith('league_members');
    // The tier is an embedded to-one on the SAME row, not a second round trip.
    // It is what Home's league badge renders; asking joinLeague instead would
    // make opening the landing tab a WRITE, which is what this function exists
    // to avoid.
    expect(select).toHaveBeenCalledWith('league_id, weekly_xp, leagues!inner(tier)');
    expect(eq1).toHaveBeenCalledWith('user_id', 'me');
    expect(eq2).toHaveBeenCalledWith('period_start', '2026-06-22');
    // FLATTENED: callers want a membership, not PostgREST's join shape.
    expect(out).toEqual({ league_id: 'L1', weekly_xp: 120, tier: 2 });
    expect(out.leagues).toBeUndefined();
  });

  it('reads a missing embedded league as Bronze rather than as undefined', async () => {
    // The `!inner` join should make this unreachable, but a membership whose
    // tier arrives as undefined would otherwise propagate into the badge as a
    // blank. Tier 0 is the floor, so it is the correct floor here too.
    const { supabase } = build({ league_id: 'L1', weekly_xp: 5 });
    await expect(fetchMyMembership(supabase, 'me', '2026-06-22')).resolves.toEqual({
      league_id: 'L1',
      weekly_xp: 5,
      tier: 0,
    });
  });

  it('returns null when the caller has no membership for the period', async () => {
    const { supabase } = build(null);
    await expect(fetchMyMembership(supabase, 'me', '2026-06-22')).resolves.toBeNull();
  });

  it('throws when supabase returns an error', async () => {
    const { supabase } = build(null, new Error('db error'));
    await expect(fetchMyMembership(supabase, 'me', '2026-06-22')).rejects.toThrow('db error');
  });
});
