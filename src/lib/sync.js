// Sync orchestrator. No-op unless VITE_SYNC_ENABLED and a session exist. Reads
// the client from auth.js; localStorage stays the offline source of truth.
import { loadState, saveState } from './storage.js';
import { getSupabase } from './auth.js';
import { loadSyncMeta, saveSyncMeta } from './sync/syncMeta.js';
import {
  srsToRows,
  srsFromRows,
  dailyToRows,
  dailyFromRows,
  settingsToRow,
  settingsFromRow,
} from './sync/adapters.js';
import { mergeSrs, mergeSettings, mergeDailyAdditive } from './sync/merge.js';

export const SYNC_ENABLED = import.meta.env.VITE_SYNC_ENABLED === 'true';

let testClient = null;
export function __setClientForTest(c) {
  testClient = c;
}
function client() {
  return testClient ?? getSupabase();
}

const PACK = 'de';
const withUser = (rows, userId) => rows.map((r) => ({ ...r, user_id: userId, pack_id: PACK }));

/** Pull → merge (additive daily + LWW srs/settings) → push. Single reconcile path. */
export async function pullAndMerge(userId) {
  const c = client();
  if (!c) return;
  const s = loadState() ?? {};
  const meta = loadSyncMeta();
  const level = localStorage.getItem('deutsch-level') ?? undefined;

  const srsRemote = srsFromRows((await c.from('srs_state').select()).data ?? []);
  const srsMerged = mergeSrs(s.srs ?? {}, srsRemote);

  const setRemote = settingsFromRow(
    ((await c.from('settings').select()).data ?? [])[0] ?? { data: {} }
  );
  const setMerged = mergeSettings(
    {
      gamification: s.gamification,
      learnedWords: s.learnedWords,
      level,
      settingsUpdatedAt: s.settingsUpdatedAt,
    },
    setRemote.settingsUpdatedAt == null ? null : setRemote
  );

  const dailyRemote = dailyFromRows((await c.from('stats_daily').select()).data ?? []);
  const local = s.daily ?? {};
  const nextLastSynced = { ...meta.lastSyncedCounters };
  const serverWrites = {};
  for (const day of new Set([...Object.keys(local), ...Object.keys(dailyRemote)])) {
    const res = mergeDailyAdditive({
      local: local[day],
      server: dailyRemote[day],
      lastSynced: meta.lastSyncedCounters[day],
    });
    serverWrites[day] = res.server;
    // Pull spec: lastSynced = server_counters (not local pre-merge baseline).
    nextLastSynced[day] = serverWrites[day];
  }

  if (Object.keys(serverWrites).length) {
    await c.from('stats_daily').upsert(withUser(dailyToRows(serverWrites), userId));
  }

  saveState({
    ...s,
    srs: srsMerged,
    daily: serverWrites,
    gamification: setMerged.gamification ?? s.gamification,
    learnedWords: setMerged.learnedWords ?? s.learnedWords,
    settingsUpdatedAt: setMerged.settingsUpdatedAt ?? s.settingsUpdatedAt,
  });
  if (setMerged.level) localStorage.setItem('deutsch-level', setMerged.level);
  saveSyncMeta({ lastSyncedCounters: nextLastSynced, lastSyncedAt: Date.now() });

  if (Object.keys(srsMerged).length) {
    await c.from('srs_state').upsert(withUser(srsToRows(srsMerged), userId));
  }
  await c.from('settings').upsert([
    {
      ...settingsToRow(
        {
          gamification: setMerged.gamification,
          learnedWords: setMerged.learnedWords,
          settingsUpdatedAt: setMerged.settingsUpdatedAt,
        },
        setMerged.level
      ),
      user_id: userId,
    },
  ]);
}

/** Debounced push and tab-resume both call the reconcile path (no naive daily overwrite). */
export async function pushAll(userId) {
  return pullAndMerge(userId);
}

const DEBOUNCE_MS = 3000;
const listeners = new Set();
let status = { pending: false, lastSyncedAt: null };
let activeUserId = null;
let debounceTimer = null;
let visibilityHandler = null;
let forceEnabledForTest = false;

function syncEnabled() {
  return forceEnabledForTest || import.meta.env.VITE_SYNC_ENABLED === 'true';
}

function emitStatus() {
  for (const fn of listeners) fn(status);
}

function setStatus(next) {
  status = next;
  emitStatus();
}

export function getSyncStatus() {
  return status;
}

export function subscribeSyncStatus(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function reconcileNow(userId) {
  setStatus({ ...status, pending: true });
  try {
    await pullAndMerge(userId);
    const meta = loadSyncMeta();
    setStatus({ pending: false, lastSyncedAt: meta.lastSyncedAt });
  } catch {
    setStatus({ pending: false, lastSyncedAt: status.lastSyncedAt });
  }
}

export function markDirty() {
  if (!syncEnabled() || !activeUserId) return;
  setStatus({ ...status, pending: true });
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void reconcileNow(activeUserId);
  }, DEBOUNCE_MS);
}

export function start(userId) {
  if (!syncEnabled()) return;
  activeUserId = userId;
  if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
  visibilityHandler = () => {
    if (document.visibilityState === 'visible' && activeUserId) {
      void reconcileNow(activeUserId);
    }
  };
  document.addEventListener('visibilitychange', visibilityHandler);
  void reconcileNow(userId);
}

export function stop() {
  activeUserId = null;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }
  setStatus({ pending: false, lastSyncedAt: status.lastSyncedAt });
}

/** Test seam — optional `{ enabled: true, userId }` seeds an active session. */
export function __resetSyncState({ enabled, userId } = {}) {
  forceEnabledForTest = enabled ?? false;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }
  activeUserId = userId ?? null;
  setStatus({ pending: false, lastSyncedAt: null });
  testClient = null;
}
