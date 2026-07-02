import { describe, it, expect } from 'vitest';
import { validateLanguagePack } from './validate';

const validPack = {
  meta: {
    id: 'xx',
    name: 'X',
    nativeName: 'X',
    locale: 'xx-XX',
    direction: 'ltr',
    flag: '🏳',
    themeId: 'xx',
    cefrLevels: ['A1'],
  },
  content: {
    alphabet: [],
    alphabetQuiz: [],
    decks: {},
    scenarios: [],
    chatTasks: {},
    translateSentences: { A1: [] },
  },
  validation: { normalize: (s) => s },
  cardId: (c) => c.de,
  grammar: {},
  prompts: {},
};

describe('validateLanguagePack', () => {
  it('returns true for a well-formed pack', () => {
    expect(validateLanguagePack(validPack)).toBe(true);
  });
  it('throws when validation.normalize is missing', () => {
    expect(() => validateLanguagePack({ ...validPack, validation: {} })).toThrow(/normalize/);
  });
  it('throws when cardId is not a function', () => {
    expect(() => validateLanguagePack({ ...validPack, cardId: undefined })).toThrow(/cardId/);
  });
  it('throws when a declared cefrLevel has no sentence bank', () => {
    expect(() =>
      validateLanguagePack({
        ...validPack,
        content: { ...validPack.content, translateSentences: {} },
      })
    ).toThrow(/translateSentences/);
  });
});

import { validateLexiconEntry, POS, ARTICLES, CEFR } from './validate';

const validNoun = {
  id: 'das Brot',
  de: 'Brot',
  en: ['bread'],
  pos: 'noun',
  article: 'das',
  ipa: '[das bʁoːt]',
  plural: 'Brote',
  cefr: 'A1',
  freqRank: null,
  tags: ['food'],
  examples: [{ de: 'Ich esse Brot.', en: 'I eat bread.', source: 'authored' }],
  verb: null,
  source: { dict: 'authored', license: 'MIT' },
};

const validPhrase = {
  id: 'Hallo',
  de: 'Hallo',
  en: ['hello'],
  pos: 'phrase',
  article: null,
  ipa: '[ˈhalo]',
  plural: null,
  cefr: 'A1',
  freqRank: null,
  tags: ['greetings'],
  examples: [],
  verb: null,
  source: { dict: 'authored', license: 'MIT' },
};

describe('validateLexiconEntry', () => {
  it('exports POS/ARTICLES/CEFR enums', () => {
    expect(POS).toContain('noun');
    expect(ARTICLES).toEqual(['der', 'die', 'das']);
    expect(CEFR).toEqual(['A1', 'A2', 'B1']);
  });
  it('returns true for a well-formed noun entry', () => {
    expect(validateLexiconEntry(validNoun)).toBe(true);
  });
  it('returns true for a well-formed phrase with empty examples', () => {
    expect(validateLexiconEntry(validPhrase)).toBe(true);
  });
  it('throws when id is empty', () => {
    expect(() => validateLexiconEntry({ ...validNoun, id: '' })).toThrow(/id/);
  });
  it('throws when en is not a non-empty array', () => {
    expect(() => validateLexiconEntry({ ...validNoun, en: [] })).toThrow(/en/);
  });
  it('throws when pos is unknown', () => {
    expect(() => validateLexiconEntry({ ...validNoun, pos: 'xyz' })).toThrow(/pos/);
  });
  it('throws when a noun has no article', () => {
    expect(() => validateLexiconEntry({ ...validNoun, article: null })).toThrow(/article/);
  });
  it('throws when article is invalid', () => {
    expect(() => validateLexiconEntry({ ...validNoun, article: 'le' })).toThrow(/article/);
  });
  it('throws when cefr is invalid', () => {
    expect(() => validateLexiconEntry({ ...validNoun, cefr: 'C2' })).toThrow(/cefr/);
  });
  it('throws when an example is missing en', () => {
    expect(() =>
      validateLexiconEntry({ ...validNoun, examples: [{ de: 'x', source: 'authored' }] })
    ).toThrow(/example/);
  });
  it('accepts a verb entry with a null verb block (best-effort)', () => {
    expect(
      validateLexiconEntry({
        ...validNoun,
        id: 'v:gehen',
        de: 'gehen',
        en: ['to go'],
        pos: 'verb',
        article: null,
        plural: null,
        verb: null,
      })
    ).toBe(true);
  });
  it('accepts a partial verb block (null aux, some present forms null)', () => {
    expect(
      validateLexiconEntry({
        ...validNoun,
        id: 'v:machen',
        de: 'machen',
        en: ['to make'],
        pos: 'verb',
        article: null,
        plural: null,
        verb: {
          aux: null,
          partizip2: 'gemacht',
          present: { ich: 'mache', du: null, er: null, wir: null, ihr: null, sie: null },
        },
      })
    ).toBe(true);
  });
  it('throws when verb.aux is not null/haben/sein', () => {
    expect(() =>
      validateLexiconEntry({
        ...validNoun,
        pos: 'verb',
        article: null,
        verb: {
          aux: 'werden',
          partizip2: null,
          present: { ich: null, du: null, er: null, wir: null, ihr: null, sie: null },
        },
      })
    ).toThrow(/aux/);
  });
  it('throws when a present key is missing from the verb block', () => {
    expect(() =>
      validateLexiconEntry({
        ...validNoun,
        pos: 'verb',
        article: null,
        verb: { aux: null, partizip2: null, present: { ich: 'gehe' } },
      })
    ).toThrow(/present/);
  });
  it('accepts a valid verb entry', () => {
    expect(
      validateLexiconEntry({
        ...validNoun,
        id: 'gehen',
        de: 'gehen',
        en: ['to go'],
        pos: 'verb',
        article: null,
        plural: null,
        verb: {
          aux: 'sein',
          partizip2: 'gegangen',
          present: {
            ich: 'gehe',
            du: 'gehst',
            er: 'geht',
            wir: 'gehen',
            ihr: 'geht',
            sie: 'gehen',
          },
        },
      })
    ).toBe(true);
  });
});
