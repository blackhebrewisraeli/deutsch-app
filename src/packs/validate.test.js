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
