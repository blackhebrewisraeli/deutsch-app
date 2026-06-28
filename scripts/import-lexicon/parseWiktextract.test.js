import { describe, it, expect } from 'vitest';
import { parseRecord } from './parseWiktextract.js';
import { NOUN_BROT, VERB_GEHEN, NON_GERMAN, NO_GLOSS } from './__fixtures__/wiktextract-sample.js';

describe('parseRecord', () => {
  it('parses a noun with gender, plural, ipa, gloss, topic, example', () => {
    expect(parseRecord(NOUN_BROT)).toEqual({
      lemma: 'Brot',
      pos: 'noun',
      article: 'das',
      plural: 'Brote',
      ipa: '[bʁoːt]',
      glosses: ['bread'],
      topics: ['food'],
      rawExamples: [{ de: 'Ich esse Brot.', en: 'I eat bread.' }],
    });
  });
  it('parses a verb (no article/plural) and caps glosses', () => {
    const out = parseRecord(VERB_GEHEN);
    expect(out.pos).toBe('verb');
    expect(out.article).toBe(null);
    expect(out.plural).toBe(null);
    expect(out.glosses).toEqual(['to go', 'to walk']);
  });
  it('drops non-German records', () => {
    expect(parseRecord(NON_GERMAN)).toBe(null);
  });
  it('drops records with no usable gloss', () => {
    expect(parseRecord(NO_GLOSS)).toBe(null);
  });
});
