import { describe, it, expect } from 'vitest';
import { resolveCard, resolveDeck, resolveDecks } from './resolve';

const noun = {
  id: 'das Brot',
  de: 'Brot',
  en: ['bread', 'loaf'],
  pos: 'noun',
  article: 'das',
  ipa: '[das bʁoːt]',
  plural: 'Brote',
  cefr: 'A1',
  freqRank: 5,
  tags: ['food'],
  examples: [{ de: 'Ich esse Brot.', en: 'I eat bread.', source: 'authored' }],
  verb: null,
  source: { dict: 'authored', license: 'MIT' },
};
const phrase = {
  id: 'Hallo',
  de: 'Hallo',
  en: ['Hello'],
  pos: 'phrase',
  article: null,
  ipa: '[ˈhalo]',
  plural: null,
  cefr: 'A1',
  freqRank: 100,
  tags: ['greetings'],
  examples: [],
  verb: null,
  source: { dict: 'authored', license: 'MIT' },
};
const lexicon = { 'das Brot': noun, Hallo: phrase };

describe('resolveCard', () => {
  it('composes noun display form from article + lemma', () => {
    expect(resolveCard(noun).de).toBe('das Brot');
  });
  it('leaves non-noun de unchanged', () => {
    expect(resolveCard(phrase).de).toBe('Hallo');
  });
  it('exposes en as the primary gloss string and glosses as the full array', () => {
    const c = resolveCard(noun);
    expect(c.en).toBe('bread');
    expect(c.glosses).toEqual(['bread', 'loaf']);
  });
  it('preserves the id and rich fields', () => {
    const c = resolveCard(noun);
    expect(c.id).toBe('das Brot');
    expect(c.plural).toBe('Brote');
    expect(c.examples).toEqual(noun.examples);
  });
});

describe('resolveDeck', () => {
  it('resolves a curated deck by cardIds, preserving order', () => {
    const cards = resolveDeck({ cardIds: ['Hallo', 'das Brot'] }, lexicon);
    expect(cards.map((c) => c.id)).toEqual(['Hallo', 'das Brot']);
    expect(cards.map((c) => c.de)).toEqual(['Hallo', 'das Brot']);
  });
  it('throws on a missing cardId', () => {
    expect(() => resolveDeck({ cardIds: ['nope'] }, lexicon)).toThrow(/nope/);
  });
  it('resolves an auto freq-band deck sorted by freqRank', () => {
    const cards = resolveDeck({ auto: { by: 'freq', range: [1, 50] } }, lexicon);
    expect(cards.map((c) => c.id)).toEqual(['das Brot']); // freqRank 5 in [1,50]; Hallo 100 excluded
  });
  it('resolves an auto cefr deck', () => {
    const cards = resolveDeck({ auto: { by: 'cefr', level: 'A1' } }, lexicon);
    expect(cards.map((c) => c.id).sort()).toEqual(['Hallo', 'das Brot']);
  });
  it('throws on an unrecognized deck def', () => {
    expect(() => resolveDeck({}, lexicon)).toThrow();
  });
});

describe('resolveDecks', () => {
  it('resolves every deck in a map', () => {
    const out = resolveDecks({ a: { cardIds: ['Hallo'] } }, lexicon);
    expect(out.a.map((c) => c.id)).toEqual(['Hallo']);
  });
});
