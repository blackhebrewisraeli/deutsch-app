import { describe, it, expect } from 'vitest';
import { activePack, getPack } from './index';
import { validateLanguagePack } from './validate';
import { normalizeText } from '../lib/textRules';
import { ALPHABET, ALPHABET_QUIZ_GROUPS } from './de/alphabet';
import { SCENARIOS } from './de/scenarios';
import { CHAT_TASKS } from './de/chatTasks';
import { TRANSLATE_SENTENCES_A1 } from './de/translate';
import { LEXICON } from './de/lexicon';
import { DECKS } from './de/decks';

describe('activePack', () => {
  it('satisfies the LanguagePack contract', () => {
    expect(validateLanguagePack(activePack)).toBe(true);
  });
  it('resolves the active pack through the registry, not a direct import', () => {
    expect(activePack).toBe(getPack('de'));
  });
  it('is German', () => {
    expect(activePack.meta.id).toBe('de');
    expect(activePack.meta.locale).toBe('de-DE');
    expect(activePack.meta.cefrLevels).toEqual(['A1', 'A2', 'B1']);
  });
  it('wires alphabet/scenarios/chat straight from content.js', () => {
    expect(activePack.content.alphabet).toBe(ALPHABET);
    expect(activePack.content.scenarios).toBe(SCENARIOS);
    expect(activePack.content.chatTasks).toBe(CHAT_TASKS);
    expect(activePack.content.alphabetQuiz).toBe(ALPHABET_QUIZ_GROUPS);
    expect(activePack.content.translateSentences.A1).toBe(TRANSLATE_SENTENCES_A1);
  });
  it('resolves decks from the lexicon + deck defs', () => {
    expect(Object.keys(activePack.content.decks)).toEqual(Object.keys(DECKS));
    expect(activePack.content.lexicon).toBe(LEXICON);
    expect(activePack.content.deckDefs).toBe(DECKS);
  });
  it('preserves legacy surface-form ids on resolved cards (SRS continuity)', () => {
    const food = activePack.content.decks.food;
    expect(food[0].id).toBe('das Brot');
    expect(food[0].de).toBe('das Brot'); // display form
    expect(food[0].en).toBe('bread'); // primary gloss as a string
  });
  it('ships target text rules that fold keyboard substitutions', () => {
    const norm = (s) => normalizeText(s, activePack.validation.target);
    expect(norm('  Groß  ')).toBe('gross');
    expect(norm('schön')).not.toBe(norm('schon'));
  });
  it('is resolvable by id via getPack', () => {
    expect(getPack('de')).toBe(activePack);
  });
});

describe('cardId + tagged decks', () => {
  it('cardId returns the German surface form', () => {
    expect(activePack.cardId({ de: 'der Hund', en: 'dog' })).toBe('der Hund');
  });
  it('preset deck cards carry an id equal to the display de', () => {
    const card = activePack.content.decks.greetings[0];
    expect(card.id).toBe(card.de);
  });
});
