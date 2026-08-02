const STORAGE_KEY = 'deutsch-app-state-v1';

// loadState() is called ~29 times across the app — including once per App
// render (App.jsx reads it in the render body for the Stats nav badge). getItem
// is cheap; JSON.parse of the blob is not. On a realistic account — a year of
// daily history plus SRS entries for 2,500 cards, ~330KB — one parse measured
// 6.9ms on desktop, so roughly 30ms on a phone, per render. State only ever
// grows, so this got worse the longer an account was used.
//
// The cache is keyed on the exact raw string it was parsed from. Any write —
// from this tab, another tab, or a test calling localStorage.setItem directly —
// produces a different string and invalidates the cache by itself. That means
// no staleness window and no `storage` event plumbing to get wrong.
//
// Callers may share the returned object, so it must not be mutated in place.
// Every writer today builds a new object (`saveState({ ...state, daily })`) via
// the pure helpers in stats.js / srs.js. Keep it that way.
let cachedRaw = null;
let cachedState = null;

export const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      cachedRaw = null;
      cachedState = null;
      return null;
    }
    if (raw !== cachedRaw) {
      cachedState = JSON.parse(raw);
      cachedRaw = raw;
    }
    return cachedState;
  } catch {
    return null;
  }
};

export const saveState = (state) => {
  try {
    const raw = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, raw);
    // Only adopt the cache once the write actually succeeded, so a quota
    // failure cannot leave the cache claiming a state that was never stored.
    cachedRaw = raw;
    cachedState = state;
  } catch {
    // localStorage unavailable (private browsing or quota exceeded) — fail silently
  }
};
