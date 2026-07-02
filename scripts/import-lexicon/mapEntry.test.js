import { describe, it, expect } from 'vitest';
import { mapEntry } from './mapEntry.js';
import { validateLexiconEntry } from '../../src/packs/validate.js';

const noun = {
  id: 'n:brot', lemma: 'Brot', pos: 'noun', article: 'das', plural: 'Brote',
  ipa: '[bʁoːt]', glosses: ['bread'], topics: ['food'], freqRank: 142, cefr: 'A1',
  examples: [{ de: 'Ich esse Brot.', en: 'I eat bread.', source: 'tatoeba' }],
};

describe('mapEntry', () => {
  it('produces a valid LexiconEntry for a noun', () => {
    const entry = mapEntry(noun);
    expect(entry).toEqual({
      id: 'n:brot', de: 'Brot', en: ['bread'], pos: 'noun', article: 'das',
      ipa: '[bʁoːt]', plural: 'Brote', cefr: 'A1', freqRank: 142, tags: ['food'],
      examples: [{ de: 'Ich esse Brot.', en: 'I eat bread.', source: 'tatoeba' }],
      verb: null,
      source: { dict: 'wiktionary', license: 'CC-BY-SA-4.0', sentences: 'tatoeba' },
    });
    expect(validateLexiconEntry(entry)).toBe(true);
  });
});
