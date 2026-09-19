import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('./storage.js', () => ({ loadState: vi.fn(), saveState: vi.fn() }));
vi.mock('./stats.js', () => ({ todayKey: () => '2026-06-29' }));
vi.mock('./auth.js', () => ({ getSupabase: vi.fn(() => ({})) }));
vi.mock('./leagues.js', () => ({ LEAGUES_ENABLED: true, fetchMyResults: vi.fn() }));
vi.mock('./settingsStamp.js', () => ({ stampSettings: vi.fn() }));
vi.mock('./sync.js', () => ({ markDirty: vi.fn() }));

import { useLeagueRewards } from './useLeagueRewards.js';
import { loadState, saveState } from './storage.js';
import { fetchMyResults } from './leagues.js';
import { stampSettings } from './settingsStamp.js';
import { markDirty } from './sync.js';

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

  // saveState alone kept the claim on this device only: the next reconcile
  // pulled a server blob that had never heard of it and the reward was paid
  // out again. Nothing else schedules the push — the claim credits bonusXp
  // directly instead of emitting the progress event App's markDirty listens for.
  it('stamps and schedules a push so the claim set reaches the server', async () => {
    fetchMyResults.mockResolvedValue([{ league_id: 'L1', rank: 1, result: 'promoted' }]);
    renderHook(() => useLeagueRewards('me'));
    await waitFor(() => expect(saveState).toHaveBeenCalled());
    expect(stampSettings).toHaveBeenCalled();
    expect(markDirty).toHaveBeenCalled();
  });

  it('saves a corrected leagueWins without stamping the shared settings clock', async () => {
    // claimedCount 0 but state changed: only the derived, local-only counter
    // moved. Stamping it would bump the LWW clock for a field the server never
    // sees, letting this device win over a peer's real settings edit.
    loadState.mockReturnValue({
      stats: { leagueWins: 9 },
      gamification: { leagueClaimed: ['L1'] },
    });
    fetchMyResults.mockResolvedValue([{ league_id: 'L1', rank: 1, result: 'promoted' }]);
    const onClaimed = vi.fn();
    renderHook(() => useLeagueRewards('me', onClaimed));
    await waitFor(() => expect(saveState).toHaveBeenCalled());
    expect(saveState.mock.calls[0][0].stats.leagueWins).toBe(1);
    expect(stampSettings).not.toHaveBeenCalled();
    expect(markDirty).not.toHaveBeenCalled();
    expect(onClaimed).not.toHaveBeenCalled();
  });

  it('does not re-award a league whose claim already round-tripped from the server', async () => {
    loadState.mockReturnValue({
      stats: { leagueWins: 1 },
      gamification: { leagueClaimed: ['L1'] },
    });
    fetchMyResults.mockResolvedValue([{ league_id: 'L1', rank: 1, result: 'promoted' }]);
    const onClaimed = vi.fn();
    renderHook(() => useLeagueRewards('me', onClaimed));
    await waitFor(() => expect(fetchMyResults).toHaveBeenCalled());
    expect(saveState).not.toHaveBeenCalled();
    expect(onClaimed).not.toHaveBeenCalled();
  });

  it('fires onClaimed with count and xp when a win is claimed', async () => {
    fetchMyResults.mockResolvedValue([{ league_id: 'L1', rank: 1, result: 'promoted' }]);
    const onClaimed = vi.fn();
    renderHook(() => useLeagueRewards('me', onClaimed));
    await waitFor(() => expect(onClaimed).toHaveBeenCalled());
    expect(onClaimed).toHaveBeenCalledWith(1, 50); // WINNER_BONUS_XP = 50
  });

  it('does not fire onClaimed when there is nothing to claim', async () => {
    fetchMyResults.mockResolvedValue([{ league_id: 'L1', rank: 4, result: 'held' }]);
    const onClaimed = vi.fn();
    renderHook(() => useLeagueRewards('me', onClaimed));
    await waitFor(() => expect(fetchMyResults).toHaveBeenCalled());
    expect(onClaimed).not.toHaveBeenCalled();
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
