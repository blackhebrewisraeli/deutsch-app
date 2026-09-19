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

// Union of claimed league ids, de-duplicated and order-stable: local order
// first, then any id only the remote side has. Re-running the same reconcile
// therefore yields the same array, which is what makes the claim set usable as
// an idempotency key at all.
function mergeLeagueClaimed(localIds, remoteIds) {
  const out = [];
  for (const id of [...(localIds ?? []), ...(remoteIds ?? [])]) {
    if (id != null && !out.includes(id)) out.push(id);
  }
  return out;
}

// Union of earned badges: id → the timestamp it was earned. Append-only — no
// path in the app un-earns a badge — so a side that is missing an id means
// "never saw it", never "dropped it". Where both sides have the id the EARLIER
// stamp wins: that is when the badge was actually earned, and a device that
// lost the map and re-awarded it must not overwrite the real date with today's.
function mergeAchievements(localMap, remoteMap) {
  const out = {};
  for (const [id, ts] of [...Object.entries(localMap ?? {}), ...Object.entries(remoteMap ?? {})]) {
    const seen = out[id];
    if (seen === undefined) out[id] = ts;
    else if (typeof ts === 'number' && (typeof seen !== 'number' || ts < seen)) out[id] = ts;
  }
  return out;
}

// The day the daily goal was last met ('YYYY-MM-DD'), or null for "not yet".
// null is the ABSENCE of information, so it must never overwrite a real day
// key; two real keys resolve to the later one (day keys sort lexically).
function mergeLastGoalMet(localDay, remoteDay) {
  if (!localDay) return remoteDay ?? null;
  if (!remoteDay) return localDay;
  return localDay > remoteDay ? localDay : remoteDay;
}

// Settings is one jsonb blob per user → whole-object LWW by settingsUpdatedAt
// (missing side loses; exact tie → remote) — EXCEPT fields that whole-row LWW
// must never clobber: learnedWords (union, #41), the streak freeze state —
// gamification.frozenDays (union) + gamification.bestStreak (max) — the league
// reward claim set (gamification.leagueClaimed, union), the earned-badge ledger
// (gamification.achievements, union) and its goal twin
// (gamification.lastGoalMet, never null-over-a-date) — and level,
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
    // Placement is how that level was set. It follows the same clock so a
    // stale device cannot keep an older score next to a newer CEFR code.
    out.placement = levelWinner.placement;
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
  // leagueClaimed unions for the same reason, and for a sharper one: it is an
  // IDEMPOTENCY KEY, not a preference. Whole-row LWW handed the loser's claim
  // set to the winner, so a device whose unrelated write was merely older had
  // its claims erased — and claimWinnerRewards, seeing no claim for a league it
  // had already paid out, awarded WINNER_BONUS_XP again on the next load.
  //
  // achievements and lastGoalMet are the same kind of field one step further:
  // they are the DEDUP KEYS for the celebration toasts. Whole-row LWW handed
  // the loser's badge ledger to the winner, so a device whose unrelated write
  // was merely older had its ledger emptied — and applyProgress, finding ids it
  // had already awarded missing from the map, fired "Achievement freigeschaltet"
  // for every badge again on the next load and every focus after it.
  const lg = local.gamification;
  const rg = remote.gamification;
  const hasKey = (key) => lg?.[key] !== undefined || rg?.[key] !== undefined;
  if (
    hasKey('frozenDays') ||
    hasKey('bestStreak') ||
    hasKey('leagueClaimed') ||
    hasKey('achievements') ||
    hasKey('lastGoalMet')
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
      leagueClaimed: mergeLeagueClaimed(lg?.leagueClaimed, rg?.leagueClaimed),
    };
    // Branch on the KEY, not on the value: setting these unconditionally would
    // fabricate an empty ledger / a null day for a blob that never carried
    // either, and the winner's own absence is information the merge must keep.
    if (hasKey('achievements')) {
      out.gamification.achievements = mergeAchievements(lg?.achievements, rg?.achievements);
    }
    if (hasKey('lastGoalMet')) {
      out.gamification.lastGoalMet = mergeLastGoalMet(lg?.lastGoalMet, rg?.lastGoalMet);
    }
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

// Deck-scoped mastery: union of deck ids; per deck, union of card ids.
//
// Union for the same reason learnedWords is union-merged (#41): a word learned
// on either device is learned, and no path in the app un-learns one. There is
// therefore nothing here that needs a tombstone — the one genuine deletion, a
// removed custom deck, drops that deck's entry locally and is carried by the
// deck tombstone that already exists.
//
// Deliberately NOT last-write-wins. Whole-object LWW over independent records
// is what let an unrelated newer write drag `level` backwards (2026-08-24), and
// two devices practising different decks are exactly independent records.
export function mergeLearnedByDeck(local, remote) {
  const out = {};
  const decks = new Set([...Object.keys(local ?? {}), ...Object.keys(remote ?? {})]);
  for (const deckId of decks) {
    const l = local?.[deckId] ?? {};
    const r = remote?.[deckId] ?? {};
    const cards = {};
    for (const cardId of new Set([...Object.keys(l), ...Object.keys(r)])) {
      if (l[cardId] === true || r[cardId] === true) cards[cardId] = true;
    }
    if (Object.keys(cards).length > 0) out[deckId] = cards;
  }
  return out;
}
