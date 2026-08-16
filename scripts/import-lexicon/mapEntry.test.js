import { describe, it, expect } from 'vitest';
import { mapEntry } from './mapEntry.js';
import { validateLexiconEntry } from '../../src/packs/validate.js';
import { grammar } from '../../src/packs/de/grammar.js';

// The literal cefrLevels is deliberate: this asserts the importer's output
// against the German contract, and importing the whole pack for one array
// would pull the lexicon and theme into a build-script test.
const OPTS = { grammar, cefrLevels: ['A1', 'A2', 'B1'] };

const noun = {
  id: 'n:brot',
  lemma: 'Brot',
  pos: 'noun',
  article: 'das',
  plural: 'Brote',
  ipa: '[bʁoːt]',
  glosses: ['bread'],
  topics: ['food'],
  freqRank: 142,
  cefr: 'A1',
  examples: [{ de: 'Ich esse Brot.', en: 'I eat bread.', source: 'tatoeba' }],
};

describe('mapEntry', () => {
  it('produces a valid LexiconEntry for a noun', () => {
    const entry = mapEntry(noun);
    expect(entry).toEqual({
      id: 'n:brot',
      de: 'Brot',
      en: ['bread'],
      pos: 'noun',
      article: 'das',
      ipa: '[bʁoːt]',
      plural: 'Brote',
      cefr: 'A1',
      freqRank: 142,
      tags: ['food'],
      antonyms: [],
      examples: [{ de: 'Ich esse Brot.', en: 'I eat bread.', source: 'tatoeba' }],
      verb: null,
      source: { dict: 'wiktionary', license: 'CC-BY-SA-4.0', sentences: 'tatoeba' },
    });
    expect(validateLexiconEntry(entry, OPTS)).toBe(true);
  });

  it('passes a verb conjugation block through and stays valid', () => {
    const verbWord = {
      id: 'v:gehen',
      lemma: 'gehen',
      pos: 'verb',
      article: null,
      plural: null,
      ipa: '[ˈɡeːən]',
      glosses: ['to go'],
      topics: [],
      freqRank: 12,
      cefr: 'A1',
      examples: [{ de: 'Wir gehen.', en: 'We go.', source: 'tatoeba' }],
      verb: {
        aux: 'sein',
        partizip2: 'gegangen',
        present: { ich: 'gehe', du: 'gehst', er: 'geht', wir: 'gehen', ihr: 'geht', sie: 'gehen' },
      },
    };
    const entry = mapEntry(verbWord);
    expect(entry.verb).toEqual(verbWord.verb);
    expect(entry.pos).toBe('verb');
    expect(validateLexiconEntry(entry, OPTS)).toBe(true);
  });
});
