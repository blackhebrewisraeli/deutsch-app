// German LanguagePack. Content is assembled from the rich lexicon + deck
// definitions via the resolver; alphabet/scenarios/chat/translate live in
// sibling modules in this folder.
import { ALPHABET, ALPHABET_QUIZ_GROUPS } from './alphabet.js';
import { SCENARIOS } from './scenarios.js';
import { CHAT_TASKS } from './chatTasks.js';
import {
  TRANSLATE_SENTENCES_A1,
  TRANSLATE_SENTENCES_A2,
  TRANSLATE_SENTENCES_B1,
} from './translate.js';
import { LEXICON } from './lexicon.js';
import { DECKS } from './decks.js';
import { MISSIONS, MISSIONS_CHROME } from './missions.js';
import { QUESTS, QUESTS_CHROME } from './quests.js';
import { IDENTITY } from './identity.js';
import { HOME_CHROME } from './home.js';
import { LESSON_CHROME } from './lessons.js';
import { resolveDecks } from '../resolve.js';
import { theme } from './theme.js';
import { grammar } from './grammar.js';

// Card identity for German: the surface form is the stable id.
const cardId = (card) => card.de;

export const dePack = {
  meta: {
    id: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    locale: 'de-DE',
    // The Web Speech API exposes no quality or novelty flag, so the only stable
    // handle is the voice NAME. Without this, speak() takes whatever `.find`
    // hits first, which on macOS is a novelty voice ("Eddy") while the standard
    // German voice ("Anna") sits last in the list. Best first; an absent name is
    // skipped.
    voicePreference: ['Anna', 'Markus', 'Petra', 'Yannick', 'Helena'],
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
    decks: resolveDecks(DECKS, LEXICON, grammar),
    scenarios: SCENARIOS,
    chatTasks: CHAT_TASKS,
    translateSentences: {
      A1: TRANSLATE_SENTENCES_A1,
      A2: TRANSLATE_SENTENCES_A2,
      B1: TRANSLATE_SENTENCES_B1,
    },
    // Copy for the Home missions board. lib/missions.js returns ids and counts;
    // this turns them into words, so no German reaches src/lib or src/components.
    missions: MISSIONS,
    missionsChrome: MISSIONS_CHROME,
    // Copy for the Home daily-quest board. lib/quests.js returns ids, targets
    // and progress; this turns them into words.
    quests: QUESTS,
    questsChrome: QUESTS_CHROME,
    // Copy for the Home personal hub — month names and greetings are
    // language, not layout.
    identity: IDENTITY,
    // Copy for Home's own chrome: the promoted quick-action heading and its
    // fallback rows, and the heading that groups the two open-task boards.
    homeChrome: HOME_CHROME,
    lessonChrome: LESSON_CHROME,
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
