import { describe, it, expect } from 'vitest';
import { currentPeriodStart, nextTier, settleLeague, zoneCounts, TIERS } from './leagueLogic.js';

describe('currentPeriodStart', () => {
  it('returns the Monday of the week (UTC)', () => {
    // 2026-06-27 is a Saturday → Monday is 2026-06-22
    expect(currentPeriodStart(new Date('2026-06-27T12:00:00Z'))).toBe('2026-06-22');
  });
  it('returns the same day when given a Monday', () => {
    expect(currentPeriodStart(new Date('2026-06-22T00:00:00Z'))).toBe('2026-06-22');
  });
});

describe('nextTier', () => {
  it('promotes and demotes within bounds', () => {
    expect(nextTier(0, 'promoted')).toBe(1);
    expect(nextTier(2, 'demoted')).toBe(1);
    expect(nextTier(1, 'held')).toBe(1);
  });
  it('clamps at both ends', () => {
    expect(nextTier(TIERS.MIN, 'demoted')).toBe(TIERS.MIN);
    expect(nextTier(TIERS.MAX, 'promoted')).toBe(TIERS.MAX);
  });
});

describe('settleLeague', () => {
  const mk = (id, xp, ts) => ({ user_id: id, weekly_xp: xp, updated_at: ts });

  it('ranks by xp desc, tie-break by updated_at asc', () => {
    const out = settleLeague([
      mk('a', 10, '2026-06-25T10:00:00Z'),
      mk('b', 30, '2026-06-25T09:00:00Z'),
      mk('c', 30, '2026-06-25T08:00:00Z'),
    ]);
    expect(out.map((m) => m.user_id)).toEqual(['c', 'b', 'a']);
    expect(out.map((m) => m.rank)).toEqual([1, 2, 3]);
  });

  it('marks top 7 promoted, bottom 5 demoted, middle held', () => {
    const members = Array.from({ length: 25 }, (_, i) =>
      mk(`u${i}`, 1000 - i, `2026-06-25T00:00:${String(i).padStart(2, '0')}Z`)
    );
    const out = settleLeague(members);
    expect(out.slice(0, 7).every((m) => m.result === 'promoted')).toBe(true);
    expect(out.slice(20).every((m) => m.result === 'demoted')).toBe(true);
    expect(out.slice(7, 20).every((m) => m.result === 'held')).toBe(true);
  });

  it('does not mutate the input array', () => {
    const input = [mk('a', 10, 't1')];
    const copy = JSON.parse(JSON.stringify(input));
    settleLeague(input);
    expect(input).toEqual(copy);
  });

  it('never marks a member as both promoted and demoted, for every cohort size', () => {
    for (let n = 1; n <= 25; n++) {
      const members = Array.from({ length: n }, (_, i) =>
        mk(`u${i}`, 1000 - i, `2026-06-25T00:00:${String(i).padStart(2, '0')}Z`)
      );
      const out = settleLeague(members);
      const promoted = out.filter((m) => m.result === 'promoted').length;
      const demoted = out.filter((m) => m.result === 'demoted').length;
      const held = out.filter((m) => m.result === 'held').length;
      // partition is exact — no member counted twice, none left unclassified
      expect(promoted + demoted + held, `n=${n}`).toBe(n);
      // promote + demote never exceed the cohort (the overlap bug)
      expect(promoted + demoted, `n=${n}`).toBeLessThanOrEqual(n);
      // ranks are a clean 1..n
      expect(out.map((m) => m.rank)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
    }
  });
});

describe('zoneCounts', () => {
  it('keeps the flat 7/5 split for full-size cohorts (n >= 12)', () => {
    expect(zoneCounts(25)).toEqual({ promote: 7, demote: 5 });
    expect(zoneCounts(12)).toEqual({ promote: 7, demote: 5 });
  });

  it('scales zones down without overlap for small cohorts', () => {
    for (let n = 0; n < 12; n++) {
      const { promote, demote } = zoneCounts(n);
      expect(promote + demote, `n=${n}`).toBeLessThanOrEqual(n);
      expect(promote, `n=${n}`).toBeGreaterThanOrEqual(n === 0 ? 0 : 1);
      expect(demote, `n=${n}`).toBeGreaterThanOrEqual(0);
    }
  });

  it('handles a one-member league without overlap', () => {
    expect(zoneCounts(1)).toEqual({ promote: 1, demote: 0 });
  });
});
