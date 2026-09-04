import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  LESSONS_CACHE_KEY,
  cacheKeyFor,
  sanitizeLessons,
  readCachedLessons,
  fetchLessons,
} from './lessons';

const params = { courseCode: 'de', level: 'a1', tab: 'vocab' };

const unit = (over = {}) => ({
  id: 'u1',
  packId: 'de',
  courseCode: 'de',
  level: 'a1',
  tab: 'vocab',
  unitNumber: 1,
  exercises: [{ id: 'greet-001', type: 'flashcard', payload: { term: 'Hallo' } }],
  updatedAt: '2026-09-04T00:00:00.000Z',
  ...over,
});

/** A fetch stub that resolves one HTTP response. */
function respondWith(status, body) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('sanitizeLessons', () => {
  it('keeps well-formed exercises in order', () => {
    const out = sanitizeLessons([
      unit({
        exercises: [
          { id: 'a', type: 'flashcard', payload: {} },
          { id: 'b', type: 'translate', payload: {} },
        ],
      }),
    ]);
    expect(out[0].exercises.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('drops an exercise with no id — it would break React keys', () => {
    const out = sanitizeLessons([
      unit({ exercises: [{ type: 'flashcard' }, { id: 'b', type: 'flashcard' }] }),
    ]);
    expect(out[0].exercises.map((e) => e.id)).toEqual(['b']);
  });

  it('drops a type outside the closed set', () => {
    const out = sanitizeLessons([
      unit({
        exercises: [
          { id: 'a', type: 'sudoku' },
          { id: 'b', type: 'chat' },
        ],
      }),
    ]);
    expect(out[0].exercises.map((e) => e.id)).toEqual(['b']);
  });

  it('survives a unit whose exercises is not an array', () => {
    expect(sanitizeLessons([unit({ exercises: null })])[0].exercises).toEqual([]);
  });

  it('survives a non-array response', () => {
    expect(sanitizeLessons(null)).toEqual([]);
    expect(sanitizeLessons({ lessons: [] })).toEqual([]);
  });
});

describe('cacheKeyFor', () => {
  it('separates every axis — one pack’s units must never answer another’s', () => {
    const keys = new Set([
      cacheKeyFor(params),
      cacheKeyFor({ ...params, level: 'a2' }),
      cacheKeyFor({ ...params, tab: 'chat' }),
      cacheKeyFor({ ...params, courseCode: 'de-he' }),
      cacheKeyFor({ ...params, packId: 'es' }),
    ]);
    expect(keys.size).toBe(5);
  });

  it('defaults packId to de, matching the endpoint', () => {
    expect(cacheKeyFor(params)).toBe(cacheKeyFor({ ...params, packId: 'de' }));
  });
});

describe('fetchLessons', () => {
  it('calls the query-param contract, not the spec’s path form', async () => {
    const f = respondWith(200, { lessons: [unit()] });
    vi.stubGlobal('fetch', f);
    await fetchLessons(params);
    const url = f.mock.calls[0][0];
    expect(url).toContain('/api/v1/content/lessons?');
    expect(url).toContain('courseCode=de');
    expect(url).toContain('level=a1');
    expect(url).toContain('tab=vocab');
    // The shipped handler has no [param] route. A path build would 404.
    expect(url).not.toContain('/lessons/de/a1/vocab');
  });

  it('returns sanitized units and warms the cache', async () => {
    vi.stubGlobal(
      'fetch',
      respondWith(200, {
        lessons: [unit({ exercises: [{ id: 'a', type: 'flashcard' }, { type: 'chat' }] })],
      })
    );
    const out = await fetchLessons(params);
    expect(out[0].exercises).toHaveLength(1);
    expect(readCachedLessons(params)[0].exercises).toHaveLength(1);
  });

  it('an empty track is [] — not an error, and distinguishable from a 400', async () => {
    vi.stubGlobal('fetch', respondWith(200, { lessons: [] }));
    await expect(fetchLessons(params)).resolves.toEqual([]);
  });

  it('a 200 that is not JSON is an outage, not an empty track', async () => {
    // `npm run dev` (vite alone, no `vercel dev`) serves index.html for /api/*
    // with a 200. Reporting that as "this track has no units yet" is the
    // 404-as-total=0 trap: a broken lane and a real empty seed print the same.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError('Unexpected token <')),
      })
    );
    await expect(fetchLessons(params)).rejects.toMatchObject({ code: 'bad_response' });
    expect(readCachedLessons(params)).toBeNull();
  });

  it('a 400 throws bad_request and must not poison the cache', async () => {
    vi.stubGlobal('fetch', respondWith(200, { lessons: [unit()] }));
    await fetchLessons(params);

    vi.stubGlobal(
      'fetch',
      respondWith(400, { error: { code: 'bad_request', message: 'Unknown level.' } })
    );
    await expect(fetchLessons({ ...params, level: 'c1' })).rejects.toMatchObject({
      code: 'bad_request',
    });
    // the good entry is untouched
    expect(readCachedLessons(params)).toHaveLength(1);
  });

  it('a 500 throws rather than resolving empty — an outage is not an empty track', async () => {
    vi.stubGlobal('fetch', respondWith(500, { error: { code: 'server_error' } }));
    await expect(fetchLessons(params)).rejects.toMatchObject({ code: 'server_error' });
  });

  it('propagates a network failure so the caller can fall back to cache', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(fetchLessons(params)).rejects.toBeInstanceOf(Error);
  });

  it('revalidation REPLACES — a unit deleted upstream disappears', async () => {
    vi.stubGlobal('fetch', respondWith(200, { lessons: [unit({ id: 'u1' }), unit({ id: 'u2' })] }));
    await fetchLessons(params);
    expect(readCachedLessons(params)).toHaveLength(2);

    vi.stubGlobal('fetch', respondWith(200, { lessons: [unit({ id: 'u1' })] }));
    await fetchLessons(params);
    expect(readCachedLessons(params).map((l) => l.id)).toEqual(['u1']);
  });
});

describe('readCachedLessons', () => {
  it('is null on a cold cache — null is "never fetched", [] is "empty track"', () => {
    expect(readCachedLessons(params)).toBeNull();
  });

  it('is null, not a throw, on malformed JSON', () => {
    localStorage.setItem(LESSONS_CACHE_KEY, '{not json');
    expect(readCachedLessons(params)).toBeNull();
  });

  it('re-sanitizes on read — a cached blob predates the current contract', () => {
    localStorage.setItem(
      LESSONS_CACHE_KEY,
      JSON.stringify({
        [cacheKeyFor(params)]: {
          lessons: [unit({ exercises: [{ id: 'old', type: 'dictation' }] })],
        },
      })
    );
    expect(readCachedLessons(params)[0].exercises).toEqual([]);
  });

  it('does not answer one combination with another’s units', async () => {
    vi.stubGlobal('fetch', respondWith(200, { lessons: [unit()] }));
    await fetchLessons(params);
    expect(readCachedLessons({ ...params, tab: 'chat' })).toBeNull();
  });
});
