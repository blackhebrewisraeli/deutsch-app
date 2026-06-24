// Separate localStorage key holding the delta-sync baseline + last-synced time.
// Additive — never reads or writes the main deutsch-app-state-v1 blob.
export const SYNC_META_KEY = 'deutsch-app-sync-meta-v1';

export function loadSyncMeta() {
  try {
    const raw = localStorage.getItem(SYNC_META_KEY);
    if (!raw) return { lastSyncedCounters: {}, lastSyncedAt: null };
    return JSON.parse(raw);
  } catch {
    return { lastSyncedCounters: {}, lastSyncedAt: null };
  }
}

export function saveSyncMeta(meta) {
  try {
    localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
  } catch {
    // ignore — meta is reconstructable from a fresh pull
  }
}
