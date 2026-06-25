import { describe, it, expect } from 'vitest';
import { qualifies, currentStreak, bestStreakFromHistory } from './streak';

// 5 correct = 50 XP; 4 correct = 40 XP
const day = (correct) => ({ byLevel: { a1: { correct, almost: 0, wrong: 0 } } });
const qual = { byLevel: { a1: { correct: 5, almost: 0, wrong: 0 } } }; // 50 XP
const miss = { byLevel: { a1: { correct: 0, almost: 0, wrong: 0 } } }; // 0 XP

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
