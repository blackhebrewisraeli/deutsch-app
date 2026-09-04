import { useEffect, useState } from 'react';
import { fetchLessons, readCachedLessons } from './lessons.js';

/**
 * One combination's lesson units, cache-first.
 *
 * Four states, and the distinction between two of them is the point:
 *
 * - `loading` — cold cache, network in flight
 * - `ready`   — at least one unit to render
 * - `empty`   — the track exists and has no units yet (today: every one of the
 *               twelve combinations, because nothing is seeded)
 * - `error`   — the lane is broken and we have nothing cached
 *
 * `empty` and `error` must not collapse into each other. An overlay that hides
 * itself on both looks identical to the learner, but the difference is the
 * whole diagnostic signal when a seed silently fails.
 *
 * Never throws into render: a caller renders its bundled-pack content unless
 * this returns `ready` with units (E5 plan, Ruling 1).
 */
export function useLessons({ courseCode, level, tab, packId = 'de' }) {
  const [state, setState] = useState(() => fromCache({ courseCode, level, tab, packId }));

  useEffect(() => {
    const params = { courseCode, level, tab, packId };
    let cancelled = false;

    // Re-seed from this combination's cache synchronously. Without it, switching
    // level would leave the previous level's units on screen while the new
    // fetch is in flight — the wrong content, rendered confidently.
    setState(fromCache(params));

    fetchLessons(params)
      .then((lessons) => {
        if (cancelled) return;
        setState({ status: lessons.length > 0 ? 'ready' : 'empty', lessons, error: null });
      })
      .catch((error) => {
        if (cancelled) return;
        // A warm cache outlives a failed revalidation: going offline must not
        // blank a tab that was rendering units a second ago.
        const cached = readCachedLessons(params);
        if (cached) {
          setState({
            status: cached.length > 0 ? 'ready' : 'empty',
            lessons: cached,
            error,
          });
          return;
        }
        setState({ status: 'error', lessons: [], error });
      });

    return () => {
      cancelled = true;
    };
  }, [courseCode, level, tab, packId]);

  return state;
}

function fromCache(params) {
  const cached = readCachedLessons(params);
  if (!cached) return { status: 'loading', lessons: [], error: null };
  return { status: cached.length > 0 ? 'ready' : 'empty', lessons: cached, error: null };
}
