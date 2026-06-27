import { describe, it, expect } from 'vitest';
import { weeklyXpFromRows } from './weeklyXp.js';

const counters = (correct) => ({
  total: correct,
  bonusXp: 0,
  byTab: {},
  byLevel: { a1: { correct, almost: 0, wrong: 0 } },
});

describe('weeklyXpFromRows', () => {
  it('sums xp for days on/after periodStart', () => {
    const rows = [
      { day: '2026-06-22', counters: counters(2) }, // in: 20
      { day: '2026-06-25', counters: counters(1) }, // in: 10
    ];
    expect(weeklyXpFromRows(rows, '2026-06-22')).toBe(30);
  });

  it('excludes days before periodStart', () => {
    const rows = [
      { day: '2026-06-21', counters: counters(5) }, // out
      { day: '2026-06-23', counters: counters(1) }, // in: 10
    ];
    expect(weeklyXpFromRows(rows, '2026-06-22')).toBe(10);
  });

  it('returns 0 for no rows', () => {
    expect(weeklyXpFromRows([], '2026-06-22')).toBe(0);
  });
});
