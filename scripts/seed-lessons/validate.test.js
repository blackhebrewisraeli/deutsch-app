import { describe, it, expect } from 'vitest';
import { buildLessons } from './build.js';
import { findOrphans, rowKey, validateLessons } from './validate.js';

describe('validateLessons', () => {
  it('accepts the curated pack build with no errors', () => {
    const result = validateLessons(buildLessons());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects an exercise the sanitizer would drop', () => {
    const result = validateLessons([
      {
        pack_id: 'de',
        course_code: 'de',
        level: 'a1',
        tab: 'vocab',
        unit_number: 1,
        exercises: [{ id: '', type: 'flashcard', payload: { term: 'Hallo', glosses: ['hi'] } }],
      },
    ]);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/id/i);
  });

  it('rejects a multiple-choice whose answer is not one of its choices', () => {
    const result = validateLessons([
      {
        pack_id: 'de',
        course_code: 'de',
        level: 'a1',
        tab: 'alphabet',
        unit_number: 1,
        exercises: [
          {
            id: 'mc-bad',
            type: 'multiple-choice',
            payload: { question: 'x', choices: ['a', 'b'], answer: 'c' },
          },
        ],
      },
    ]);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/answer/i);
  });

  it('rejects a flashcard missing term or glosses', () => {
    const result = validateLessons([
      {
        pack_id: 'de',
        course_code: 'de',
        level: 'a1',
        tab: 'vocab',
        unit_number: 1,
        exercises: [{ id: 'fc-bad', type: 'flashcard', payload: { glosses: ['hi'] } }],
      },
    ]);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/term/i);
  });
});

describe('findOrphans', () => {
  it('returns existing de rows the build no longer emits', () => {
    const seed = [
      {
        pack_id: 'de',
        course_code: 'de',
        level: 'a1',
        tab: 'vocab',
        unit_number: 1,
        exercises: [],
      },
    ];
    const existing = [
      { pack_id: 'de', course_code: 'de', level: 'a1', tab: 'vocab', unit_number: 1 },
      { pack_id: 'de', course_code: 'de', level: 'a1', tab: 'chat', unit_number: 1 },
    ];
    const orphans = findOrphans(existing, seed);
    expect(orphans.map(rowKey)).toEqual(['de|de|a1|chat|1']);
  });
});
