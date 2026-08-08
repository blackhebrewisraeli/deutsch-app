import { describe, it, expect } from 'vitest';
import { trialStatus } from './trial';
import { TABS } from './stats';
import { TRIAL_ROUND_CAP, DEFAULT_GOAL } from './gameConfig';

// A day entry as stats.js writes it. Every container is optional so the table
// below can express the partial shapes sync/merge.js legitimately produces.
function mkDay({ total = 0, byTab, byLevel, bonusXp } = {}) {
  const d = { total };
  if (byTab) d.byTab = byTab;
  if (byLevel) d.byLevel = byLevel;
  if (bonusXp !== undefined) d.bonusXp = bonusXp;
  return d;
}

// XP_PER_VERDICT.correct is 10, so `correct: n` is 10n XP for the day.
const xp = (n) => ({ a1: { correct: n } });

const oneEach = { chat: 1, alphabet: 1, vocab: 1, translate: 1 };

describe('trialStatus', () => {
  const cases = [
    {
      name: 'undefined daily — nothing used, nothing sampled, not exhausted',
      daily: undefined,
      expected: { exhausted: false, roundsUsed: 0, tabsSampled: 0, goalCompleted: false },
    },
    {
      name: 'empty daily',
      daily: {},
      expected: { exhausted: false, roundsUsed: 0, tabsSampled: 0, goalCompleted: false },
    },
    {
      name: 'one tab only, under cap, no goal',
      daily: { '2026-08-01': mkDay({ total: 4, byTab: { chat: 4 }, byLevel: xp(1) }) },
      expected: { exhausted: false, roundsUsed: 4, tabsSampled: 1, goalCompleted: false },
    },
    {
      name: 'all four tabs but no goal met — not exhausted',
      daily: { '2026-08-01': mkDay({ total: 4, byTab: oneEach, byLevel: xp(1) }) },
      expected: { exhausted: false, roundsUsed: 4, tabsSampled: 4, goalCompleted: false },
    },
    {
      name: 'goal met but only three tabs — not exhausted',
      daily: {
        '2026-08-01': mkDay({
          total: 6,
          byTab: { chat: 2, alphabet: 2, vocab: 2 },
          byLevel: xp(5),
        }),
      },
      expected: { exhausted: false, roundsUsed: 6, tabsSampled: 3, goalCompleted: true },
    },
    {
      name: 'all four tabs and goal met — exhausted at the designed peak',
      daily: { '2026-08-01': mkDay({ total: 8, byTab: oneEach, byLevel: xp(5) }) },
      expected: { exhausted: true, roundsUsed: 8, tabsSampled: 4, goalCompleted: true },
    },
    {
      name: 'tab spread and goal split across separate days still peaks',
      daily: {
        '2026-08-01': mkDay({ total: 2, byTab: { chat: 1, alphabet: 1 } }),
        '2026-08-02': mkDay({ total: 2, byTab: { vocab: 1, translate: 1 } }),
        '2026-08-03': mkDay({ total: 5, byLevel: xp(5) }),
      },
      expected: { exhausted: true, roundsUsed: 9, tabsSampled: 4, goalCompleted: true },
    },
    {
      name: 'cap reached in a single tab with no goal — exhausted by the backstop',
      daily: {
        '2026-08-01': mkDay({ total: TRIAL_ROUND_CAP, byTab: { chat: TRIAL_ROUND_CAP } }),
      },
      expected: {
        exhausted: true,
        roundsUsed: TRIAL_ROUND_CAP,
        tabsSampled: 1,
        goalCompleted: false,
      },
    },
    {
      name: 'one round short of the cap is not exhausted',
      daily: {
        '2026-08-01': mkDay({ total: TRIAL_ROUND_CAP - 1, byTab: { chat: TRIAL_ROUND_CAP - 1 } }),
      },
      expected: {
        exhausted: false,
        roundsUsed: TRIAL_ROUND_CAP - 1,
        tabsSampled: 1,
        goalCompleted: false,
      },
    },
    {
      name: 'a day entry missing byTab counts its rounds but samples no tab',
      daily: { '2026-08-01': mkDay({ total: 7, byLevel: xp(1) }) },
      expected: { exhausted: false, roundsUsed: 7, tabsSampled: 0, goalCompleted: false },
    },
    {
      name: 'a day entry missing byLevel earns no XP toward the goal',
      daily: { '2026-08-01': mkDay({ total: 9, byTab: oneEach }) },
      expected: { exhausted: false, roundsUsed: 9, tabsSampled: 4, goalCompleted: false },
    },
    {
      name: 'a bare day entry with no containers at all degrades to zero',
      daily: { '2026-08-01': {} },
      expected: { exhausted: false, roundsUsed: 0, tabsSampled: 0, goalCompleted: false },
    },
    {
      name: 'a null day entry degrades to zero rather than throwing',
      daily: { '2026-08-01': null, '2026-08-02': mkDay({ total: 3, byTab: { vocab: 3 } }) },
      expected: { exhausted: false, roundsUsed: 3, tabsSampled: 1, goalCompleted: false },
    },
  ];

  for (const { name, daily, gamification, expected } of cases) {
    it(name, () => {
      expect(trialStatus(daily, gamification)).toEqual(expected);
    });
  }

  it('falls back to DEFAULT_GOAL when gamification is undefined', () => {
    // 5 correct = 50 XP = exactly DEFAULT_GOAL.
    const daily = { '2026-08-01': mkDay({ total: 5, byLevel: xp(5) }) };
    expect(DEFAULT_GOAL).toBe(50);
    expect(trialStatus(daily, undefined).goalCompleted).toBe(true);
    expect(trialStatus(daily, {}).goalCompleted).toBe(true);
  });

  it('respects a custom goal — 40 XP clears 20 but not 100', () => {
    const daily = { '2026-08-01': mkDay({ total: 4, byLevel: xp(4) }) };
    expect(trialStatus(daily, { goal: 20 }).goalCompleted).toBe(true);
    expect(trialStatus(daily, { goal: 100 }).goalCompleted).toBe(false);
  });

  it('a custom goal flips the designed peak with the tab spread unchanged', () => {
    const daily = { '2026-08-01': mkDay({ total: 4, byTab: oneEach, byLevel: xp(4) }) };
    expect(trialStatus(daily, { goal: 20 }).exhausted).toBe(true);
    expect(trialStatus(daily, { goal: 100 }).exhausted).toBe(false);
  });

  it('counts a tab as sampled from a single round across the whole log', () => {
    const daily = {};
    for (const [i, tab] of TABS.entries()) {
      daily[`2026-08-0${i + 1}`] = mkDay({ total: 1, byTab: { [tab]: 1 } });
    }
    expect(trialStatus(daily, {}).tabsSampled).toBe(TABS.length);
  });

  it('counts bonus XP toward the goal', () => {
    const daily = { '2026-08-01': mkDay({ total: 1, byLevel: xp(1), bonusXp: 40 }) };
    expect(trialStatus(daily, {}).goalCompleted).toBe(true);
  });
});
