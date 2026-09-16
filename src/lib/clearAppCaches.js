// Browser Cache Storage for this PWA: Workbox precache + runtime caches.
//
// Disk `npm run clean` cannot touch these. vite-plugin-pwa's
// registerType:'autoUpdate' refreshes the precache on a new SW version, but
// runtimeCaching buckets (lexicon-json) are not in the precache manifest and
// are not purged on activation — that is why this helper exists.
//
// Ownership model: Cache Storage is origin-scoped, and this origin is the app.
// We delete every name `caches.keys()` returns rather than an allowlist.
// Workbox suffixes the precache with the origin/scope
// (`workbox-precache-v2-<origin>`), which differs across localhost, Preview,
// and production; hardcoding that string would miss the live buckets.
//
// The helper does not unregister the service worker. Unregister + reload is
// more thorough (a fresh install event refills the precache) but drops offline
// until that install finishes. Deleting Cache Storage is enough: lexicon SWR
// misses go to the network, and Workbox precache misses fall back to the
// network while online. autoUpdate remains the SW lifecycle.

/** Runtime cache names this repo configures in vite.config.js. */
export const APP_RUNTIME_CACHE_NAMES = Object.freeze(['lexicon-json']);

export const CACHE_CLEAR_UNSUPPORTED = 'unsupported';
export const CACHE_CLEAR_CLEARED = 'cleared';
export const CACHE_CLEAR_PARTIAL = 'partial';
export const CACHE_CLEAR_ERROR = 'error';

/**
 * Resolve the Cache Storage API without throwing.
 * Accessing `caches` in a non-secure context can raise a SecurityError.
 *
 * @param {CacheStorage | null | undefined} override
 * @returns {CacheStorage | null}
 */
export function resolveCacheStorage(override) {
  if (override === null) return null;
  try {
    const api = override ?? globalThis.caches;
    if (api && typeof api.keys === 'function' && typeof api.delete === 'function') {
      return api;
    }
  } catch {
    // SecurityError / unavailable — treat as missing.
  }
  return null;
}

/**
 * Delete every same-origin Cache Storage bucket.
 *
 * Safe with no SW, no caches API, or outside a secure context: never throws.
 *
 * @param {{ cachesApi?: CacheStorage | null }} [opts]
 * @returns {Promise<{
 *   ok: boolean,
 *   available: boolean,
 *   deleted: string[],
 *   failed: string[],
 *   reason: typeof CACHE_CLEAR_UNSUPPORTED | typeof CACHE_CLEAR_CLEARED | typeof CACHE_CLEAR_PARTIAL | typeof CACHE_CLEAR_ERROR,
 *   error?: string,
 * }>}
 */
export async function clearAppCaches(opts = {}) {
  const api = resolveCacheStorage(opts.cachesApi);
  if (!api) {
    return {
      ok: true,
      available: false,
      deleted: [],
      failed: [],
      reason: CACHE_CLEAR_UNSUPPORTED,
    };
  }

  let names;
  try {
    names = Array.from((await api.keys()) ?? []);
  } catch (err) {
    return {
      ok: false,
      available: true,
      deleted: [],
      failed: [],
      reason: CACHE_CLEAR_ERROR,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const deleted = [];
  const failed = [];
  for (const name of names) {
    try {
      const removed = await api.delete(name);
      if (removed) deleted.push(name);
      else failed.push(name);
    } catch {
      failed.push(name);
    }
  }

  if (failed.length > 0) {
    return { ok: false, available: true, deleted, failed, reason: CACHE_CLEAR_PARTIAL };
  }
  return { ok: true, available: true, deleted, failed, reason: CACHE_CLEAR_CLEARED };
}
