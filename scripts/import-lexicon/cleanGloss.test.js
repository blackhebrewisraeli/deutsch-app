import { describe, it, expect } from 'vitest';
import { cleanGloss } from './cleanGloss.js';

describe('cleanGloss', () => {
  it('cuts the parenthetical detail after the synonyms', () => {
    expect(
      cleanGloss(
        'source material, original, inspiration (the material that is adapted into a piece of media or art)'
      )
    ).toBe('source material, original, inspiration');
  });

  it('strips a leading bracketed grammar label', () => {
    expect(cleanGloss('[with dative] in, inside, within, at (inside a building)')).toBe(
      'in, inside, within, at'
    );
  });

  it('caps the synonym list at three', () => {
    expect(cleanGloss('support, assistance, backing, also endorsement')).toBe(
      'support, assistance, backing'
    );
  });

  it('treats semicolons as synonym separators too', () => {
    expect(cleanGloss('though; yet; but; however; nevertheless')).toBe('though; yet; but');
  });

  it('leaves a short gloss untouched', () => {
    expect(cleanGloss('bread')).toBe('bread');
  });

  it('leaves encyclopedic prose alone apart from the parenthetical', () => {
    expect(
      cleanGloss('final exams taken by pupils at the end of their secondary education in Germany')
    ).toBe('final exams taken by pupils at the end of their secondary education in Germany');
  });

  it('falls back to the raw gloss when cleaning would empty it', () => {
    // "ihn" — the one shipped entry whose gloss opens with a parenthetical
    expect(cleanGloss('(obsolete) dative of sie; them (indirect object).')).toBe(
      '(obsolete) dative of sie; them (indirect object).'
    );
  });

  it('returns an empty string for nullish or non-string input', () => {
    expect(cleanGloss(null)).toBe('');
    expect(cleanGloss(undefined)).toBe('');
    expect(cleanGloss(42)).toBe('');
  });

  it('trims trailing separators left behind by the cut', () => {
    expect(cleanGloss('year, (solar year)')).toBe('year');
  });
});
