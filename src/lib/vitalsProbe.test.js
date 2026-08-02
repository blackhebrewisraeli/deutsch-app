import { describe, it, expect } from 'vitest';
import { computeInp, computeCls, rate, THRESHOLDS } from './vitalsProbe';

describe('computeInp', () => {
  it('returns null with no interactions', () => {
    expect(computeInp([])).toBeNull();
  });

  it('is the worst interaction while there are fewer than 50', () => {
    expect(computeInp([120, 40, 380, 90])).toBe(380);
  });

  it('discards one outlier per 50 interactions', () => {
    // 50 interactions → index 1 → the *second* worst is reported, so a single
    // pathological outlier does not define the score.
    const durations = [900, 700, ...Array.from({ length: 48 }, () => 100)];
    expect(computeInp(durations)).toBe(700);
  });

  it('discards two outliers at 100 interactions', () => {
    const durations = [900, 800, 700, ...Array.from({ length: 97 }, () => 100)];
    expect(computeInp(durations)).toBe(700);
  });

  it('does not read past the end for a single interaction', () => {
    expect(computeInp([250])).toBe(250);
  });
});

describe('computeCls', () => {
  it('is zero with no shifts', () => {
    expect(computeCls([])).toBe(0);
  });

  it('sums shifts inside one session window', () => {
    const shifts = [
      { startTime: 0, value: 0.05 },
      { startTime: 400, value: 0.03 },
      { startTime: 800, value: 0.02 },
    ];
    expect(computeCls(shifts)).toBeCloseTo(0.1, 5);
  });

  it('starts a new window after a gap longer than 1s, and reports the largest', () => {
    const shifts = [
      { startTime: 0, value: 0.05 },
      { startTime: 500, value: 0.05 }, // window A = 0.10
      { startTime: 3000, value: 0.3 }, // >1s gap → window B = 0.30
    ];
    expect(computeCls(shifts)).toBeCloseTo(0.3, 5);
  });

  it('keeps the larger earlier window when a later one is smaller', () => {
    const shifts = [
      { startTime: 0, value: 0.4 },
      { startTime: 5000, value: 0.1 },
    ];
    expect(computeCls(shifts)).toBeCloseTo(0.4, 5);
  });

  it('caps a session window at 5s even without a gap', () => {
    // Shifts every 900ms (never a 1s gap) for 9s: the 5s cap must split them,
    // otherwise a long-lived page accumulates one enormous window.
    const shifts = Array.from({ length: 10 }, (_, i) => ({ startTime: i * 900, value: 0.05 }));
    expect(computeCls(shifts)).toBeLessThan(0.5);
  });
});

describe('rate', () => {
  it('bands INP against the web.dev thresholds', () => {
    expect(rate('inp', 150)).toBe('good');
    expect(rate('inp', THRESHOLDS.inp[0])).toBe('good');
    expect(rate('inp', 300)).toBe('needs-improvement');
    expect(rate('inp', 900)).toBe('poor');
  });

  it('reports unknown for a missing value or unknown metric', () => {
    expect(rate('inp', null)).toBe('unknown');
    expect(rate('nonsense', 10)).toBe('unknown');
  });
});
