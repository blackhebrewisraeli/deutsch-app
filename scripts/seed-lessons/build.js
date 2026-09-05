// Transform the authored German pack modules into `lessons` rows.
//
// Scope is the curated static modules only — DECKS, ALPHABET, translate
// banks, SCENARIOS + CHAT_TASKS. AUTO_DECKS and the imported lexicon stay
// out: those are views over thousands of cards, not a static seed.
//
// Payload keys follow the shipped renderers in src/components/exercises,
// not the original spec §5.3 sketches.

import { DECKS } from '../../src/packs/de/decks.js';
import { LEXICON } from '../../src/packs/de/lexicon.js';
import { grammar } from '../../src/packs/de/grammar.js';
import { ALPHABET, ALPHABET_QUIZ_GROUPS } from '../../src/packs/de/alphabet.js';
import {
  TRANSLATE_SENTENCES_A1,
  TRANSLATE_SENTENCES_A2,
  TRANSLATE_SENTENCES_B1,
} from '../../src/packs/de/translate.js';
import { SCENARIOS } from '../../src/packs/de/scenarios.js';
import { CHAT_TASKS } from '../../src/packs/de/chatTasks.js';
import { resolveDecks } from '../../src/packs/resolve.js';

const PACK = { pack_id: 'de', course_code: 'de' };

export function slug(value) {
  return String(value)
    .replace(/ß/g, 'ss')
    .replace(/ä/gi, 'ae')
    .replace(/ö/gi, 'oe')
    .replace(/ü/gi, 'ue')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function lesson(level, tab, unit_number, exercises) {
  return { ...PACK, level, tab, unit_number, exercises };
}

function flashcard(id, { term, glosses, ipa, example }) {
  const payload = { term, glosses };
  if (ipa) payload.ipa = ipa;
  if (example) payload.example = example;
  return { id, type: 'flashcard', payload };
}

function acceptedForms(text) {
  const trimmed = String(text).trim();
  const stripped = trimmed.replace(/[.?!]+$/u, '').trim();
  return stripped && stripped !== trimmed ? [trimmed, stripped] : [trimmed];
}

function vocabUnits() {
  const decks = resolveDecks(DECKS, LEXICON, grammar);
  return Object.entries(decks).map(([deckId, cards], index) =>
    lesson(
      'a1',
      'vocab',
      index + 1,
      cards.map((card) =>
        flashcard(`vocab-${deckId}-${slug(card.id)}`, {
          term: card.de,
          glosses: card.glosses,
          ipa: card.ipa,
          example: Array.isArray(card.examples) ? card.examples[0]?.de : undefined,
        })
      )
    )
  );
}

function alphabetUnits() {
  const letters = lesson(
    'a1',
    'alphabet',
    1,
    ALPHABET.map((entry) =>
      flashcard(`alpha-letter-${slug(entry.l)}`, {
        term: entry.l,
        glosses: [`${entry.w} — ${entry.e}`],
      })
    )
  );

  const byLetter = Object.fromEntries(ALPHABET.map((entry) => [entry.l, entry]));
  const quiz = lesson(
    'a1',
    'alphabet',
    2,
    ALPHABET_QUIZ_GROUPS.map((group, index) => {
      const target = group.letters[0];
      const sample = byLetter[target];
      return {
        id: `alpha-quiz-${index + 1}`,
        type: 'multiple-choice',
        payload: {
          question: `Welcher Buchstabe passt zu »${sample.w}«?`,
          choices: group.letters,
          answer: target,
        },
      };
    })
  );

  return [letters, quiz];
}

function translateTyped(level, sentences) {
  return lesson(
    level,
    'translate',
    1,
    sentences.map((sentence, index) => ({
      id: `tr-${level}-${index + 1}`,
      type: 'translate',
      payload: {
        prompt: sentence.en,
        accepted: acceptedForms(sentence.de),
        direction: 'en-de',
      },
    }))
  );
}

function translateA2() {
  const exercises = [];
  TRANSLATE_SENTENCES_A2.forEach((sentence, sentenceIndex) => {
    sentence.blanks.forEach((blank, blankIndex) => {
      exercises.push({
        id: `tr-a2-${sentenceIndex + 1}-blank-${blankIndex + 1}`,
        type: 'multiple-choice',
        payload: {
          question: `${sentence.template} (${sentence.en})`,
          choices: [blank.word, ...blank.distractors],
          answer: blank.word,
        },
      });
    });
  });
  return lesson('a2', 'translate', 1, exercises);
}

function chatUnits() {
  return SCENARIOS.flatMap((scenario, scenarioIndex) =>
    ['a1', 'a2', 'b1'].map((level) => {
      const tasks = CHAT_TASKS[scenario.id]?.[level] ?? [];
      return lesson(
        level,
        'chat',
        scenarioIndex + 1,
        tasks.map((task, index) => {
          const parts = [scenario.greeting.de, task.task];
          if (task.hint) parts.push(task.hint);
          return {
            id: `chat-${scenario.id}-${level}-${index + 1}`,
            type: 'chat',
            payload: {
              persona: scenario.name,
              initialMessage: parts.join('\n\n'),
            },
          };
        })
      );
    })
  );
}

export function buildLessons() {
  return [
    ...vocabUnits(),
    ...alphabetUnits(),
    translateTyped('a1', TRANSLATE_SENTENCES_A1),
    translateA2(),
    translateTyped('b1', TRANSLATE_SENTENCES_B1),
    ...chatUnits(),
  ];
}
