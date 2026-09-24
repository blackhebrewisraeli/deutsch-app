import { describe, it, expect } from 'vitest';
import {
  INPUT_MODES,
  STAGES,
  defaultInputMode,
  startingStage,
  advance,
  parseScaffold,
  gapParts,
} from './chatInputModes';

const { WORD_BANK, CHOICE_BLANK, TYPED_BLANK, FREE_TEXT } = INPUT_MODES;

const next = {
  de: 'Ich möchte einen Kaffee, bitte.',
  en: "I'd like a coffee, please.",
  blank: 'Kaffee',
  distractors: ['Tee', 'Wasser'],
};

describe('defaultInputMode (mock)', () => {
  it.each([
    ['A1', WORD_BANK],
    ['B1', FREE_TEXT],
  ])('%s starts in %s', (level, mode) => {
    expect(defaultInputMode(level)).toBe(mode);
  });
});

describe('STAGES', () => {
  it('orders the ladder from most to least support', () => {
    expect(STAGES).toEqual([WORD_BANK, CHOICE_BLANK, TYPED_BLANK, FREE_TEXT]);
  });
});

describe('startingStage', () => {
  it.each([
    ['a1', WORD_BANK],
    ['A1', WORD_BANK],
    ['a2', CHOICE_BLANK],
    ['b1', TYPED_BLANK],
    ['B1', TYPED_BLANK],
    [undefined, WORD_BANK],
    ['c2', WORD_BANK],
  ])('%s starts at %s', (level, stage) => {
    expect(startingStage(level)).toBe(stage);
  });
});

describe('advance', () => {
  const at = (stage, streak = 0) => ({ stage, streak });

  it('counts a first clean turn without moving', () => {
    expect(advance(at(WORD_BANK), false)).toEqual({ stage: WORD_BANK, streak: 1, moved: null });
  });

  it('moves up one stage after two clean turns in a row', () => {
    expect(advance(at(WORD_BANK, 1), false)).toEqual({
      stage: CHOICE_BLANK,
      streak: 0,
      moved: 'up',
    });
  });

  it('moves down one stage after two corrected turns in a row', () => {
    expect(advance(at(TYPED_BLANK, -1), true)).toEqual({
      stage: CHOICE_BLANK,
      streak: 0,
      moved: 'down',
    });
  });

  it('restarts the streak when the direction flips', () => {
    expect(advance(at(CHOICE_BLANK, 1), true)).toEqual({
      stage: CHOICE_BLANK,
      streak: -1,
      moved: null,
    });
    expect(advance(at(CHOICE_BLANK, -1), false)).toEqual({
      stage: CHOICE_BLANK,
      streak: 1,
      moved: null,
    });
  });

  it('stays at the ends of the ladder', () => {
    expect(advance(at(FREE_TEXT, 1), false)).toEqual({ stage: FREE_TEXT, streak: 0, moved: null });
    expect(advance(at(WORD_BANK, -1), true)).toEqual({ stage: WORD_BANK, streak: 0, moved: null });
  });
});

describe('parseScaffold', () => {
  it('splits the line into tokens and finds the blank through punctuation', () => {
    expect(parseScaffold(next)).toEqual({
      en: "I'd like a coffee, please.",
      tokens: ['Ich', 'möchte', 'einen', 'Kaffee,', 'bitte.'],
      blankIndex: 3,
      answer: 'Kaffee',
      distractors: ['Tee', 'Wasser'],
    });
  });

  it('matches the blank case-insensitively and keeps the sentence casing', () => {
    const s = parseScaffold({ ...next, blank: 'ich' });
    expect(s.blankIndex).toBe(0);
    expect(s.answer).toBe('Ich');
  });

  it('de-duplicates and trims distractors', () => {
    expect(parseScaffold({ ...next, distractors: [' Tee', 'Tee', 'Wasser'] }).distractors).toEqual([
      'Tee',
      'Wasser',
    ]);
  });

  it('tolerates a missing English line', () => {
    expect(parseScaffold({ ...next, en: undefined }).en).toBe('');
  });

  it.each([
    ['no suggestion', undefined],
    ['a string', 'Ich möchte'],
    ['an empty line', { ...next, de: '  ' }],
    ['an empty blank', { ...next, blank: '' }],
    ['a blank not in the line', { ...next, blank: 'Milch' }],
    ['a multi-word blank', { ...next, blank: 'einen Kaffee' }],
    ['no distractors', { ...next, distractors: [] }],
    ['distractors that are not an array', { ...next, distractors: 'Tee' }],
    ['a non-string distractor', { ...next, distractors: ['Tee', 3] }],
    ['a distractor equal to the answer', { ...next, distractors: ['kaffee', 'Tee'] }],
  ])('rejects %s', (_, input) => {
    expect(parseScaffold(input)).toBeNull();
  });
});

describe('gapParts', () => {
  it('splits the sentence around the gap, keeping punctuation outside it', () => {
    expect(gapParts(parseScaffold(next))).toEqual({
      before: 'Ich möchte einen ',
      after: ', bitte.',
    });
  });

  it('handles a gap at the start and at the end', () => {
    expect(gapParts(parseScaffold({ ...next, blank: 'Ich' }))).toEqual({
      before: '',
      after: ' möchte einen Kaffee, bitte.',
    });
    expect(
      gapParts(parseScaffold({ ...next, de: 'Einen Kaffee, bitte.', blank: 'bitte' }))
    ).toEqual({ before: 'Einen Kaffee, ', after: '.' });
  });
});
