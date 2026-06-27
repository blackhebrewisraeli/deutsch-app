import { describe, it, expect } from 'vitest';
import { zoneCounts, LEAGUE_SIZE, PROMOTE_COUNT, DEMOTE_COUNT } from './leagueZones.js';

describe('zoneCounts', () => {
  it('keeps the flat 7/5 split for full-size cohorts (n >= 12)', () => {
    expect(zoneCounts(LEAGUE_SIZE)).toEqual({ promote: 7, demote: 5 });
    expect(zoneCounts(PROMOTE_COUNT + DEMOTE_COUNT)).toEqual({ promote: 7, demote: 5 });
  });

  it('scales zones down without overlap for small cohorts', () => {
    for (let n = 0; n < PROMOTE_COUNT + DEMOTE_COUNT; n++) {
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
