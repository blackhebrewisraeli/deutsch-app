import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadState, saveState } from './storage';

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
});
