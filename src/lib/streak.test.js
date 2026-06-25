import { describe, it, expect } from 'vitest';
import {
  qualifies,
  currentStreak,
  bestStreakFromHistory,
  crossedMilestone,
  simulateFreezes,
  reconcile,
  freezesAvailable,
} from './streak';

// 5 correct = 50 XP; 4 correct = 40 XP
const day = (correct) => ({ byLevel: { a1: { correct, almost: 0, wrong: 0 } } });
const qual = { byLevel: { a1: { correct: 5, almost: 0, wrong: 0 } } }; // 50 XP
const miss = { byLevel: { a1: { correct: 0, almost: 0, wrong: 0 } } }; // 0 XP
const days = (...keys) => Object.fromEntries(keys.map((k) => [k, qual]));
const week = () =>
  days(
    '2026-06-01',
    '2026-06-02',
    '2026-06-03',
    '2026-06-04',
    '2026-06-05',
    '2026-06-06',
    '2026-06-07'
  );

describe('qualifies', () => {
  it('is true when the day reaches the goal XP', () => {
    expect(qualifies(day(5), 50)).toBe(true);
  });
  it('is false below the goal', () => {
    expect(qualifies(day(4), 50)).toBe(false);
  });
  it('is false for a missing day', () => {
    expect(qualifies(undefined, 50)).toBe(false);
  });
});

describe('currentStreak', () => {
  it('counts consecutive qualifying days ending today', () => {
    const d = { '2026-06-08': qual, '2026-06-09': qual, '2026-06-10': qual };
    expect(currentStreak(d, 50, '2026-06-10')).toBe(3);
  });
  it("keeps the prior run alive while today hasn't qualified yet", () => {
    const d = { '2026-06-08': qual, '2026-06-09': qual, '2026-06-10': miss };
    expect(currentStreak(d, 50, '2026-06-10')).toBe(2);
  });
  it('breaks at a gap', () => {
    const d = { '2026-06-07': qual, '2026-06-09': qual, '2026-06-10': qual }; // 06-08 missing
    expect(currentStreak(d, 50, '2026-06-10')).toBe(2);
  });
  it('is 0 when neither today nor yesterday qualifies', () => {
    expect(currentStreak({ '2026-06-08': qual }, 50, '2026-06-10')).toBe(0);
  });
});

describe('bestStreakFromHistory', () => {
  it('finds the longest qualifying run', () => {
    const d = {
      '2026-06-01': qual,
      '2026-06-02': qual,
      '2026-06-03': qual, // run of 3
      '2026-06-05': qual,
      '2026-06-06': qual, // run of 2
    };
    expect(bestStreakFromHistory(d, 50)).toBe(3);
  });
  it('is 0 with no qualifying days', () => {
    expect(bestStreakFromHistory({ '2026-06-01': miss }, 50)).toBe(0);
  });
});

describe('crossedMilestone', () => {
  it('returns the milestone just reached', () => {
    expect(crossedMilestone(2, 3)).toBe(3);
    expect(crossedMilestone(6, 7)).toBe(7);
  });
  it('returns null when no milestone is crossed', () => {
    expect(crossedMilestone(3, 4)).toBeNull();
    expect(crossedMilestone(7, 7)).toBeNull();
  });
  it('returns the highest milestone when several are crossed at once', () => {
    expect(crossedMilestone(1, 8)).toBe(7);
  });
});

describe('freeze bridging', () => {
  it('currentStreak bridges a missed day that was frozen', () => {
    const d = { '2026-06-08': qual, '2026-06-09': miss, '2026-06-10': qual };
    expect(currentStreak(d, 50, '2026-06-10')).toBe(1);
    expect(currentStreak(d, 50, '2026-06-10', { '2026-06-09': true })).toBe(3);
  });
  it('bestStreakFromHistory bridges frozen days', () => {
    const d = { '2026-06-01': qual, '2026-06-02': miss, '2026-06-03': qual };
    expect(bestStreakFromHistory(d, 50, { '2026-06-02': true })).toBe(3);
  });
});

describe('simulateFreezes', () => {
  it('earns one freeze after a 7-day run', () => {
    const r = simulateFreezes(week(), 50, '2026-06-08');
    expect(r.freezes).toBe(1);
    expect(r.frozenDays).toEqual({});
  });
  it('spends a freeze to bridge a single missed day', () => {
    const r = simulateFreezes(week(), 50, '2026-06-09'); // 06-08 is a miss
    expect(r.frozenDays).toEqual({ '2026-06-08': true });
    expect(r.freezes).toBe(0);
  });
  it('breaks the run when a miss has no freeze to spend', () => {
    const r = simulateFreezes(days('2026-06-01', '2026-06-02'), 50, '2026-06-05');
    expect(r.frozenDays).toEqual({});
    expect(r.freezes).toBe(0);
  });
});

describe('reconcile + freezesAvailable', () => {
  it('reconcile produces frozenDays + bestStreak + lastReconcileDay', () => {
    const state = {
      daily: week(),
      gamification: { goal: 50, frozenDays: {}, bestStreak: 0, lastReconcileDay: '2026-06-07' },
    };
    const r = reconcile(state, '2026-06-09');
    expect(r.frozenDays).toEqual({ '2026-06-08': true });
    expect(r.lastReconcileDay).toBe('2026-06-09');
    expect(r.bestStreak).toBeGreaterThanOrEqual(7);
  });
  it('freezesAvailable reflects the earned balance', () => {
    const state = { daily: week(), gamification: { goal: 50 } };
    expect(freezesAvailable(state, '2026-06-08')).toBe(1);
  });
});
