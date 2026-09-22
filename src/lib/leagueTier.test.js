import { describe, it, expect } from 'vitest';
import { TIER_NAMES, tierName } from './leagueTier.js';

describe('tierName', () => {
  it('names every tier', () => {
    TIER_NAMES.forEach((name, i) => expect(tierName(i)).toBe(name));
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an index past the last tier', 5],
    ['a negative index', -1],
    ['a fractional index', 1.5],
    ['a tier name rather than an index', 'Gold'],
    ['NaN', Number.NaN],
  ])('falls back to Bronze for %s', (_label, input) => {
    // Bronze is the FLOOR — TIERS.MIN on the server, where join.js starts every
    // new player — so "no tier" and "tier 0" are the same standing. Indexing
    // TIER_NAMES raw returns undefined for all of these, and React renders
    // undefined as nothing: a league card with a blank where its tier goes.
    expect(tierName(input)).toBe('Bronze');
  });

  it('never returns a name that is not a tier', () => {
    for (const input of [undefined, null, -3, 99, 'x', {}, []]) {
      expect(TIER_NAMES).toContain(tierName(input));
    }
  });
});
