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

// Only the field resolveCard reads. `suffixed` stands in for a language that
// puts the article after the lemma.
const de = { articlePosition: 'before' };
const suffixed = { articlePosition: 'after' };

describe('resolveCard', () => {
  // The Phase 1.5 point: composition is pack-driven, not merely relocated.
  it('composes the display form from the pack article position', () => {
    expect(resolveCard(noun, de).de).toBe('das Brot');
    expect(resolveCard(noun, suffixed).de).toBe('Brot das');
  });

  it('leaves an article-less entry alone whatever the position', () => {
    expect(resolveCard(phrase, de).de).toBe('Hallo');
    expect(resolveCard(phrase, suffixed).de).toBe('Hallo');
  });

  it('composes noun display form from article + lemma', () => {
    expect(resolveCard(noun, de).de).toBe('das Brot');
  });
  it('leaves non-noun de unchanged', () => {
    expect(resolveCard(phrase, de).de).toBe('Hallo');
  });
  it('exposes en as the primary gloss string and glosses as the full array', () => {
    const c = resolveCard(noun, de);
    expect(c.en).toBe('bread');
    expect(c.glosses).toEqual(['bread', 'loaf']);
  });
  it('preserves the id and rich fields', () => {
    const c = resolveCard(noun, de);
    expect(c.id).toBe('das Brot');
    expect(c.plural).toBe('Brote');
    expect(c.examples).toEqual(noun.examples);
  });
});

describe('resolveDeck', () => {
  it('resolves a curated deck by cardIds, preserving order', () => {
    const cards = resolveDeck({ cardIds: ['Hallo', 'das Brot'] }, lexicon, de);
    expect(cards.map((c) => c.id)).toEqual(['Hallo', 'das Brot']);
    expect(cards.map((c) => c.de)).toEqual(['Hallo', 'das Brot']);
  });
  it('throws on a missing cardId', () => {
    expect(() => resolveDeck({ cardIds: ['nope'] }, lexicon, de)).toThrow(/nope/);
  });
  it('resolves an auto freq-band deck sorted by freqRank', () => {
    const cards = resolveDeck({ auto: { by: 'freq', range: [1, 50] } }, lexicon, de);
    expect(cards.map((c) => c.id)).toEqual(['das Brot']); // freqRank 5 in [1,50]; Hallo 100 excluded
  });
  it('resolves an auto cefr deck', () => {
    const cards = resolveDeck({ auto: { by: 'cefr', level: 'A1' } }, lexicon, de);
    expect(cards.map((c) => c.id).sort()).toEqual(['Hallo', 'das Brot']);
  });
  it('throws on an unrecognized deck def', () => {
    expect(() => resolveDeck({}, lexicon, de)).toThrow();
  });
});

describe('resolveDecks', () => {
  it('resolves every deck in a map', () => {
    const out = resolveDecks({ a: { cardIds: ['Hallo'] } }, lexicon, de);
    expect(out.a.map((c) => c.id)).toEqual(['Hallo']);
  });
});

describe('resolveDeck auto.by=tag and sort coverage', () => {
  const e = (id, rank, cefr, tags) => ({
    id,
    de: id,
    en: [id],
    pos: 'noun',
    article: 'das',
    ipa: null,
    plural: null,
    cefr,
    freqRank: rank,
    tags,
    examples: [],
    verb: null,
    source: { dict: 'w', license: 'l' },
  });
  const lex = {
    'n:a': e('n:a', 3, 'A1', ['food']),
    'n:b': e('n:b', 1, 'A1', ['food']),
    'n:c': e('n:c', 2, 'A2', ['travel']),
  };
  it('filters by tag and sorts ascending by freqRank', () => {
    const cards = resolveDeck({ auto: { by: 'tag', tag: 'food' } }, lex, de);
    expect(cards.map((c) => c.id)).toEqual(['n:b', 'n:a']);
  });
  it('freq band sorts multiple entries ascending', () => {
    const cards = resolveDeck({ auto: { by: 'freq', range: [1, 3] } }, lex, de);
    expect(cards.map((c) => c.id)).toEqual(['n:b', 'n:c', 'n:a']);
  });
  it('throws on an unknown auto.by', () => {
    expect(() => resolveDeck({ auto: { by: 'bogus' } }, lex, de)).toThrow(/bogus/);
  });
});

describe('resolveDeck auto.by=top and array tags', () => {
  const e = (id, rank, tags = []) => ({
    id,
    de: id,
    en: [id],
    pos: 'noun',
    article: 'das',
    ipa: null,
    plural: null,
    cefr: 'A1',
    freqRank: rank,
    tags,
    examples: [],
    verb: null,
    source: { dict: 'w', license: 'l' },
  });
  const lex = {
    'n:a': e('n:a', 30, ['sports']),
    'n:b': e('n:b', 10, ['games']),
    'n:c': e('n:c', 20, ['hobbies']),
    'n:d': e('n:d', null, ['sports']),
  };

  it('top returns the N lowest-rank cards in rank order', () => {
    const cards = resolveDeck({ auto: { by: 'top', count: 2 } }, lex, de);
    expect(cards.map((c) => c.id)).toEqual(['n:b', 'n:c']);
  });
  it('top never exceeds count and puts null ranks last', () => {
    const cards = resolveDeck({ auto: { by: 'top', count: 10 } }, lex, de);
    expect(cards).toHaveLength(4);
    expect(cards[3].id).toBe('n:d');
  });
  it('tag still accepts a single string', () => {
    const cards = resolveDeck({ auto: { by: 'tag', tag: 'sports' } }, lex, de);
    expect(cards.map((c) => c.id)).toEqual(['n:a', 'n:d']);
  });
  it('tag accepts an array and matches any of them', () => {
    const cards = resolveDeck({ auto: { by: 'tag', tag: ['games', 'hobbies'] } }, lex, de);
    expect(cards.map((c) => c.id)).toEqual(['n:b', 'n:c']);
  });
});

describe('resolveCard lemma', () => {
  it('keeps the bare lemma alongside the composed display form', () => {
    // `de` is the display form, so a gender drill rendering it would print
    // "das Jahr" and give away its own answer.
    const card = resolveCard(
      { id: 'n:jahr', de: 'Jahr', en: ['year'], pos: 'noun', article: 'das' },
      { articlePosition: 'before' }
    );
    expect(card.de).toBe('das Jahr');
    expect(card.lemma).toBe('Jahr');
    expect(card.article).toBe('das');
  });

  it('lemma equals de when there is no article', () => {
    const card = resolveCard({ id: 'v:gehen', de: 'gehen', en: ['to go'], pos: 'verb' }, {});
    expect(card.de).toBe('gehen');
    expect(card.lemma).toBe('gehen');
  });
});
