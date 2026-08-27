import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadState, saveState, freezePersist, thawPersist } from './storage';

const STORAGE_KEY = 'deutsch-app-state-v1';

describe('storage', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadState', () => {
    it('returns null when the key is absent', () => {
      expect(loadState()).toBeNull();
    });

    it('returns the parsed object when the key holds valid JSON', () => {
      const state = { stats: { streak: 3, learnedCount: 12 }, learnedWords: { hallo: true } };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      expect(loadState()).toEqual(state);
    });

    it('returns null when the stored value is invalid JSON', () => {
      localStorage.setItem(STORAGE_KEY, '{ not: valid json');
      expect(loadState()).toBeNull();
    });

    it('returns null when localStorage.getItem throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      expect(loadState()).toBeNull();
    });

    it('returns null when value is the empty string', () => {
      localStorage.setItem(STORAGE_KEY, '');
      expect(loadState()).toBeNull();
    });
  });

  describe('saveState', () => {
    it('writes a JSON-stringified copy to the canonical key', () => {
      const state = { stats: { streak: 1 }, learnedWords: {} };
      saveState(state);
      expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(state));
    });

    it('round-trips with loadState', () => {
      const state = {
        stats: { streak: 7, learnedCount: 42, lastVisit: 'Mon Jan 01 2026' },
        learnedWords: { Hallo: true, Tschüss: false },
      };
      saveState(state);
      expect(loadState()).toEqual(state);
    });

    it('silently swallows quota-exceeded errors', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      });
      // Must not throw — the app stays functional even when storage is full.
      expect(() => saveState({ stats: {} })).not.toThrow();
    });

    it('silently swallows generic localStorage errors (e.g., disabled storage)', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('localStorage disabled');
      });
      expect(() => saveState({ stats: {} })).not.toThrow();
    });
  });

  // loadState runs once per App render and ~29 times across the app. Parsing a
  // realistic account (~330KB) costs ~7ms, so the parse is cached against the
  // raw string it came from.
  describe('parse caching', () => {
    it('does not re-parse when the stored string has not changed', () => {
      saveState({ stats: { streak: 1 } });
      loadState();
      const parse = vi.spyOn(JSON, 'parse');
      loadState();
      loadState();
      loadState();
      expect(parse).not.toHaveBeenCalled();
    });

    it('re-parses after an external write, so the cache can never go stale', () => {
      saveState({ stats: { streak: 1 } });
      expect(loadState().stats.streak).toBe(1);

      // Simulates another tab, or a test seeding storage directly.
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ stats: { streak: 99 } }));
      expect(loadState().stats.streak).toBe(99);
    });

    it('re-parses after the key is removed and rewritten', () => {
      saveState({ stats: { streak: 5 } });
      loadState();
      localStorage.removeItem(STORAGE_KEY);
      expect(loadState()).toBeNull();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ stats: { streak: 6 } }));
      expect(loadState().stats.streak).toBe(6);
    });

    it('does not adopt the cache when the write failed', () => {
      saveState({ stats: { streak: 1 } });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      saveState({ stats: { streak: 2 } });
      vi.restoreAllMocks();
      // The write never landed, so the previously stored state must still win.
      expect(loadState().stats.streak).toBe(1);
    });
  });

  describe('persist freeze', () => {
    afterEach(() => {
      thawPersist();
    });

    it('ignores saveState and loadState while frozen', () => {
      saveState({ stats: { streak: 4 } });
      freezePersist();
      saveState({ stats: { streak: 99 }, gamification: { xp: 1112 } });
      expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify({ stats: { streak: 4 } }));
      expect(loadState()).toBeNull();
    });

    it('writes again after thawPersist', () => {
      freezePersist();
      saveState({ stats: { streak: 1 } });
      thawPersist();
      saveState({ stats: { streak: 2 } });
      expect(loadState().stats.streak).toBe(2);
    });
  });
});
