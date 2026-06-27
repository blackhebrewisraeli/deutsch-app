import { describe, it, expect } from 'vitest';
import { xpForDay } from './xpCore.js';

const day = (over = {}) => ({
  total: 0,
  bonusXp: 0,
  byTab: {},
  byLevel: { a1: { correct: 0, almost: 0, wrong: 0 } },
  ...over,
});

describe('xpForDay', () => {
  it('returns 0 for empty/missing day', () => {
    expect(xpForDay(null)).toBe(0);
    expect(xpForDay(day())).toBe(0);
  });

  it('sums verdicts across levels with the balance constants', () => {
    const d = day({
      byLevel: {
        a1: { correct: 2, almost: 1, wrong: 1 }, // 20 + 6 + 3 = 29
        b1: { correct: 1, almost: 0, wrong: 0 }, // 10
      },
    });
    expect(xpForDay(d)).toBe(39);
  });

  it('adds bonusXp', () => {
    expect(xpForDay(day({ bonusXp: 5 }))).toBe(5);
  });
});
