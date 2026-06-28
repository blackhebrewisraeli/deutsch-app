import { describe, it, expect } from 'vitest';
import { buildReport } from './report.js';

describe('buildReport', () => {
  it('summarizes counts and rejection reasons', () => {
    const r = buildReport({
      parsedCount: 100,
      rankedCount: 80,
      kept: [{ id: 'n:a' }, { id: 'n:b' }],
      rejected: [{ id: 'n:x', reason: 'no example' }, { id: 'n:y', reason: 'no example' }, { id: 'n:z', reason: 'noun missing article' }],
    });
    expect(r.total).toBe(80);
    expect(r.kept).toBe(2);
    expect(r.rejected).toBe(3);
    expect(r.byReason).toEqual({ 'no example': 2, 'noun missing article': 1 });
    expect(r.sample.length).toBeLessThanOrEqual(10);
    expect(r.sample.every((id) => ['n:a', 'n:b'].includes(id))).toBe(true);
  });
});
