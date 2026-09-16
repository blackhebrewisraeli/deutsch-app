import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  APP_RUNTIME_CACHE_NAMES,
  CACHE_CLEAR_UNSUPPORTED,
  CACHE_CLEAR_CLEARED,
  CACHE_CLEAR_PARTIAL,
  CACHE_CLEAR_ERROR,
  resolveCacheStorage,
  clearAppCaches,
} from './clearAppCaches.js';

function fakeCaches(initialNames, { deleteImpl } = {}) {
  const store = new Set(initialNames);
  return {
    keys: async () => [...store],
    delete:
      deleteImpl ??
      (async (name) => {
        if (!store.has(name)) return false;
        store.delete(name);
        return true;
      }),
  };
}

describe('APP_RUNTIME_CACHE_NAMES', () => {
  it('names the lexicon runtime cache vite-plugin-pwa actually creates', () => {
    expect(APP_RUNTIME_CACHE_NAMES).toEqual(['lexicon-json']);
    const vite = readFileSync('vite.config.js', 'utf8');
    expect(vite).toMatch(/cacheName:\s*['"]lexicon-json['"]/);
    expect(vite).toMatch(/registerType:\s*['"]autoUpdate['"]/);
  });
});

describe('resolveCacheStorage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the override when provided', () => {
    const api = fakeCaches([]);
    expect(resolveCacheStorage(api)).toBe(api);
  });

  it('returns null when the caches API is missing', () => {
    vi.stubGlobal('caches', undefined);
    expect(resolveCacheStorage()).toBeNull();
  });

  it('returns null when reading caches throws (non-secure context)', () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'caches');
    Object.defineProperty(globalThis, 'caches', {
      configurable: true,
      get() {
        throw new Error('SecurityError');
      },
    });
    try {
      expect(resolveCacheStorage()).toBeNull();
    } finally {
      if (previous) Object.defineProperty(globalThis, 'caches', previous);
      else delete globalThis.caches;
    }
  });

  it('returns the global API when keys and delete are functions', () => {
    const api = fakeCaches(['lexicon-json']);
    vi.stubGlobal('caches', api);
    expect(resolveCacheStorage()).toBe(api);
  });
});

describe('clearAppCaches', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('treats an explicit null cachesApi as unavailable, even if a global exists', async () => {
    vi.stubGlobal('caches', fakeCaches(['lexicon-json']));
    const result = await clearAppCaches({ cachesApi: null });
    expect(result).toEqual({
      ok: true,
      available: false,
      deleted: [],
      failed: [],
      reason: CACHE_CLEAR_UNSUPPORTED,
    });
  });

  it('does not throw when the global caches API is missing', async () => {
    vi.stubGlobal('caches', undefined);
    const result = await clearAppCaches();
    expect(result.available).toBe(false);
    expect(result.reason).toBe(CACHE_CLEAR_UNSUPPORTED);
    expect(result.ok).toBe(true);
  });

  it('ignores an override that is not a Cache Storage API', async () => {
    const result = await clearAppCaches({ cachesApi: {} });
    expect(result.available).toBe(false);
    expect(result.reason).toBe(CACHE_CLEAR_UNSUPPORTED);
  });

  it('deletes every same-origin cache, including lexicon-json and Workbox precache names', async () => {
    const precache = 'workbox-precache-v2-https://deutsch-app-dusky.vercel.app/';
    const api = fakeCaches(['lexicon-json', precache, 'workbox-runtime']);
    const result = await clearAppCaches({ cachesApi: api });

    expect(result.ok).toBe(true);
    expect(result.available).toBe(true);
    expect(result.reason).toBe(CACHE_CLEAR_CLEARED);
    expect(result.deleted.sort()).toEqual(['lexicon-json', precache, 'workbox-runtime'].sort());
    expect(result.failed).toEqual([]);
    expect(await api.keys()).toEqual([]);
  });

  it('succeeds with an empty Cache Storage', async () => {
    const result = await clearAppCaches({ cachesApi: fakeCaches([]) });
    expect(result).toEqual({
      ok: true,
      available: true,
      deleted: [],
      failed: [],
      reason: CACHE_CLEAR_CLEARED,
    });
  });

  it('reports partial failure when a delete returns false', async () => {
    const api = fakeCaches(['lexicon-json', 'stuck'], {
      deleteImpl: async (name) => name === 'lexicon-json',
    });
    const result = await clearAppCaches({ cachesApi: api });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe(CACHE_CLEAR_PARTIAL);
    expect(result.deleted).toEqual(['lexicon-json']);
    expect(result.failed).toEqual(['stuck']);
  });

  it('reports partial failure when a delete throws', async () => {
    const api = fakeCaches(['lexicon-json', 'boom'], {
      deleteImpl: async (name) => {
        if (name === 'boom') throw new Error('QuotaExceeded');
        return true;
      },
    });
    const result = await clearAppCaches({ cachesApi: api });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe(CACHE_CLEAR_PARTIAL);
    expect(result.deleted).toEqual(['lexicon-json']);
    expect(result.failed).toEqual(['boom']);
  });

  it('does not throw when keys() rejects', async () => {
    const api = {
      keys: async () => {
        throw new Error('SecurityError');
      },
      delete: async () => true,
    };
    const result = await clearAppCaches({ cachesApi: api });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe(CACHE_CLEAR_ERROR);
    expect(result.error).toMatch(/SecurityError/);
    expect(result.deleted).toEqual([]);
  });
});
