import { describe, it, expect } from 'vitest';
import { unitVisualStates, unitXp, GRADEABLE_TYPES } from './lessonProgress.js';
import { XP_PER_VERDICT } from './gameConfig.js';

const ex = (id, type = 'flashcard') => ({ id, type, payload: {} });
const unit = (id, unitNumber, exercises) => ({ id, unitNumber, exercises });

describe('GRADEABLE_TYPES', () => {
  it('is flashcard, translate, and multiple-choice — chat does not grade', () => {
    expect(GRADEABLE_TYPES).toEqual(['flashcard', 'translate', 'multiple-choice']);
  });
});

describe('unitVisualStates', () => {
  it('returns [] for empty / missing units', () => {
    expect(unitVisualStates([], new Set())).toEqual([]);
    expect(unitVisualStates(undefined, new Set())).toEqual([]);
    expect(unitVisualStates(null, new Set())).toEqual([]);
  });

  it('opens a single unit as in-progress with nothing graded', () => {
    const units = [unit('u1', 1, [ex('a'), ex('b')])];
    expect(unitVisualStates(units, new Set())).toEqual([
      { id: 'u1', unitNumber: 1, state: 'in-progress', done: 0, total: 2 },
    ]);
  });

  it('marks a unit completed when every gradeable exercise is graded', () => {
    const units = [unit('u1', 1, [ex('a'), ex('b')])];
    expect(unitVisualStates(units, new Set(['a', 'b']))).toEqual([
      { id: 'u1', unitNumber: 1, state: 'completed', done: 2, total: 2 },
    ]);
  });

  it('unlocks the next unit only after the previous is completed', () => {
    const units = [unit('u1', 1, [ex('a')]), unit('u2', 2, [ex('b')])];
    expect(unitVisualStates(units, new Set(['a']))).toEqual([
      { id: 'u1', unitNumber: 1, state: 'completed', done: 1, total: 1 },
      { id: 'u2', unitNumber: 2, state: 'in-progress', done: 0, total: 1 },
    ]);
  });

  it('keeps later units locked while the first is mid-progress', () => {
    const units = [unit('u1', 1, [ex('a'), ex('b')]), unit('u2', 2, [ex('c')])];
    expect(unitVisualStates(units, new Set(['a']))).toEqual([
      { id: 'u1', unitNumber: 1, state: 'in-progress', done: 1, total: 2 },
      { id: 'u2', unitNumber: 2, state: 'locked', done: 0, total: 1 },
    ]);
  });

  it('treats a chat-only unit as completed so it cannot deadlock the path', () => {
    const units = [unit('u1', 1, [ex('chat-1', 'chat')]), unit('u2', 2, [ex('b')])];
    expect(unitVisualStates(units, new Set())).toEqual([
      { id: 'u1', unitNumber: 1, state: 'completed', done: 0, total: 0 },
      { id: 'u2', unitNumber: 2, state: 'in-progress', done: 0, total: 1 },
    ]);
  });

  it('does not count unknown or invalid exercise types toward total', () => {
    const units = [
      unit('u1', 1, [ex('a'), { id: 'bad', type: 'sudoku', payload: {} }, ex('chat-1', 'chat')]),
    ];
    expect(unitVisualStates(units, new Set())).toEqual([
      { id: 'u1', unitNumber: 1, state: 'in-progress', done: 0, total: 1 },
    ]);
  });

  it('orders by unitNumber, not array position', () => {
    const units = [unit('u2', 2, [ex('b')]), unit('u1', 1, [ex('a')])];
    expect(unitVisualStates(units, new Set()).map((row) => row.id)).toEqual(['u1', 'u2']);
    expect(unitVisualStates(units, new Set()).map((row) => row.state)).toEqual([
      'in-progress',
      'locked',
    ]);
  });

  it('accepts a grades map as well as a Set of ids', () => {
    const units = [unit('u1', 1, [ex('a'), ex('b')])];
    expect(unitVisualStates(units, { a: 'correct' })).toEqual([
      { id: 'u1', unitNumber: 1, state: 'in-progress', done: 1, total: 2 },
    ]);
  });

  it('tolerates a missing graded collection', () => {
    const units = [unit('u1', 1, [ex('a')])];
    expect(unitVisualStates(units).map((row) => row.state)).toEqual(['in-progress']);
  });
});

describe('unitXp', () => {
  it('sums XP_PER_VERDICT for graded exercises in that unit', () => {
    const u = unit('u1', 1, [ex('a'), ex('b'), ex('c')]);
    const grades = { a: 'correct', b: 'almost', c: 'wrong' };
    expect(unitXp(u, grades)).toBe(
      XP_PER_VERDICT.correct + XP_PER_VERDICT.almost + XP_PER_VERDICT.wrong
    );
  });

  it('ignores grades that do not belong to the unit', () => {
    const u = unit('u1', 1, [ex('a')]);
    expect(unitXp(u, { a: 'correct', other: 'correct' })).toBe(XP_PER_VERDICT.correct);
  });

  it('is 0 when nothing is graded or the unit is missing', () => {
    expect(unitXp(unit('u1', 1, [ex('a')]), {})).toBe(0);
    expect(unitXp(undefined, { a: 'correct' })).toBe(0);
  });
});
