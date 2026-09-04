// Shared scaffolding for the content-lane tests.
//
// Extracted because the cache-priming and queue-reading blocks were duplicated
// verbatim across the PracticeLane test files — enough for SonarCloud's
// new-code duplication gate (a RATIO, so identical setup in a small PR trips
// it). Mirrors the existing api/_lib/test-helpers.js convention: a plain
// module imported only by tests.

import { vi } from 'vitest';
import { LESSONS_CACHE_KEY, cacheKeyFor } from './lessons.js';
import { QUEUE_KEY } from './progressQueue.js';
import { loadState } from './storage.js';
import { todayKey } from './stats.js';

export const DEFAULT_LESSON_PARAMS = { courseCode: 'de', packId: 'de', level: 'a1', tab: 'vocab' };

/** One lesson row as the API serves it (camelCase, already sanitized). */
export function lessonUnit({ id = 'u1', unitNumber = 1, exercises = [], ...over } = {}) {
  return {
    id,
    packId: 'de',
    courseCode: 'de',
    level: 'a1',
    tab: 'vocab',
    unitNumber,
    exercises,
    updatedAt: '2026-09-04T00:00:00.000Z',
    ...over,
  };
}

export const flashcardExercise = (id, term) => ({
  id,
  type: 'flashcard',
  payload: { term, glosses: ['x'] },
});

/** A fetch stub resolving one HTTP response. */
export function respondWith(status, body) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

/** A fetch that never settles — whatever renders came from the cache alone. */
export const pendingFetch = () => vi.fn(() => new Promise(() => {}));

/** Seed the lessons cache for one combination, leaving other entries intact. */
export function warmLessonCache(lessons, over = {}) {
  const key = cacheKeyFor({ ...DEFAULT_LESSON_PARAMS, ...over });
  const map = JSON.parse(localStorage.getItem(LESSONS_CACHE_KEY) ?? '{}');
  map[key] = { lessons, cachedAt: Date.now() };
  localStorage.setItem(LESSONS_CACHE_KEY, JSON.stringify(map));
  return key;
}

export const progressQueueSnapshot = () => JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');

export const todayRoundTotal = () => loadState()?.daily?.[todayKey()]?.total ?? 0;
