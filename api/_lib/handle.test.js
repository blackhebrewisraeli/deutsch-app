import { describe, it, expect } from 'vitest';
import { generateHandle } from './handle.js';

// deterministic rng: cycles through a fixed list of values in [0,1)
function seededRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('generateHandle', () => {
  it('produces Adjective + Noun + two digits', () => {
    const h = generateHandle(seededRng([0, 0, 0]));
    expect(h).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+\d{2}$/);
  });

  it('is deterministic for a given rng sequence', () => {
    expect(generateHandle(seededRng([0.5, 0.5, 0.42]))).toBe(
      generateHandle(seededRng([0.5, 0.5, 0.42]))
    );
  });

  it('varies the number with the third draw', () => {
    const a = generateHandle(seededRng([0, 0, 0]));
    const b = generateHandle(seededRng([0, 0, 0.99]));
    expect(a).not.toBe(b);
  });
});
