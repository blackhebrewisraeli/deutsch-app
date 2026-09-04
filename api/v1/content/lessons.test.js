import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../_lib/supabase.js', () => ({ serviceClient: vi.fn() }));

import handler, { sanitizeExercises, EXERCISE_TYPES } from './lessons.js';
import { serviceClient } from '../../_lib/supabase.js';
import { createRes } from '../../_lib/test-helpers.js';

let seq = 0;
const req = (query = {}, over = {}) => {
  seq += 1;
  return {
    method: 'GET',
    headers: { 'x-forwarded-for': `10.5.5.${seq}` },
    query: { courseCode: 'de', level: 'a1', tab: 'vocab', ...query },
    ...over,
  };
};

let rows;
let dbError;
let orderArgs;
let filters;
const mockDb = () => ({
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(function (col, val) {
        filters.push([col, val]);
        return this;
      }),
      order: vi.fn((col, opts) => {
        orderArgs = [col, opts];
        return Promise.resolve({ data: rows, error: dbError });
      }),
    })),
  })),
});

beforeEach(() => {
  rows = [];
  dbError = null;
  orderArgs = null;
  filters = [];
  serviceClient.mockReturnValue(mockDb());
});

describe('sanitizeExercises', () => {
  it('keeps a well-formed exercise', () => {
    const good = [{ id: 'a', type: 'flashcard', payload: { term: 'Haus' } }];
    expect(sanitizeExercises(good, 'row-1')).toEqual({ kept: good, dropped: 0 });
  });

  it('drops an element missing id or type, and reports how many', () => {
    const mixed = [{ id: 'a', type: 'flashcard', payload: {} }, { type: 'flashcard' }, { id: 'c' }];
    const out = sanitizeExercises(mixed, 'row-1');
    expect(out.kept).toHaveLength(1);
    expect(out.dropped).toBe(2);
  });

  it('drops an unknown type rather than serving a renderer that does not exist', () => {
    const out = sanitizeExercises([{ id: 'a', type: 'hologram', payload: {} }], 'row-1');
    expect(out.kept).toEqual([]);
    expect(out.dropped).toBe(1);
  });

  it('returns an empty array — not a throw — when EVERY element is bad', () => {
    // A malformed row must not 500 the whole tab.
    const out = sanitizeExercises([{ nope: 1 }, { also: 2 }], 'row-1');
    expect(out.kept).toEqual([]);
    expect(out.dropped).toBe(2);
  });

  it('tolerates exercises that are not an array at all', () => {
    expect(sanitizeExercises(null, 'row-1')).toEqual({ kept: [], dropped: 0 });
    expect(sanitizeExercises({ nope: true }, 'row-1')).toEqual({ kept: [], dropped: 0 });
  });

  it('exposes the closed type set', () => {
    expect(EXERCISE_TYPES).toEqual(['flashcard', 'translate', 'chat', 'multiple-choice']);
  });
});

describe('GET /api/v1/content/lessons', () => {
  it('returns lessons for a valid query', async () => {
    rows = [
      {
        id: 'r1',
        pack_id: 'de',
        course_code: 'de',
        level: 'a1',
        tab: 'vocab',
        unit_number: 1,
        exercises: [{ id: 'e1', type: 'flashcard', payload: {} }],
        updated_at: '2026-09-04T00:00:00Z',
      },
    ];
    const res = createRes();
    await handler(req(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.lessons).toHaveLength(1);
    expect(res.body.lessons[0].unitNumber).toBe(1);
    expect(res.body.lessons[0].exercises).toHaveLength(1);
  });

  it('returns packId and updatedAt on each lesson', async () => {
    rows = [
      {
        id: 'r1',
        pack_id: 'de',
        course_code: 'de',
        level: 'a1',
        tab: 'vocab',
        unit_number: 1,
        exercises: [],
        updated_at: '2026-09-04T00:00:00Z',
      },
    ];
    const res = createRes();
    await handler(req(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.lessons[0].packId).toBe('de');
    expect(res.body.lessons[0].updatedAt).toBe('2026-09-04T00:00:00Z');
  });

  it('rejects an unknown packId', async () => {
    const res = createRes();
    await handler(req({ packId: 'en' }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('bad_request');
  });

  it('filters the query on pack_id', async () => {
    await handler(req(), createRes());
    expect(filters).toContainEqual(['pack_id', 'de']);
  });

  it('returns an empty list, not a 404, when nothing matches', async () => {
    rows = [];
    const res = createRes();
    await handler(req(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.lessons).toEqual([]);
  });

  it('does NOT wrap the body in { success: true }', async () => {
    const res = createRes();
    await handler(req(), res);
    expect(res.body.success).toBeUndefined();
  });

  it('rejects an unknown courseCode', async () => {
    const res = createRes();
    await handler(req({ courseCode: 'fr' }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('bad_request');
  });

  it('rejects an unknown level and an unknown tab', async () => {
    const r1 = createRes();
    await handler(req({ level: 'c1' }), r1);
    expect(r1.statusCode).toBe(400);
    const r2 = createRes();
    await handler(req({ tab: 'dictation' }), r2);
    expect(r2.statusCode).toBe(400);
  });

  it('rejects a missing parameter rather than defaulting it', async () => {
    const res = createRes();
    await handler(req({ level: undefined }), res);
    expect(res.statusCode).toBe(400);
  });

  it('asks the database to sort by unitNumber, and preserves the order it returns', async () => {
    // Spec section 8.2 requires a sort assertion and warns that one unit cannot
    // express it. Two rows, returned 2-then-1.
    //
    // Be honest about what a mock can prove: Postgres does the ordering, so this
    // CANNOT verify the sort itself. It verifies the two things that are ours to
    // get wrong — that we asked for `unit_number` ascending, and that the mapping
    // does not reorder or drop rows on the way out. The real ordering is the
    // database's job and is covered by lessons_lookup_idx plus the RLS suite.
    rows = [
      { id: 'r2', course_code: 'de', level: 'a1', tab: 'vocab', unit_number: 2, exercises: [] },
      { id: 'r1', course_code: 'de', level: 'a1', tab: 'vocab', unit_number: 1, exercises: [] },
    ];
    const res = createRes();
    await handler(req(), res);
    expect(orderArgs).toEqual(['unit_number', { ascending: true }]);
    expect(res.body.lessons.map((l) => l.unitNumber)).toEqual([2, 1]);
  });

  it('drops a malformed exercise but still serves its siblings', async () => {
    rows = [
      {
        id: 'r1',
        course_code: 'de',
        level: 'a1',
        tab: 'vocab',
        unit_number: 1,
        exercises: [{ id: 'e1', type: 'flashcard', payload: {} }, { broken: true }],
      },
    ];
    const res = createRes();
    await handler(req(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.lessons[0].exercises).toHaveLength(1);
  });

  it('surfaces a database failure as the error envelope', async () => {
    dbError = { message: 'boom' };
    const res = createRes();
    await handler(req(), res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error.code).toBe('server_error');
    expect(JSON.stringify(res.body)).not.toContain('boom');
  });
});
