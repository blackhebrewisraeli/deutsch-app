import { describe, it, expect } from 'vitest';
import { dePack } from './index';
import { normalizeText } from '../../lib/textRules';

const norm = (s) => normalizeText(s, dePack.validation.target);

describe('German target text rules', () => {
  it('declares keyboard substitutions and no mark stripping', () => {
    expect(dePack.validation.target.stripCombiningMarks).toBe(false);
    expect(dePack.validation.target.replacements).toEqual([
      ['ß', 'ss'],
      ['ä', 'ae'],
      ['ö', 'oe'],
      ['ü', 'ue'],
    ]);
  });

  // What a learner on a keyboard without the characters can actually type.
  it.each([
    ['groß', 'gross'],
    ['Fuß', 'Fuss'],
    ['Straße', 'strasse'],
    ['Tschüß', 'tschuess'],
    ['ÄRGER', 'aerger'],
    ['schön', 'schoen'],
  ])('accepts %s spelled %s', (a, b) => {
    expect(norm(a)).toBe(norm(b));
  });

  // The reason the policy stops at substitutions: stripping marks to bare
  // vowels would collapse these into false matches.
  it.each([
    ['schön', 'schon'],
    ['Bär', 'Bar'],
    ['Würde', 'Wurde'],
    ['schwül', 'schwul'],
  ])('keeps %s distinct from %s', (a, b) => {
    expect(norm(a)).not.toBe(norm(b));
  });

  // A known, accepted cost of ß→ss: two real words collapse. Pinned here so
  // the trade-off is visible in the suite rather than filed as a bug.
  it('accepts that Maße and Masse collapse — the documented cost of ß→ss', () => {
    expect(norm('Maße')).toBe(norm('Masse'));
  });
});
