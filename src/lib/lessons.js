// Client for the content lane: GET /api/v1/content/lessons.
//
// Additive overlay, never a replacement (E5 plan, Ruling 1). The bundled pack
// stays the offline source of truth; a caller that gets [] or an error renders
// exactly what it rendered before this module existed.
//
// The cache lives here rather than in the service worker because
// vite.config.js denylists /api/ from the SW on purpose ("Don't cache API
// calls"), and because a workbox rule has no assertable form in jsdom — a
// config no test can reach is a config that rots.

/** One localStorage key holding a map of combination → units. */
export const LESSONS_CACHE_KEY = 'deutsch-app-lessons-v1';

/**
 * The renderer set the engine knows how to call. Mirrors EXERCISE_TYPES in
 * api/v1/content/lessons.js and in components/exercises/exerciseRegistry.js —
 * src/ must not import from api/ (native ESM on Vercel is a different graph).
 * A new type is a contract change, not a silent insert.
 */
export const EXERCISE_TYPES = ['flashcard', 'translate', 'chat', 'multiple-choice'];

/**
 * Cache key. Every axis is in it: keying on `tab` alone would answer the vocab
 * tab with the chat tab's units the way lexiconStore once served one pack's
 * chunk for another's request. The shapes match, so nothing throws — the app
 * just renders the wrong thing.
 */
export function cacheKeyFor({ packId = 'de', courseCode, level, tab }) {
  return `${packId}:${courseCode}:${level}:${tab}`;
}

/**
 * Drop what the engine cannot render, mirroring the handler's response filter.
 *
 * The server already filters, so this looks redundant on a network read — it
 * is not on a CACHE read. A blob written by an older build was filtered against
 * an older contract. `getExerciseComponent` falls back to UnknownExercise so a
 * bad type cannot crash, but an element with no `id` would break React keys.
 */
export function sanitizeLessons(lessons) {
  if (!Array.isArray(lessons)) return [];
  return lessons
    .filter((lesson) => lesson && typeof lesson === 'object')
    .map((lesson) => ({
      ...lesson,
      exercises: Array.isArray(lesson.exercises)
        ? lesson.exercises.filter(
            (ex) =>
              ex &&
              typeof ex.id === 'string' &&
              ex.id.length > 0 &&
              EXERCISE_TYPES.includes(ex.type)
          )
        : [],
    }));
}

function readCacheMap() {
  try {
    const raw = localStorage.getItem(LESSONS_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * @returns the cached units for this combination, or `null` when there are
 * none. `null` and `[]` are different answers: null is "never fetched", [] is
 * "this track exists and has no units yet". A caller that conflates them
 * cannot tell a cold start from an empty seed.
 */
export function readCachedLessons(params) {
  const entry = readCacheMap()[cacheKeyFor(params)];
  if (!entry || !Array.isArray(entry.lessons)) return null;
  return sanitizeLessons(entry.lessons);
}

export function writeCachedLessons(params, lessons) {
  try {
    const map = readCacheMap();
    // Assignment, not a merge: a unit deleted upstream has to disappear, and a
    // merge makes deletion unrepresentable.
    map[cacheKeyFor(params)] = { lessons, cachedAt: Date.now() };
    localStorage.setItem(LESSONS_CACHE_KEY, JSON.stringify(map));
  } catch {
    // quota / private mode — the caller still has this tick's value in memory
  }
}

function contentError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/**
 * Fetch one combination's units and warm the cache.
 *
 * Query parameters, not path segments: the spec drew
 * `/content/lessons/:courseCode/:level/:tab`, but this project compiles static
 * function filenames and has no [param] routes, so the shipped handler reads
 * req.query (E1–E3 plan, Ruling 1). A path build would 404.
 *
 * @throws {Error & {code: string}} on 400 (a caller bug — an out-of-set
 * courseCode/level/tab), on any other non-2xx, and on a network failure. It
 * does NOT fall back to the cache: that decision belongs to the caller, which
 * is the only thing that knows whether it already has units on screen.
 */
export async function fetchLessons({ courseCode, level, tab, packId = 'de' }) {
  const query = new URLSearchParams({ courseCode, level, tab, packId });
  const res = await fetch(`/api/v1/content/lessons?${query}`, {
    headers: { accept: 'application/json' },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw contentError(
      body?.error?.code ?? (res.status === 400 ? 'bad_request' : 'server_error'),
      body?.error?.message ?? `Content unavailable (${res.status}).`
    );
  }

  // A 200 whose body will not parse is an outage, not an empty track. `npm run
  // dev` (vite alone) answers /api/* with index.html and a 200; resolving that
  // as [] would make a broken lane indistinguishable from a real empty seed.
  const body = await res.json().catch(() => null);
  if (!body || !Array.isArray(body.lessons)) {
    throw contentError('bad_response', 'Content unavailable.');
  }
  const lessons = sanitizeLessons(body.lessons);
  writeCachedLessons({ courseCode, level, tab, packId }, lessons);
  return lessons;
}
