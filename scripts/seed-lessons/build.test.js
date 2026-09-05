import { describe, it, expect } from 'vitest';
import { DECKS } from '../../src/packs/de/decks.js';
import { ALPHABET, ALPHABET_QUIZ_GROUPS } from '../../src/packs/de/alphabet.js';
import {
  TRANSLATE_SENTENCES_A1,
  TRANSLATE_SENTENCES_A2,
  TRANSLATE_SENTENCES_B1,
} from '../../src/packs/de/translate.js';
import { SCENARIOS } from '../../src/packs/de/scenarios.js';
import { CHAT_TASKS } from '../../src/packs/de/chatTasks.js';
import { buildLessons } from './build.js';

const A2_BLANK_COUNT = TRANSLATE_SENTENCES_A2.reduce((n, s) => n + s.blanks.length, 0);
const CHAT_EXERCISE_COUNT = SCENARIOS.reduce(
  (n, scenario) =>
    n +
    ['a1', 'a2', 'b1'].reduce(
      (inner, level) => inner + (CHAT_TASKS[scenario.id][level] ?? []).length,
      0
    ),
  0
);

function byTab(lessons, tab) {
  return lessons.filter((l) => l.tab === tab);
}

function allExercises(lessons) {
  return lessons.flatMap((l) =>
    l.exercises.map((ex) => [`${l.level}/${l.tab}/${l.unit_number}/${ex.id}`, ex])
  );
}

describe('buildLessons — inventory', () => {
  it('emits only curated static content: no auto-deck or imported-lexicon units', () => {
    const lessons = buildLessons();
    const vocab = byTab(lessons, 'vocab');
    expect(vocab).toHaveLength(Object.keys(DECKS).length);
    expect(vocab.every((l) => l.level === 'a1')).toBe(true);
    expect(vocab.reduce((n, l) => n + l.exercises.length, 0)).toBe(
      Object.values(DECKS).reduce((n, d) => n + d.cardIds.length, 0)
    );
  });

  it('covers alphabet, translate, and chat from the authored pack modules', () => {
    const lessons = buildLessons();
    const alphabet = byTab(lessons, 'alphabet');
    expect(alphabet).toHaveLength(2);
    expect(alphabet.every((l) => l.level === 'a1')).toBe(true);
    expect(alphabet.find((l) => l.unit_number === 1).exercises).toHaveLength(ALPHABET.length);
    expect(alphabet.find((l) => l.unit_number === 2).exercises).toHaveLength(
      ALPHABET_QUIZ_GROUPS.length
    );

    expect(byTab(lessons, 'translate')).toHaveLength(3);
    expect(lessons.find((l) => l.tab === 'translate' && l.level === 'a1').exercises).toHaveLength(
      TRANSLATE_SENTENCES_A1.length
    );
    expect(lessons.find((l) => l.tab === 'translate' && l.level === 'a2').exercises).toHaveLength(
      A2_BLANK_COUNT
    );
    expect(lessons.find((l) => l.tab === 'translate' && l.level === 'b1').exercises).toHaveLength(
      TRANSLATE_SENTENCES_B1.length
    );

    const chat = byTab(lessons, 'chat');
    expect(chat).toHaveLength(SCENARIOS.length * 3);
    expect(chat.reduce((n, l) => n + l.exercises.length, 0)).toBe(CHAT_EXERCISE_COUNT);
  });
});

describe('buildLessons — payload shapes the shipped renderers read', () => {
  it('maps a curated vocab card onto flashcard { term, glosses, ipa, example? }', () => {
    const greetings = buildLessons().find((l) => l.tab === 'vocab' && l.unit_number === 1);
    expect(greetings.exercises[0]).toEqual({
      id: 'vocab-greetings-hallo',
      type: 'flashcard',
      payload: {
        term: 'Hallo',
        glosses: ['Hello'],
        ipa: '[ˈhalo]',
      },
    });

    const food = buildLessons().find((l) => l.tab === 'vocab' && l.unit_number === 2);
    const brot = food.exercises.find((ex) => ex.id === 'vocab-food-das-brot');
    expect(brot.type).toBe('flashcard');
    expect(brot.payload.term).toBe('das Brot');
    expect(brot.payload.glosses).toEqual(['bread']);
    expect(brot.payload.example).toBe('Ich esse Brot.');
  });

  it('maps alphabet letters to flashcards and quiz groups to multiple-choice', () => {
    const letters = buildLessons().find((l) => l.tab === 'alphabet' && l.unit_number === 1);
    expect(letters.exercises[0]).toMatchObject({
      id: 'alpha-letter-a',
      type: 'flashcard',
      payload: { term: 'A', glosses: ['Apfel — apple'] },
    });

    const quiz = buildLessons().find((l) => l.tab === 'alphabet' && l.unit_number === 2);
    const first = quiz.exercises[0];
    expect(first.type).toBe('multiple-choice');
    expect(first.payload.question).toContain('Uhr');
    expect(first.payload.choices).toEqual(['U', 'Ü', 'O', 'Ö']);
    expect(first.payload.answer).toBe('U');
  });

  it('maps A1/B1 translate banks to typed translate and A2 blanks to multiple-choice', () => {
    const a1 = buildLessons().find((l) => l.tab === 'translate' && l.level === 'a1');
    expect(a1.exercises[0]).toEqual({
      id: 'tr-a1-1',
      type: 'translate',
      payload: {
        prompt: 'I drink water.',
        accepted: ['Ich trinke Wasser.', 'Ich trinke Wasser'],
        direction: 'en-de',
      },
    });

    const a2 = buildLessons().find((l) => l.tab === 'translate' && l.level === 'a2');
    expect(a2.exercises[0]).toMatchObject({
      id: 'tr-a2-1-blank-1',
      type: 'multiple-choice',
      payload: {
        choices: ['einen', 'ein', 'eine'],
        answer: 'einen',
      },
    });
    expect(a2.exercises[0].payload.question).toContain('Ich habe ___ ___ Hund.');
    expect(a2.exercises[0].payload.question).toContain('I have a big dog.');

    const b1 = buildLessons().find((l) => l.tab === 'translate' && l.level === 'b1');
    expect(b1.exercises[0].type).toBe('translate');
    expect(b1.exercises[0].payload.prompt).toBe(
      'Yesterday I went to the market and bought vegetables.'
    );
    expect(b1.exercises[0].payload.accepted).toContain(
      'Gestern bin ich zum Markt gegangen und habe Gemüse gekauft.'
    );
    expect(b1.exercises[0].payload.direction).toBe('en-de');
  });

  it('maps each chat task to { initialMessage, persona } using the scenario greeting', () => {
    const freeA1 = buildLessons().find(
      (l) => l.tab === 'chat' && l.level === 'a1' && l.unit_number === 1
    );
    expect(freeA1.exercises[0]).toMatchObject({
      id: 'chat-free-a1-1',
      type: 'chat',
      payload: {
        persona: 'Free Chat',
      },
    });
    expect(freeA1.exercises[0].payload.initialMessage).toContain(
      'Hallo! Womit möchtest du heute üben?'
    );
    expect(freeA1.exercises[0].payload.initialMessage).toContain(
      'Say hello and tell Anna your name.'
    );
  });
});

describe('buildLessons — table contract', () => {
  it('gives every row the lessons CHECK fields and globally unique exercise ids', () => {
    const lessons = buildLessons();
    for (const l of lessons) {
      expect(l.pack_id).toBe('de');
      expect(l.course_code).toBe('de');
      expect(['a1', 'a2', 'b1']).toContain(l.level);
      expect(['chat', 'alphabet', 'vocab', 'translate']).toContain(l.tab);
      expect(l.unit_number).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(l.exercises)).toBe(true);
      expect(l.exercises.length).toBeGreaterThan(0);
    }
    const ids = allExercises(lessons).map(([, ex]) => ex.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
