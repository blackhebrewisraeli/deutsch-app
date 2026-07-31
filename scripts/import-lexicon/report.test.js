import { describe, it, expect } from 'vitest';
import { buildReport } from './report.js';

describe('buildReport', () => {
  it('summarizes counts and rejection reasons', () => {
    const r = buildReport({
      parsedCount: 100,
      rankedCount: 80,
      kept: [{ id: 'n:a' }, { id: 'n:b' }],
      rejected: [
        { id: 'n:x', reason: 'no example' },
        { id: 'n:y', reason: 'no example' },
        { id: 'n:z', reason: 'noun missing article' },
      ],
    });
    expect(r.total).toBe(80);
    expect(r.kept).toBe(2);
    expect(r.rejected).toBe(3);
    expect(r.byReason).toEqual({ 'no example': 2, 'noun missing article': 1 });
    expect(r.sample.length).toBeLessThanOrEqual(10);
    expect(r.sample.every((id) => ['n:a', 'n:b'].includes(id))).toBe(true);
  });

  it('reports the number of cards retired by the homograph merge', () => {
    const r = buildReport({
      parsedCount: 10,
      rankedCount: 8,
      kept: [{ id: 'a' }, { id: 'b' }],
      rejected: [],
      mergedAway: 3,
    });
    expect(r.mergedAway).toBe(3);
  });

  it('defaults mergedAway to 0 when not supplied', () => {
    const r = buildReport({ parsedCount: 1, rankedCount: 1, kept: [{ id: 'a' }], rejected: [] });
    expect(r.mergedAway).toBe(0);
  });
});
