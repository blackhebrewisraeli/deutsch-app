import { describe, it, expect, beforeEach } from 'vitest';
import { setUserLevel } from './levelPref';
import {
  levelRank,
  allowedModes,
  isModeAllowed,
  clampMode,
  classifiedLevel,
  cefrOfDeckDef,
  isDeckAllowedForLevel,
  isDeckIdAllowed,
  filterCatalogByLevel,
} from './levelGate';

beforeEach(() => {
  localStorage.clear();
});

describe('allowedModes', () => {
  it.each([
    ['a1', ['a1']],
    ['a2', ['a1', 'a2']],
    ['b1', ['a1', 'a2', 'b1']],
  ])('%s may run %j', (classified, allowed) => {
    expect(allowedModes(classified)).toEqual(allowed);
  });

  it('treats junk classification as A1-only', () => {
    expect(allowedModes('c2')).toEqual(['a1']);
    expect(allowedModes(null)).toEqual(['a1']);
  });
});

describe('isModeAllowed / clampMode', () => {
  it('lets A2 run A1 tiles but not B1 typing', () => {
    expect(isModeAllowed('a1', 'a2')).toBe(true);
    expect(isModeAllowed('a2', 'a2')).toBe(true);
    expect(isModeAllowed('b1', 'a2')).toBe(false);
  });

  it('never promotes an A1 learner to a higher mode', () => {
    expect(clampMode('b1', 'a1')).toBe('a1');
    expect(clampMode('a2', 'a1')).toBe('a1');
    expect(clampMode('a1', 'a1')).toBe('a1');
  });

  it('keeps an allowed lower mode so B1 may still practise A1', () => {
    expect(clampMode('a1', 'b1')).toBe('a1');
    expect(clampMode('a2', 'b1')).toBe('a2');
    expect(clampMode('b1', 'b1')).toBe('b1');
  });

  it('falls back to classified when the request is junk', () => {
    expect(clampMode('nope', 'a2')).toBe('a2');
    expect(clampMode(undefined, 'b1')).toBe('b1');
  });

  it('reads the stored classification when the second arg is omitted', () => {
    setUserLevel('a1');
    expect(clampMode('b1')).toBe('a1');
    setUserLevel('b1');
    expect(clampMode('b1')).toBe('b1');
  });
});

describe('classifiedLevel', () => {
  it('returns the stored classification, not a lower requested mode', () => {
    expect(classifiedLevel('b1')).toBe('b1');
    expect(classifiedLevel('a2')).toBe('a2');
    expect(classifiedLevel('a1')).toBe('a1');
  });

  it('treats junk as a1', () => {
    expect(classifiedLevel('c2')).toBe('a1');
    expect(classifiedLevel(null)).toBe('a1');
  });

  it('reads the stored classification when the arg is omitted', () => {
    setUserLevel('a2');
    expect(classifiedLevel()).toBe('a2');
  });
});

describe('levelRank', () => {
  it('orders the three codes and treats junk as a1', () => {
    expect(levelRank('a1')).toBe(0);
    expect(levelRank('a2')).toBe(1);
    expect(levelRank('b1')).toBe(2);
    expect(levelRank('C2')).toBe(0);
  });
});

describe('deck CEFR tags', () => {
  const cefrB1 = { id: 'cefr-b1', auto: { by: 'cefr', level: 'B1' } };
  const artikelA1 = { id: 'artikel-a1', auto: { by: 'cefr', level: 'A1' } };
  const core100 = { id: 'core-100', auto: { by: 'top', count: 100 } };
  const catalog = [cefrB1, artikelA1, core100];

  it('reads auto.level case-insensitively and ignores unleveled decks', () => {
    expect(cefrOfDeckDef(cefrB1)).toBe('b1');
    expect(cefrOfDeckDef(artikelA1)).toBe('a1');
    expect(cefrOfDeckDef(core100)).toBeNull();
    expect(cefrOfDeckDef(undefined)).toBeNull();
  });

  it('lets an A1 learner use unleveled and A1 decks, not B1', () => {
    expect(isDeckAllowedForLevel(core100, 'a1')).toBe(true);
    expect(isDeckAllowedForLevel(artikelA1, 'a1')).toBe(true);
    expect(isDeckAllowedForLevel(cefrB1, 'a1')).toBe(false);
    expect(isDeckAllowedForLevel(cefrB1, 'b1')).toBe(true);
  });

  it('filters a catalog and looks up by id', () => {
    expect(filterCatalogByLevel(catalog, 'a1').map((d) => d.id)).toEqual([
      'artikel-a1',
      'core-100',
    ]);
    expect(isDeckIdAllowed('cefr-b1', 'a1', catalog)).toBe(false);
    expect(isDeckIdAllowed('cefr-b1', 'b1', catalog)).toBe(true);
    expect(isDeckIdAllowed('greetings', 'a1', catalog)).toBe(true);
    expect(isDeckIdAllowed('', 'a1', catalog)).toBe(true);
  });
});

describe('stored classification as the default', () => {
  beforeEach(() => setUserLevel('a1'));

  it('defaults allowedModes to the stored code', () => {
    expect(allowedModes()).toEqual(['a1']);
    setUserLevel('a2');
    expect(allowedModes()).toEqual(['a1', 'a2']);
  });
});
