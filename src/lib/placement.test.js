import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ITEMS_PER_BAND,
  PASS_THRESHOLD,
  PLACEMENT_BANDS,
  buildPlacementItems,
  gradeItem,
  classifyBands,
  scorePlacement,
  applyPlacement,
  readPlacement,
} from './placement';
import { LEVEL_CHANGE_EVENT, getUserLevel, hasStoredLevel } from './levelPref';
import { loadState } from './storage';
import { activePack } from '../packs';

vi.mock('./settingsStamp', () => ({ stampLevel: vi.fn(), stampSettings: vi.fn() }));
import { stampLevel } from './settingsStamp';

const tiles = {
  en: 'I drink water.',
  de: 'Ich trinke Wasser.',
  words: ['Ich', 'trinke', 'Wasser.'],
  distractors: ['esse', 'laufe'],
  note: 'SVO',
};
const blanks = {
  en: 'I have a big dog.',
  de: 'Ich habe einen großen Hund.',
  template: 'Ich habe ___ ___ Hund.',
  blanks: [
    { word: 'einen', distractors: ['ein', 'eine'] },
    { word: 'großen', distractors: ['große', 'großes'] },
  ],
  note: 'accusative',
};
const choiceA = { en: 'If I had more time.', de: 'Wenn ich mehr Zeit hätte.', note: 'KII' };
const choiceB = { en: 'She told me.', de: 'Sie sagte mir.', note: 'indirect' };
const choiceC = {
  en: 'He has been living here.',
  de: 'Er wohnt seit drei Jahren hier.',
  note: 'seit',
};
const choiceD = { en: 'Despite the rain.', de: 'Trotz des Regens.', note: 'trotz' };

const pack = {
  content: {
    translateSentences: {
      A1: [tiles, tiles, tiles, tiles],
      A2: [blanks, blanks, blanks],
      B1: [choiceA, choiceB, choiceC, choiceD],
    },
  },
};

describe('buildPlacementItems', () => {
  it('takes three items from each CEFR bank, in a1 → a2 → b1 order', () => {
    const items = buildPlacementItems(pack);
    expect(items).toHaveLength(ITEMS_PER_BAND * PLACEMENT_BANDS.length);
    expect(items.map((i) => i.band)).toEqual([
      'a1',
      'a1',
      'a1',
      'a2',
      'a2',
      'a2',
      'b1',
      'b1',
      'b1',
    ]);
    expect(items.filter((i) => i.kind === 'tiles')).toHaveLength(3);
    expect(items.filter((i) => i.kind === 'blanks')).toHaveLength(3);
    expect(items.filter((i) => i.kind === 'choice')).toHaveLength(3);
  });

  it('is stable: the same pack yields the same ids and answers', () => {
    const a = buildPlacementItems(pack);
    const b = buildPlacementItems(pack);
    expect(a.map((i) => i.id)).toEqual(b.map((i) => i.id));
    expect(a.filter((i) => i.kind === 'choice').map((i) => i.answer)).toEqual([
      choiceA.de,
      choiceB.de,
      choiceC.de,
    ]);
  });

  it('accepts lowercase bank keys as well as the pack’s uppercase ones', () => {
    const lower = {
      content: { translateSentences: { a1: [tiles], a2: [blanks], b1: [choiceA] } },
    };
    const items = buildPlacementItems(lower);
    expect(items.map((i) => i.kind)).toEqual(['tiles', 'blanks', 'choice']);
  });

  it('builds from the live de pack without inventing content', () => {
    const items = buildPlacementItems(activePack);
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].prompt).toBe(activePack.content.translateSentences.A1[0].en);
    expect(items.find((i) => i.kind === 'blanks').template).toBe(
      activePack.content.translateSentences.A2[0].template
    );
    expect(items.find((i) => i.kind === 'choice').answer).toBe(
      activePack.content.translateSentences.B1[0].de
    );
  });
});

describe('gradeItem', () => {
  const items = buildPlacementItems(pack);
  const tile = items[0];
  const blank = items[3];
  const choice = items[6];

  it('accepts a correctly assembled tile sentence', () => {
    expect(gradeItem(tile, 'Ich trinke Wasser.')).toBe(true);
  });

  it('rejects a tile sentence in the wrong order', () => {
    expect(gradeItem(tile, 'trinke Ich Wasser.')).toBe(false);
  });

  it('accepts correctly filled blanks', () => {
    expect(gradeItem(blank, ['einen', 'großen'])).toBe(true);
  });

  it('rejects a blank with the wrong article', () => {
    expect(gradeItem(blank, ['ein', 'großen'])).toBe(false);
  });

  it('accepts the correct multiple-choice option', () => {
    expect(gradeItem(choice, choiceA.de)).toBe(true);
  });

  it('rejects a distractor', () => {
    expect(gradeItem(choice, choiceB.de)).toBe(false);
  });

  it('rejects missing or malformed answers rather than throwing', () => {
    expect(gradeItem(tile, null)).toBe(false);
    expect(gradeItem(blank, 'einen')).toBe(false);
    expect(gradeItem(choice, undefined)).toBe(false);
    expect(gradeItem(null, 'x')).toBe(false);
  });
});

describe('classifyBands', () => {
  it(`needs ${PASS_THRESHOLD} of ${ITEMS_PER_BAND} in a band to pass it`, () => {
    expect(classifyBands({ a1: 1, a2: 3, b1: 3 })).toBe('a1');
    expect(classifyBands({ a1: 2, a2: 1, b1: 3 })).toBe('a1');
    expect(classifyBands({ a1: 2, a2: 2, b1: 1 })).toBe('a2');
    expect(classifyBands({ a1: 2, a2: 2, b1: 2 })).toBe('b1');
    expect(classifyBands({ a1: 3, a2: 3, b1: 3 })).toBe('b1');
  });

  it('defaults to a1 when nothing has been answered', () => {
    expect(classifyBands({})).toBe('a1');
    expect(classifyBands({ a1: 0, a2: 0, b1: 0 })).toBe('a1');
  });
});

describe('scorePlacement', () => {
  const items = buildPlacementItems(pack);

  it('tallies per band and classifies', () => {
    // Pass A1 and A2, fail B1 → a2
    const verdicts = [true, true, false, true, true, false, false, false, true];
    const score = scorePlacement(items, verdicts);
    expect(score).toEqual({
      correct: 5,
      total: 9,
      bands: { a1: 2, a2: 2, b1: 1 },
      level: 'a2',
    });
  });

  it('places B1 only when every band passes', () => {
    const verdicts = [true, true, true, true, true, true, true, true, false];
    expect(scorePlacement(items, verdicts).level).toBe('b1');
  });
});

describe('applyPlacement / readPlacement', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('writes the CEFR code through setUserLevel and stamps the level clock', () => {
    const seen = [];
    const onChange = (e) => seen.push(e.detail.level);
    window.addEventListener(LEVEL_CHANGE_EVENT, onChange);
    const level = applyPlacement(
      { correct: 8, total: 9, bands: { a1: 3, a2: 3, b1: 2 }, level: 'b1' },
      { now: 1_700_000_000_000 }
    );
    window.removeEventListener(LEVEL_CHANGE_EVENT, onChange);

    expect(level).toBe('b1');
    expect(getUserLevel()).toBe('b1');
    expect(hasStoredLevel()).toBe(true);
    expect(localStorage.getItem('deutsch-level')).toBe('b1');
    expect(stampLevel).toHaveBeenCalled();
    expect(seen).toEqual(['b1']);
    expect(readPlacement()).toEqual({
      takenAt: 1_700_000_000_000,
      source: 'placement',
      level: 'b1',
      correct: 8,
      total: 9,
      bands: { a1: 3, a2: 3, b1: 2 },
    });
    // Metadata lives on the existing blob, not a new localStorage key.
    expect(loadState().placement.level).toBe('b1');
    expect(localStorage.getItem('deutsch-app-state-v1')).toBeTruthy();
  });

  it('rejects an unknown classified level without writing metadata', () => {
    expect(applyPlacement({ correct: 0, total: 9, bands: {}, level: 'c2' })).toBeNull();
    expect(hasStoredLevel()).toBe(false);
    expect(readPlacement()).toBeNull();
  });
});
