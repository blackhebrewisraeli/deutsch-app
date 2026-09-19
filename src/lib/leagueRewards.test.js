import { describe, it, expect } from 'vitest';
import { claimWinnerRewards, WINNER_BONUS_XP } from './leagueRewards.js';
import { settingsToRow, settingsFromRow } from './sync/adapters.js';
import { mergeSettings } from './sync/merge.js';

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

// The bug this suite exists for: every load re-awarded WINNER_BONUS_XP for
// leagues already won, because the claim set never survived a reconcile.
// These drive the REAL adapter + merge, not a stand-in — the defect lived in
// the seam between them, so a fixture that mocked either could not fail.
describe('claimWinnerRewards survives a sync round-trip', () => {
  const RESULTS = [
    { league_id: 'L1', rank: 1, result: 'promoted' },
    { league_id: 'L2', rank: 1, result: 'promoted' },
  ];

  // Everything the reconcile does to the claim set: push the local blob, pull
  // the server's, merge, and adopt the merged gamification — exactly as
  // pullAndMerge writes it back (`gamification: adoptedSettings.gamification`).
  const reconcile = (local, serverData, { serverUpdatedAt }) => {
    const remote = settingsFromRow({ data: { ...serverData, settingsUpdatedAt: serverUpdatedAt } });
    const merged = mergeSettings(
      {
        gamification: local.gamification,
        learnedWords: local.learnedWords,
        settingsUpdatedAt: local.settingsUpdatedAt,
      },
      remote
    );
    return { ...local, gamification: merged.gamification ?? local.gamification };
  };

  it('does not re-award when the server blob has never heard of the claim', () => {
    const { state: claimed } = claimWinnerRewards({ settingsUpdatedAt: 500 }, RESULTS, TODAY);
    expect(claimed.daily[TODAY].bonusXp).toBe(2 * WINNER_BONUS_XP);

    // The production shape: the server row is NEWER (another device wrote an
    // unrelated setting) and carries no claims at all. Whole-row LWW handed
    // that empty gamification straight back, which is what wiped the claim.
    const synced = reconcile(claimed, { goal: 30 }, { serverUpdatedAt: 900 });
    expect(synced.gamification.leagueClaimed).toEqual(['L1', 'L2']);

    const { state: after, claimedCount } = claimWinnerRewards(synced, RESULTS, TODAY);
    expect(claimedCount).toBe(0);
    expect(after.daily[TODAY].bonusXp).toBe(2 * WINNER_BONUS_XP); // NOT 4 ×
    expect(after.stats.leagueWins).toBe(2);
  });

  it('stays settled across repeated loads, not just the first one', () => {
    let state = { settingsUpdatedAt: 500 };
    let totalClaims = 0;
    for (let load = 0; load < 5; load += 1) {
      const res = claimWinnerRewards(state, RESULTS, TODAY);
      totalClaims += res.claimedCount;
      state = reconcile(res.state, { goal: 30 }, { serverUpdatedAt: 900 + load });
    }
    expect(totalClaims).toBe(2); // paid exactly once, on the first load
    expect(state.daily[TODAY].bonusXp).toBe(2 * WINNER_BONUS_XP);
  });

  it('the claim set the server gets back carries the ids', () => {
    const { state } = claimWinnerRewards({ settingsUpdatedAt: 500 }, RESULTS, TODAY);
    const row = settingsToRow(
      { gamification: state.gamification, learnedWords: {}, settingsUpdatedAt: 500 },
      'a1'
    );
    expect(row.data.leagueClaimed).toEqual(['L1', 'L2']);
  });
});

describe('claimWinnerRewards — leagueWins is derived, not incremented', () => {
  it('does not double-count when two devices each claim a different league', () => {
    // `stats` never syncs, so an incrementing counter could not converge: each
    // device would add its own claim on top of the merged set.
    const { state: deviceA } = claimWinnerRewards(
      {},
      [{ league_id: 'L1', rank: 1, result: 'promoted' }],
      TODAY
    );
    const { state: deviceB } = claimWinnerRewards(
      {},
      [{ league_id: 'L2', rank: 1, result: 'promoted' }],
      TODAY
    );
    const merged = mergeSettings(
      { settingsUpdatedAt: 200, gamification: deviceA.gamification },
      { settingsUpdatedAt: 100, gamification: deviceB.gamification }
    );
    // Asserted BEFORE the claim: without it this test passes on the broken
    // code, where the merge dropping L2 and the counter incrementing past it
    // are two defects that cancel out to the right number.
    expect(merged.gamification.leagueClaimed).toEqual(['L1', 'L2']);
    const { state: after } = claimWinnerRewards(
      { ...deviceA, gamification: merged.gamification },
      [
        { league_id: 'L1', rank: 1, result: 'promoted' },
        { league_id: 'L2', rank: 1, result: 'promoted' },
      ],
      TODAY
    );
    expect(after.gamification.leagueClaimed).toEqual(['L1', 'L2']);
    expect(after.stats.leagueWins).toBe(2); // not 3
  });

  it('repairs a counter inflated by the re-award bug, without paying XP again', () => {
    const inflated = {
      stats: { leagueWins: 47 },
      gamification: { leagueClaimed: ['L1'] },
      daily: { [TODAY]: { total: 0, bonusXp: WINNER_BONUS_XP, byTab: {}, byLevel: {} } },
    };
    const { state, claimedCount, changed } = claimWinnerRewards(
      inflated,
      [{ league_id: 'L1', rank: 1, result: 'promoted' }],
      TODAY
    );
    expect(claimedCount).toBe(0);
    expect(changed).toBe(true);
    expect(state.stats.leagueWins).toBe(1);
    expect(state.daily[TODAY].bonusXp).toBe(WINNER_BONUS_XP); // untouched
  });

  it('reports changed:false when there is genuinely nothing to do', () => {
    const settled = { stats: { leagueWins: 1 }, gamification: { leagueClaimed: ['L1'] } };
    const { claimedCount, changed } = claimWinnerRewards(
      settled,
      [{ league_id: 'L1', rank: 1, result: 'promoted' }],
      TODAY
    );
    expect(claimedCount).toBe(0);
    expect(changed).toBe(false);
  });

  it('pays a repeated league_id in one results array only once', () => {
    const { state, claimedCount } = claimWinnerRewards(
      {},
      [
        { league_id: 'L1', rank: 1, result: 'promoted' },
        { league_id: 'L1', rank: 1, result: 'promoted' },
      ],
      TODAY
    );
    expect(claimedCount).toBe(1);
    expect(state.daily[TODAY].bonusXp).toBe(WINNER_BONUS_XP);
    expect(state.stats.leagueWins).toBe(1);
  });
});
