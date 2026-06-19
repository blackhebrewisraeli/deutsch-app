// Pure, I/O-free record merge for the sync engine. Each function takes two
// plain objects (local, remote) and returns the merged result. No localStorage,
// no network — fully unit-testable.

// SRS: union of cards; per card, the one with the more recent lastReviewed wins.
// A real timestamp beats null/undefined; an exact tie resolves to remote (server).
export function mergeSrs(local, remote) {
  const out = { ...remote };
  for (const [key, l] of Object.entries(local)) {
    const r = remote[key];
    if (!r) {
      out[key] = l;
      continue;
    }
    const lt = l.lastReviewed ?? -Infinity;
    const rt = r.lastReviewed ?? -Infinity;
    out[key] = lt > rt ? l : r; // strict > → ties keep remote
  }
  return out;
}

// Deep zero-filled merge over the daily counter shape. We walk the union of
// keys so a missing side counts as 0 and the shape is preserved.
function combine(a, b, op) {
  if (typeof a === 'number' || typeof b === 'number') {
    return op(a ?? 0, b ?? 0);
  }
  const out = {};
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  for (const k of keys) out[k] = combine(a?.[k], b?.[k], op);
  return out;
}

export function addCounters(a, b) {
  return combine(a, b, (x, y) => x + y);
}
export function subCounters(a, b) {
  return combine(a, b, (x, y) => x - y);
}

// Delta-sync for one day's counters. Push the change since last sync so a
// repeated sync is a no-op and guest data (lastSynced absent → delta = whole
// local value) folds in exactly once.
export function mergeDailyAdditive({ local, server, lastSynced }) {
  const delta = subCounters(local, lastSynced); // lastSynced undefined → delta = local
  return {
    server: addCounters(server, delta),
    lastSynced: local, // advance the baseline to what we just pushed
  };
}

// Settings is one jsonb blob per user → whole-object LWW by settingsUpdatedAt.
// Missing side loses; exact tie resolves to remote (server).
export function mergeSettings(local, remote) {
  if (!local) return remote;
  if (!remote) return local;
  const lt = local.settingsUpdatedAt ?? -Infinity;
  const rt = remote.settingsUpdatedAt ?? -Infinity;
  return lt > rt ? local : remote;
}
