// German LanguagePack. Phase 0: wires content straight from the existing
// content.js. validation/grammar/prompts are declared per the contract and
// populated in Phase 1.
import {
  ALPHABET,
  ALPHABET_QUIZ_GROUPS,
  PRESET_DECKS,
  SCENARIOS,
  CHAT_TASKS,
  TRANSLATE_SENTENCES_A1,
  TRANSLATE_SENTENCES_A2,
  TRANSLATE_SENTENCES_B1,
} from '../../data/content';

// Card identity for German: the surface form is the stable id (Phase 1, sub-project 1).
const cardId = (card) => card.de;
const tagDeck = (deck) => deck.map((card) => ({ ...card, id: cardId(card) }));
const tagDecks = (decks) =>
  Object.fromEntries(Object.entries(decks).map(([id, deck]) => [id, tagDeck(deck)]));

export const dePack = {
  meta: {
    id: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    locale: 'de-DE',
    direction: 'ltr',
    flag: '🇩🇪',
    themeId: 'de',
    cefrLevels: ['A1', 'A2', 'B1'],
  },
  cardId,
  content: {
    alphabet: ALPHABET,
    alphabetQuiz: ALPHABET_QUIZ_GROUPS,
    decks: tagDecks(PRESET_DECKS),
    scenarios: SCENARIOS,
    chatTasks: CHAT_TASKS,
    translateSentences: {
      A1: TRANSLATE_SENTENCES_A1,
      A2: TRANSLATE_SENTENCES_A2,
      B1: TRANSLATE_SENTENCES_B1,
    },
  },
  // Phase 0: reproduces today's behavior (trim + lowercase). Phase 1 adds the
  // real ß/ä/ö/ü diacritic policy.
  validation: {
    normalize: (s) => s.trim().toLowerCase(),
    // accepts is optional; engine default = normalize-then-equals.
  },
  grammar: {}, // Phase 1
  prompts: {}, // Phase 1
};
