import { describe, it, expect } from 'vitest';
import { currentPeriodStart, nextTier, settleLeague, TIERS } from './leagueLogic.js';

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
});
