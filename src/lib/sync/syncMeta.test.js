import { describe, it, expect, beforeEach } from 'vitest';
import { loadSyncMeta, saveSyncMeta, SYNC_META_KEY } from './syncMeta.js';

describe('syncMeta', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips through its own key, never the main blob', () => {
    saveSyncMeta({ lastSyncedCounters: { '2026-06-19': { total: 5 } }, lastSyncedAt: 123 });
    expect(loadSyncMeta().lastSyncedAt).toBe(123);
    expect(localStorage.getItem('deutsch-app-state-v1')).toBeNull(); // untouched
    expect(SYNC_META_KEY).toBe('deutsch-app-sync-meta-v1');
  });

  it('returns an empty shape when absent', () => {
    expect(loadSyncMeta()).toEqual({ lastSyncedCounters: {}, lastSyncedAt: null });
  });
});
