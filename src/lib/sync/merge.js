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
// (missing side loses; exact tie → remote) — EXCEPT fields that whole-row LWW
// must never clobber: learnedWords (union, #41), the streak freeze state —
// gamification.frozenDays (union) + gamification.bestStreak (max) — and level,
// which gets its OWN timestamp (levelUpdatedAt) rather than riding the shared
// settingsUpdatedAt. Without that, a device whose *unrelated* local write is
// merely newer than the server's last settings write can drag level backwards
// even though that device never touched level this session (regression
// 2026-08-24: a stale local a1 clobbered a correctly-set server b1).
export function mergeSettings(local, remote) {
  if (!local) return remote;
  if (!remote) return local;
  const lt = local.settingsUpdatedAt ?? -Infinity;
  const rt = remote.settingsUpdatedAt ?? -Infinity;
  const winner = lt > rt ? local : remote;
  const out = { ...winner };

  // level: independent LWW by levelUpdatedAt, not the whole-row winner.
  if (local.level !== undefined || remote.level !== undefined) {
    const llt = local.levelUpdatedAt ?? -Infinity;
    const rlt = remote.levelUpdatedAt ?? -Infinity;
    const levelWinner = llt > rlt ? local : remote;
    out.level = levelWinner.level;
    out.levelUpdatedAt = levelWinner.levelUpdatedAt;
  }

  // learnedWords: union — a word stays learned if either device has it (#41).
  const lw = local.learnedWords;
  const rw = remote.learnedWords;
  if (lw !== undefined || rw !== undefined) {
    const learnedWords = {};
    for (const word of new Set([...Object.keys(lw ?? {}), ...Object.keys(rw ?? {})])) {
      learnedWords[word] = Boolean(lw?.[word] || rw?.[word]);
    }
    out.learnedWords = learnedWords;
  }

  // gamification.frozenDays union + bestStreak max — a freeze or record earned
  // on one device can't be dropped by the other device's older LWW write.
  const lg = local.gamification;
  const rg = remote.gamification;
  if (
    lg?.frozenDays !== undefined ||
    rg?.frozenDays !== undefined ||
    lg?.bestStreak !== undefined ||
    rg?.bestStreak !== undefined
  ) {
    const lf = lg?.frozenDays ?? {};
    const rf = rg?.frozenDays ?? {};
    const frozenDays = {};
    for (const day of new Set([...Object.keys(lf), ...Object.keys(rf)])) {
      frozenDays[day] = Boolean(lf[day] || rf[day]);
    }
    out.gamification = {
      ...(winner.gamification ?? {}),
      frozenDays,
      bestStreak: Math.max(lg?.bestStreak ?? 0, rg?.bestStreak ?? 0),
    };
  }

  return out;
}

// Decks: union of deck ids; per deck, the one with the more recent updatedAt
// wins. A real timestamp beats null/undefined; an exact tie resolves to remote
// (server), matching mergeSrs.
//
// PER-DECK, deliberately not whole-slice LWW. A deck is an independent record
// with its own primary key — (user_id, pack_id, deck_id) — so it gets its own
// clock. Whole-object LWW is what let an unrelated newer write on one device
// clobber a field it never touched (see mergeSettings' level carve-out, and the
// 2026-08-24 regression it exists for). One shared clock over independent
// records reproduces exactly that bug.
//
// The deck object is carried across WHOLE. Cards are an opaque jsonb payload to
// the engine: there is no per-card merge, because two devices editing the same
// generated deck is not a thing the app can produce — a generation replaces the
// slot outright.
export function mergeDecks(local, remote) {
  const out = { ...(remote ?? {}) };
  for (const [deckId, l] of Object.entries(local ?? {})) {
    const r = out[deckId];
    if (!r) {
      out[deckId] = l;
      continue;
    }
    const lt = l?.updatedAt ?? -Infinity;
    const rt = r?.updatedAt ?? -Infinity;
    out[deckId] = lt > rt ? l : r; // strict > → ties keep remote
  }
  return out;
}
