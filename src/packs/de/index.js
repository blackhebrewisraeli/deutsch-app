// German LanguagePack. Content is assembled from the rich lexicon + deck
// definitions via the resolver; alphabet/scenarios/chat/translate still come
// straight from content.js.
import {
  ALPHABET,
  ALPHABET_QUIZ_GROUPS,
  SCENARIOS,
  CHAT_TASKS,
  TRANSLATE_SENTENCES_A1,
  TRANSLATE_SENTENCES_A2,
  TRANSLATE_SENTENCES_B1,
} from '../../data/content';
import { LEXICON } from './lexicon';
import { DECKS } from './decks';
import { resolveDecks } from '../resolve';
import { theme } from './theme';

// Card identity for German: the surface form is the stable id.
const cardId = (card) => card.de;

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
    lexicon: LEXICON,
    deckDefs: DECKS,
    decks: resolveDecks(DECKS, LEXICON),
    scenarios: SCENARIOS,
    chatTasks: CHAT_TASKS,
    translateSentences: {
      A1: TRANSLATE_SENTENCES_A1,
      A2: TRANSLATE_SENTENCES_A2,
      B1: TRANSLATE_SENTENCES_B1,
    },
  },
  validation: {
    // Keyboard substitutions German itself defines for keyboards lacking the
    // characters. Deliberately NOT stripCombiningMarks: folding marks to bare
    // vowels would collapse schön/schon, Bär/Bar and Würde/Wurde into false
    // matches. Maße/Masse does collapse under ß→ss — an accepted cost, since a
    // US keyboard cannot type Maße at all.
    target: {
      trim: true,
      caseFold: true,
      stripCombiningMarks: false,
      replacements: [
        ['ß', 'ss'],
        ['ä', 'ae'],
        ['ö', 'oe'],
        ['ü', 'ue'],
      ],
    },
  },
  grammar: {},
  prompts: {},
  theme,
};
