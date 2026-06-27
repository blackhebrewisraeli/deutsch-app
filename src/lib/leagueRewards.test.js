import { describe, it, expect } from 'vitest';
import { claimWinnerRewards, WINNER_BONUS_XP } from './leagueRewards.js';

const TODAY = '2026-06-27';

describe('claimWinnerRewards', () => {
  it('adds WINNER_BONUS_XP to daily bonusXp and sets leagueWins=1 for a rank-1 result', () => {
    const { state, claimedCount } = claimWinnerRewards(
      {},
      [{ league_id: 'L1', rank: 1, result: 'promoted' }],
      TODAY
    );
    expect(claimedCount).toBe(1);
    expect(state.daily[TODAY].bonusXp).toBe(WINNER_BONUS_XP);
    expect(state.stats.leagueWins).toBe(1);
    expect(state.gamification.leagueClaimed).toContain('L1');
  });

  it('is idempotent — second call with same league_id yields claimedCount:0 and no extra XP', () => {
    const { state: first } = claimWinnerRewards(
      {},
      [{ league_id: 'L1', rank: 1, result: 'promoted' }],
      TODAY
    );
    const { state: second, claimedCount } = claimWinnerRewards(
      first,
      [{ league_id: 'L1', rank: 1, result: 'promoted' }],
      TODAY
    );
    expect(claimedCount).toBe(0);
    expect(second.daily[TODAY].bonusXp).toBe(WINNER_BONUS_XP);
    expect(second.stats.leagueWins).toBe(1);
  });

  it('ignores non-winner results (rank:2, rank>1)', () => {
    const { state, claimedCount } = claimWinnerRewards(
      {},
      [
        { league_id: 'L2', rank: 2, result: 'held' },
        { league_id: 'L3', rank: 5, result: 'relegated' },
      ],
      TODAY
    );
    expect(claimedCount).toBe(0);
    expect(state.daily).toBeUndefined();
    expect(state.stats).toBeUndefined();
  });

  it('adds 2 * WINNER_BONUS_XP and leagueWins:2 for two unclaimed rank-1 results', () => {
    const { state, claimedCount } = claimWinnerRewards(
      {},
      [
        { league_id: 'L1', rank: 1, result: 'promoted' },
        { league_id: 'L2', rank: 1, result: 'promoted' },
      ],
      TODAY
    );
    expect(claimedCount).toBe(2);
    expect(state.daily[TODAY].bonusXp).toBe(2 * WINNER_BONUS_XP);
    expect(state.stats.leagueWins).toBe(2);
  });

  it('preserves existing daily[today] fields (byLevel, total)', () => {
    const existing = {
      daily: {
        [TODAY]: { total: 10, bonusXp: 5, byTab: { chat: 3 }, byLevel: { a1: { correct: 2 } } },
      },
    };
    const { state } = claimWinnerRewards(
      existing,
      [{ league_id: 'L1', rank: 1, result: 'promoted' }],
      TODAY
    );
    expect(state.daily[TODAY].total).toBe(10);
    expect(state.daily[TODAY].byTab).toEqual({ chat: 3 });
    expect(state.daily[TODAY].byLevel).toEqual({ a1: { correct: 2 } });
    expect(state.daily[TODAY].bonusXp).toBe(5 + WINNER_BONUS_XP);
  });
});
