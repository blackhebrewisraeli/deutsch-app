import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('./storage.js', () => ({ loadState: vi.fn(), saveState: vi.fn() }));
vi.mock('./stats.js', () => ({ todayKey: () => '2026-06-29' }));
vi.mock('./auth.js', () => ({ getSupabase: vi.fn(() => ({})) }));
vi.mock('./leagues.js', () => ({ LEAGUES_ENABLED: true, fetchMyResults: vi.fn() }));

import { useLeagueRewards } from './useLeagueRewards.js';
import { loadState, saveState } from './storage.js';
import { fetchMyResults } from './leagues.js';

beforeEach(() => {
  loadState.mockReturnValue({});
});
afterEach(() => vi.clearAllMocks());

describe('useLeagueRewards', () => {
  it('does nothing when userId is absent', async () => {
    fetchMyResults.mockResolvedValue([]);
    renderHook(() => useLeagueRewards(null));
    expect(fetchMyResults).not.toHaveBeenCalled();
    expect(saveState).not.toHaveBeenCalled();
  });

  it('claims a winner result and saves state with leagueWins incremented', async () => {
    fetchMyResults.mockResolvedValue([{ league_id: 'L1', rank: 1, result: 'promoted' }]);
    renderHook(() => useLeagueRewards('me'));
    await waitFor(() => expect(saveState).toHaveBeenCalled());
    const saved = saveState.mock.calls[0][0];
    expect(saved.stats.leagueWins).toBe(1);
    expect(saved.gamification.leagueClaimed).toContain('L1');
  });

  it('does not save when there is nothing to claim', async () => {
    fetchMyResults.mockResolvedValue([{ league_id: 'L1', rank: 4, result: 'held' }]);
    renderHook(() => useLeagueRewards('me'));
    await waitFor(() => expect(fetchMyResults).toHaveBeenCalled());
    expect(saveState).not.toHaveBeenCalled();
  });

  it('swallows fetch errors without throwing', async () => {
    fetchMyResults.mockRejectedValue(new Error('network'));
    renderHook(() => useLeagueRewards('me'));
    await waitFor(() => expect(fetchMyResults).toHaveBeenCalled());
    expect(saveState).not.toHaveBeenCalled();
  });
});
