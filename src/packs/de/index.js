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
import { grammar } from './grammar';

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
  grammar,
  prompts: {
    persona: 'Anna',
    targetLanguage: 'German',

    // How the tutor speaks at each level. Lifted verbatim from the prompt that
    // lived in ChatTab. Keys are lowercase — that is what components hold.
    levels: {
      a1: 'The learner is A1 BEGINNER. Use very simple German, short sentences, common vocabulary only. Always provide English translation. Use lots of encouragement.',
      a2: 'The learner is A2 ELEMENTARY. Use natural but simple German. Provide English translation. Gently push them.',
      b1: 'The learner is B1 INTERMEDIATE. Use natural German, moderate complexity. Provide English translation but challenge them.',
    },

    // What a generated exercise should drill. A different question from
    // `levels`, so a separate map rather than one string hedging between both.
    exercises: {
      a1: 'A1 beginner (very simple sentences)',
      a2: 'A2 elementary (focus on articles and prepositions)',
      b1: 'B1 intermediate (complex grammar)',
    },

    // Concrete samples that teach the model the card shape.
    deck: {
      cardExample: 'der Hund',
      ipaExample: '[deːɐ̯ hʊnt]',
    },
  },
  theme,
};
