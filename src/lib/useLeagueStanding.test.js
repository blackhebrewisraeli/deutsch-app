import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Only auth is mocked. leagues.js runs FOR REAL so that "Home issues no writes"
// is an assertion about the actual query code rather than about a stub: if
// someone reintroduces joinLeague()/refreshLeague() here, the real post() runs
// and the fetch spy catches it. Mocking leagues.js wholesale would make that
// test incapable of failing.
const getSupabase = vi.fn();
vi.mock('./auth.js', () => ({
  getSupabase: (...a) => getSupabase(...a),
  getAccessToken: vi.fn().mockResolvedValue('tok'),
}));

// A cohort ordered by weekly_xp desc, which is how fetchStandings returns rows.
const cohort = (size, meAt) =>
  Array.from({ length: size }, (_, i) => ({
    user_id: i + 1 === meAt ? 'me' : `u${i + 1}`,
    handle: `H${i + 1}`,
    weekly_xp: (size - i) * 10,
    rank: null, // null during the live week — the whole reason rank is derived
  }));

function fakeSupabase({ membership = null, standings = [], failOn = null } = {}) {
  const seen = { tables: [], selects: [], filters: [] };
  const from = vi.fn((table) => {
    seen.tables.push(table);
    const chain = {
      select: vi.fn((cols) => {
        seen.selects.push(cols);
        return chain;
      }),
      eq: vi.fn((col, val) => {
        seen.filters.push([col, val]);
        return chain;
      }),
      maybeSingle: vi.fn(async () =>
        failOn === 'membership'
          ? { data: null, error: new Error('membership read failed') }
          : { data: membership, error: null }
      ),
      order: vi.fn(async () =>
        failOn === 'standings'
          ? { data: null, error: new Error('standings read failed') }
          : { data: standings, error: null }
      ),
    };
    return chain;
  });
  return { client: { from }, seen };
}

async function loadHook({ enabled = true } = {}) {
  vi.resetModules();
  vi.stubEnv('VITE_LEAGUES_ENABLED', enabled ? 'true' : 'false');
  return (await import('./useLeagueStanding.js')).useLeagueStanding;
}

let fetchSpy;
beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('no network in this test'));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('useLeagueStanding', () => {
  it('reports the demotion zone for a last-place member of a full cohort', async () => {
    // 25 members → zoneCounts gives demote 5 → ranks 21..25 are at risk.
    const { client } = fakeSupabase({
      membership: { league_id: 'L1', weekly_xp: 10 },
      standings: cohort(25, 25),
    });
    getSupabase.mockResolvedValue(client);

    const useLeagueStanding = await loadHook();
    const { result } = renderHook(() => useLeagueStanding('me'));

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toEqual({ rank: 25, cohortSize: 25, inDemotionZone: true });
  });

  it('does not report the demotion zone for a mid-table member', async () => {
    const { client } = fakeSupabase({
      membership: { league_id: 'L1', weekly_xp: 160 },
      standings: cohort(25, 10),
    });
    getSupabase.mockResolvedValue(client);

    const useLeagueStanding = await loadHook();
    const { result } = renderHook(() => useLeagueStanding('me'));

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toEqual({ rank: 10, cohortSize: 25, inDemotionZone: false });
  });

  it('treats the first at-risk rank as in the zone and the one above it as safe', async () => {
    for (const [rank, expected] of [
      [20, false],
      [21, true],
    ]) {
      const { client } = fakeSupabase({
        membership: { league_id: 'L1', weekly_xp: 1 },
        standings: cohort(25, rank),
      });
      getSupabase.mockResolvedValue(client);
      const useLeagueStanding = await loadHook();
      const { result } = renderHook(() => useLeagueStanding('me'));
      await waitFor(() => expect(result.current).not.toBeNull());
      expect(result.current.inDemotionZone).toBe(expected);
    }
  });

  it('never reports a zone when the cohort is too small to demote anyone', async () => {
    // zoneCounts clamps demote to 0 for a cohort of 1, so last place is not "at risk".
    const { client } = fakeSupabase({
      membership: { league_id: 'L1', weekly_xp: 10 },
      standings: cohort(1, 1),
    });
    getSupabase.mockResolvedValue(client);

    const useLeagueStanding = await loadHook();
    const { result } = renderHook(() => useLeagueStanding('me'));

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toEqual({ rank: 1, cohortSize: 1, inDemotionZone: false });
  });

  it('returns null when there is no membership for the current period', async () => {
    const { client } = fakeSupabase({ membership: null });
    getSupabase.mockResolvedValue(client);

    const useLeagueStanding = await loadHook();
    const { result } = renderHook(() => useLeagueStanding('me'));

    await waitFor(() => expect(getSupabase).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it('returns null when the caller is missing from their own cohort rows', async () => {
    const { client } = fakeSupabase({
      membership: { league_id: 'L1', weekly_xp: 10 },
      standings: cohort(5, 0), // nobody is 'me'
    });
    getSupabase.mockResolvedValue(client);

    const useLeagueStanding = await loadHook();
    const { result } = renderHook(() => useLeagueStanding('me'));

    await waitFor(() => expect(getSupabase).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it.each([['membership'], ['standings']])(
    'returns null when the %s read fails',
    async (failOn) => {
      const { client } = fakeSupabase({
        membership: { league_id: 'L1', weekly_xp: 10 },
        standings: cohort(25, 25),
        failOn,
      });
      getSupabase.mockResolvedValue(client);

      const useLeagueStanding = await loadHook();
      const { result } = renderHook(() => useLeagueStanding('me'));

      await waitFor(() => expect(getSupabase).toHaveBeenCalled());
      expect(result.current).toBeNull();
    }
  );

  it('returns null and touches nothing when userId is absent', async () => {
    const useLeagueStanding = await loadHook();
    const { result } = renderHook(() => useLeagueStanding(undefined));

    expect(result.current).toBeNull();
    expect(getSupabase).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns null without touching the network when leagues are disabled', async () => {
    const { client } = fakeSupabase({
      membership: { league_id: 'L1', weekly_xp: 10 },
      standings: cohort(25, 25),
    });
    getSupabase.mockResolvedValue(client);

    const useLeagueStanding = await loadHook({ enabled: false });
    const { result } = renderHook(() => useLeagueStanding('me'));

    expect(result.current).toBeNull();
    expect(getSupabase).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('issues NO writes — no join, no refresh, no POST of any kind', async () => {
    // §2.4 of the design: Home is the landing tab and the leaderboard's fetch
    // path does two writes on mount. This is the assertion most likely to be
    // quietly broken later by someone reusing joinLeague()/refreshLeague().
    const { client, seen } = fakeSupabase({
      membership: { league_id: 'L1', weekly_xp: 10 },
      standings: cohort(25, 25),
    });
    getSupabase.mockResolvedValue(client);

    const useLeagueStanding = await loadHook();
    const { result } = renderHook(() => useLeagueStanding('me'));
    await waitFor(() => expect(result.current).not.toBeNull());

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(seen.tables).toEqual(['league_members', 'league_members']);
  });

  it('reads only the caller row for the current league week, then the cohort', async () => {
    const { client, seen } = fakeSupabase({
      membership: { league_id: 'L1', weekly_xp: 10 },
      standings: cohort(25, 25),
    });
    getSupabase.mockResolvedValue(client);

    const useLeagueStanding = await loadHook();
    const { result } = renderHook(() => useLeagueStanding('me'));
    await waitFor(() => expect(result.current).not.toBeNull());

    expect(seen.selects[0]).toBe('league_id, weekly_xp');
    expect(seen.filters[0]).toEqual(['user_id', 'me']);
    // period_start is a Monday (UTC) in YYYY-MM-DD — the current league week.
    const [col, period] = seen.filters[1];
    expect(col).toBe('period_start');
    expect(period).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(`${period}T00:00:00Z`).getUTCDay()).toBe(1);
    expect(seen.filters[2]).toEqual(['league_id', 'L1']);
  });

  it('does not set state after unmount', async () => {
    const { client } = fakeSupabase({
      membership: { league_id: 'L1', weekly_xp: 10 },
      standings: cohort(25, 25),
    });
    getSupabase.mockResolvedValue(client);

    const useLeagueStanding = await loadHook();
    const { result, unmount } = renderHook(() => useLeagueStanding('me'));
    unmount();
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current).toBeNull();
  });
});
