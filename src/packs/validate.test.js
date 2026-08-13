import { describe, it, expect } from 'vitest';
import { validateLanguagePack } from './validate';

const validTheme = {
  accent: {
    fill: '#FFCE00',
    onFill: '#0D0D0F',
    fg: { light: '#8A6A00', dark: '#FFCE00' },
  },
  accentAlt: {
    fill: { light: '#C92A2A', dark: '#FF6B6B' },
    onFill: { light: '#FFFFFF', dark: '#0D0D0F' },
  },
  progress: ['ground', 'accentAlt', 'accent'],
  font: {
    display: "'Fraunces', Georgia, serif",
    body: "'Fraunces', Georgia, serif",
    mono: "'JetBrains Mono', monospace",
    families: [{ name: 'Fraunces', weights: [400] }],
  },
};

const validPack = {
  meta: {
    id: 'xx',
    name: 'X',
    nativeName: 'X',
    locale: 'xx-XX',
    direction: 'ltr',
    flag: '🏳',
    themeId: 'xx',
    cefrLevels: ['A1', 'A2', 'B1'],
  },
  content: {
    alphabet: [],
    alphabetQuiz: [],
    decks: {},
    scenarios: [],
    chatTasks: {},
    translateSentences: { A1: [], A2: [], B1: [] },
  },
  validation: {
    target: { trim: true, caseFold: true, stripCombiningMarks: false, replacements: [] },
  },
  cardId: (c) => c.de,
  grammar: {
    articles: ['el', 'la'],
    articleRequiredForNouns: true,
    auxiliaries: { haber: 'ha' },
    personKeys: ['yo', 'tu', 'el'],
    displayPerson: 'el',
    labels: { perfect: 'Pretérito perfecto', participle: 'Participio' },
  },
  prompts: {
    persona: 'Ana',
    targetLanguage: 'Xish',
    levels: { a1: 'a1 pedagogy', a2: 'a2 pedagogy', b1: 'b1 pedagogy' },
    exercises: { a1: 'a1 focus', a2: 'a2 focus', b1: 'b1 focus' },
    deck: { cardExample: 'el perro', ipaExample: '[el ˈpero]' },
  },
  theme: validTheme,
};

describe('validateLanguagePack', () => {
  it('returns true for a well-formed pack', () => {
    expect(validateLanguagePack(validPack)).toBe(true);
  });
  it('throws when validation is missing entirely', () => {
    expect(() => validateLanguagePack({ ...validPack, validation: undefined })).toThrow(
      /validation is required/
    );
  });
  it('throws when validation.target is missing', () => {
    expect(() => validateLanguagePack({ ...validPack, validation: {} })).toThrow(
      /validation\.target/
    );
  });

  it('throws when a target flag is not a boolean', () => {
    const bad = {
      ...validPack,
      validation: {
        ...validPack.validation,
        target: { ...validPack.validation.target, caseFold: 'yes' },
      },
    };
    expect(() => validateLanguagePack(bad)).toThrow(/caseFold/);
  });

  it('throws when replacements is not an array', () => {
    const bad = {
      ...validPack,
      validation: {
        ...validPack.validation,
        target: { ...validPack.validation.target, replacements: {} },
      },
    };
    expect(() => validateLanguagePack(bad)).toThrow(/replacements/);
  });

  it('throws when a replacement is not a pair of strings', () => {
    const bad = {
      ...validPack,
      validation: {
        ...validPack.validation,
        target: { ...validPack.validation.target, replacements: [['ß']] },
      },
    };
    expect(() => validateLanguagePack(bad)).toThrow(/pair of strings/);
  });

  // An empty `from` would make String.split explode the string into characters.
  it('throws when a replacement has an empty from side', () => {
    const bad = {
      ...validPack,
      validation: {
        ...validPack.validation,
        target: { ...validPack.validation.target, replacements: [['', 'x']] },
      },
    };
    expect(() => validateLanguagePack(bad)).toThrow(/must not be empty/);
  });

  it('throws when prompts is missing', () => {
    expect(() => validateLanguagePack({ ...validPack, prompts: undefined })).toThrow(
      /prompts is required/
    );
  });

  it('throws when persona is empty', () => {
    const bad = { ...validPack, prompts: { ...validPack.prompts, persona: '  ' } };
    expect(() => validateLanguagePack(bad)).toThrow(/prompts\.persona/);
  });

  it('throws when targetLanguage is missing', () => {
    const bad = { ...validPack, prompts: { ...validPack.prompts, targetLanguage: undefined } };
    expect(() => validateLanguagePack(bad)).toThrow(/prompts\.targetLanguage/);
  });

  // cefrLevels is ['A1','A2','B1']; the prompt maps are keyed lowercase.
  it('throws when a declared CEFR level has no chat pedagogy', () => {
    const bad = {
      ...validPack,
      prompts: { ...validPack.prompts, levels: { a1: 'x', a2: 'y' } },
    };
    expect(() => validateLanguagePack(bad)).toThrow(/prompts\.levels\.b1/);
  });

  it('throws when a level pedagogy is an empty string', () => {
    const bad = {
      ...validPack,
      prompts: { ...validPack.prompts, levels: { ...validPack.prompts.levels, a2: '' } },
    };
    expect(() => validateLanguagePack(bad)).toThrow(/prompts\.levels\.a2/);
  });

  it('throws when a declared CEFR level has no exercise focus', () => {
    const bad = {
      ...validPack,
      prompts: { ...validPack.prompts, exercises: { a1: 'x', b1: 'z' } },
    };
    expect(() => validateLanguagePack(bad)).toThrow(/prompts\.exercises\.a2/);
  });

  it('throws when a deck example is missing', () => {
    const bad = {
      ...validPack,
      prompts: { ...validPack.prompts, deck: { cardExample: 'el perro' } },
    };
    expect(() => validateLanguagePack(bad)).toThrow(/prompts\.deck\.ipaExample/);
  });

  it('throws when grammar is missing', () => {
    expect(() => validateLanguagePack({ ...validPack, grammar: undefined })).toThrow(
      /grammar is required/
    );
  });

  it('throws when articles is not an array of strings', () => {
    const bad = { ...validPack, grammar: { ...validPack.grammar, articles: 'el' } };
    expect(() => validateLanguagePack(bad)).toThrow(/grammar\.articles/);
  });

  it('accepts an empty articles array — a language may have none', () => {
    const ok = {
      ...validPack,
      grammar: { ...validPack.grammar, articles: [], articleRequiredForNouns: false },
    };
    expect(validateLanguagePack(ok)).toBe(true);
  });

  // Unsatisfiable: no article could ever pass, so every noun would fail.
  it('throws when articles is empty but articleRequiredForNouns is true', () => {
    const bad = {
      ...validPack,
      grammar: { ...validPack.grammar, articles: [], articleRequiredForNouns: true },
    };
    expect(() => validateLanguagePack(bad)).toThrow(/articleRequiredForNouns/);
  });

  it('throws when articleRequiredForNouns is not a boolean', () => {
    const bad = {
      ...validPack,
      grammar: { ...validPack.grammar, articleRequiredForNouns: 'yes' },
    };
    expect(() => validateLanguagePack(bad)).toThrow(/articleRequiredForNouns/);
  });

  it('throws when an auxiliary maps to a non-string', () => {
    const bad = { ...validPack, grammar: { ...validPack.grammar, auxiliaries: { haber: 1 } } };
    expect(() => validateLanguagePack(bad)).toThrow(/grammar\.auxiliaries/);
  });

  it('throws when personKeys is empty', () => {
    const bad = { ...validPack, grammar: { ...validPack.grammar, personKeys: [] } };
    expect(() => validateLanguagePack(bad)).toThrow(/grammar\.personKeys/);
  });

  // The silent one: a displayPerson outside personKeys does not throw at render
  // time, it just makes the conjugation row vanish from the vocab card.
  it('throws when displayPerson is not one of personKeys', () => {
    const bad = { ...validPack, grammar: { ...validPack.grammar, displayPerson: 'nosotros' } };
    expect(() => validateLanguagePack(bad)).toThrow(/displayPerson/);
  });

  it('throws when a verb label is missing', () => {
    const bad = {
      ...validPack,
      grammar: { ...validPack.grammar, labels: { perfect: 'Pretérito perfecto' } },
    };
    expect(() => validateLanguagePack(bad)).toThrow(/grammar\.labels\.participle/);
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

  it('throws when theme is missing', () => {
    const { theme: _t, ...noTheme } = validPack;
    expect(() => validateLanguagePack(noTheme)).toThrow(/theme/);
  });

  it('throws naming the missing theme field', () => {
    expect(() =>
      validateLanguagePack({
        ...validPack,
        theme: { ...validTheme, accent: { ...validTheme.accent, fill: undefined } },
      })
    ).toThrow(/theme\.accent\.fill/);

    expect(() =>
      validateLanguagePack({
        ...validPack,
        theme: {
          ...validTheme,
          font: { ...validTheme.font, families: undefined },
        },
      })
    ).toThrow(/theme\.font\.families/);

    expect(() =>
      validateLanguagePack({
        ...validPack,
        theme: {
          ...validTheme,
          accentAlt: {
            ...validTheme.accentAlt,
            fill: { light: '#C92A2A' },
          },
        },
      })
    ).toThrow(/theme\.accentAlt\.fill\.dark/);
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
  it('accepts an example with a null English translation', () => {
    expect(
      validateLexiconEntry({
        ...validNoun,
        examples: [{ de: 'Ich esse Brot.', en: null, source: 'wiktionary' }],
      })
    ).toBe(true);
  });
  it('throws when an example has an empty-string en', () => {
    expect(() =>
      validateLexiconEntry({
        ...validNoun,
        examples: [{ de: 'Ich esse Brot.', en: '', source: 'wiktionary' }],
      })
    ).toThrow(/example/);
  });
  it('throws when an example has no de', () => {
    expect(() =>
      validateLexiconEntry({
        ...validNoun,
        examples: [{ de: '', en: 'I eat bread.', source: 'wiktionary' }],
      })
    ).toThrow(/example/);
  });
});
