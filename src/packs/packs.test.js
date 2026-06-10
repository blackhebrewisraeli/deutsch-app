import { describe, it, expect } from 'vitest';
import { activePack, getPack } from './index';
import { validateLanguagePack } from './validate';
import {
  ALPHABET,
  PRESET_DECKS,
  SCENARIOS,
  CHAT_TASKS,
  TRANSLATE_SENTENCES_A1,
  ALPHABET_QUIZ_GROUPS,
} from '../data/content';

describe('activePack', () => {
  it('satisfies the LanguagePack contract', () => {
    expect(validateLanguagePack(activePack)).toBe(true);
  });
  it('is German', () => {
    expect(activePack.meta.id).toBe('de');
    expect(activePack.meta.locale).toBe('de-DE');
    expect(activePack.meta.cefrLevels).toEqual(['A1', 'A2', 'B1']);
  });
  it('wires content straight from content.js (same references; decks are id-tagged copies)', () => {
    expect(activePack.content.alphabet).toBe(ALPHABET);
    // decks are derived from PRESET_DECKS: same keys, same card data, plus an id.
    expect(Object.keys(activePack.content.decks)).toEqual(Object.keys(PRESET_DECKS));
    for (const [deckId, deck] of Object.entries(PRESET_DECKS)) {
      expect(activePack.content.decks[deckId]).toEqual(
        deck.map((card) => ({ ...card, id: card.de }))
      );
    }
    expect(activePack.content.scenarios).toBe(SCENARIOS);
    expect(activePack.content.chatTasks).toBe(CHAT_TASKS);
    expect(activePack.content.alphabetQuiz).toBe(ALPHABET_QUIZ_GROUPS);
    expect(activePack.content.translateSentences.A1).toBe(TRANSLATE_SENTENCES_A1);
  });
  it('ships a Phase-0 normalize equal to trim+lowercase', () => {
    expect(activePack.validation.normalize('  Groß  ')).toBe('groß');
  });
  it('is resolvable by id via getPack', () => {
    expect(getPack('de')).toBe(activePack);
  });
});

describe('cardId + tagged decks', () => {
  it('cardId returns the German surface form', () => {
    expect(activePack.cardId({ de: 'der Hund', en: 'dog' })).toBe('der Hund');
  });
  it('preset deck cards carry an id equal to de', () => {
    const card = activePack.content.decks.greetings[0];
    expect(card.id).toBe(card.de);
  });
});
