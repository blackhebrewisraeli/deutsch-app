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

// Floor every counter leaf at 0. Daily counters are monotonic, so a negative
// value only arises when a local baseline desyncs (storage cleared/evicted) —
// it must never propagate to the shared server.
export function clampCounters(counters) {
  return combine(counters, counters, (x) => Math.max(0, x));
}

// Delta-sync for one day's counters. Push the change since last sync so a
// repeated sync is a no-op and guest data (lastSynced absent → delta = whole
// local value) folds in exactly once.
export function mergeDailyAdditive({ local, server, lastSynced }) {
  // Counters only ever increase. A negative delta means local fell behind its
  // own baseline (cleared/evicted storage, or a desync), so floor it at 0 —
  // never push a decrement to the shared server; the device re-syncs up instead.
  const delta = clampCounters(subCounters(local, lastSynced)); // lastSynced undefined → delta = local
  return {
    server: addCounters(server, delta),
    lastSynced: local, // advance the baseline to what we just pushed
  };
}

// Settings is one jsonb blob per user → whole-object LWW by settingsUpdatedAt
// (missing side loses; exact tie → remote) — EXCEPT learnedWords, which is
// accumulative like SRS, so we union it (a word stays learned if either device
// has it). That keeps whole-object LWW from dropping a learned mark across
// devices (#41). The union is skipped when neither side tracks learnedWords.
export function mergeSettings(local, remote) {
  if (!local) return remote;
  if (!remote) return local;
  const lt = local.settingsUpdatedAt ?? -Infinity;
  const rt = remote.settingsUpdatedAt ?? -Infinity;
  const winner = lt > rt ? local : remote;
  const lw = local.learnedWords;
  const rw = remote.learnedWords;
  if (lw === undefined && rw === undefined) return winner;
  const learnedWords = {};
  for (const word of new Set([...Object.keys(lw ?? {}), ...Object.keys(rw ?? {})])) {
    learnedWords[word] = Boolean(lw?.[word] || rw?.[word]);
  }
  return { ...winner, learnedWords };
}
