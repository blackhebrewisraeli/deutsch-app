// Map the local blob slices ↔ Supabase row shapes. pack_id is always 'de' for
// now; the engine adds user_id. These are pure transforms — no I/O.

const toIso = (ms) => (ms == null || Number.isNaN(ms) ? null : new Date(ms).toISOString());
const toMs = (iso) => {
  if (iso == null) return null;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : ms;
};

export function srsToRows(srs) {
  return Object.entries(srs).map(([srs_key, c]) => ({
    srs_key,
    box: c.box,
    last_reviewed: toIso(c.lastReviewed),
    next_due: toIso(c.nextDue),
    reps: c.reps,
  }));
}
export function srsFromRows(rows) {
  const out = {};
  for (const r of rows) {
    out[r.srs_key] = {
      box: r.box,
      lastReviewed: toMs(r.last_reviewed),
      nextDue: toMs(r.next_due),
      reps: r.reps,
    };
  }
  return out;
}

export function dailyToRows(daily) {
  return Object.entries(daily).map(([day, counters]) => ({ day, counters }));
}
export function dailyFromRows(rows) {
  const out = {};
  for (const r of rows) out[r.day] = r.counters;
  return out;
}

// Settings is one row. `level` lives in a separate localStorage key, so the
// engine passes it in / reads it out. `levelUpdatedAt` travels alongside it —
// level gets its own LWW clock, independent of settingsUpdatedAt (see
// mergeSettings in sync/merge.js).
export function settingsToRow(local, level, levelUpdatedAt) {
  return {
    data: {
      goal: local.gamification?.goal,
      soundOn: local.gamification?.soundOn,
      achievements: local.gamification?.achievements,
      lastGoalMet: local.gamification?.lastGoalMet,
      frozenDays: local.gamification?.frozenDays,
      bestStreak: local.gamification?.bestStreak,
      lastReconcileDay: local.gamification?.lastReconcileDay,
      // League-winner claim set. WITHOUT this the reward was re-awarded on
      // every load: claimWinnerRewards dedups on gamification.leagueClaimed,
      // but the reconcile replaces local gamification with the merged blob,
      // so a claim set that never round-tripped was erased and every past
      // rank-1 result looked unclaimed again (+50 XP each, every refresh).
      leagueClaimed: local.gamification?.leagueClaimed,
      learnedWords: local.learnedWords,
      level,
      levelUpdatedAt,
      settingsUpdatedAt: local.settingsUpdatedAt,
      // Placement metadata is additive on the same jsonb blob. It is not a
      // new localStorage key — AGENTS.md forbids renaming those. An older
      // client that does not name this field simply omits it (allowlist).
      placement: local.placement,
      // Phase 4: opt-in topic ids. Additive; an older client omits the key.
      enabledInterests: local.enabledInterests,
      // Phase 5: learner model band. Additive; missing → client treats as auto.
      preferredModel: local.preferredModel,
      // One-shot 3-deck placement retake invite. Additive; older clients omit it.
      placementOffer: local.placementOffer,
    },
  };
}
export function settingsFromRow(row) {
  const d = row.data ?? {};
  return {
    gamification: {
      goal: d.goal,
      soundOn: d.soundOn,
      achievements: d.achievements,
      lastGoalMet: d.lastGoalMet,
      frozenDays: d.frozenDays ?? {},
      bestStreak: d.bestStreak ?? 0,
      lastReconcileDay: d.lastReconcileDay ?? null,
      // [] not undefined: mergeSettings union-merges this, and a missing side
      // must read as "claimed nothing", never as "drop the other side's ids".
      leagueClaimed: Array.isArray(d.leagueClaimed) ? d.leagueClaimed : [],
    },
    learnedWords: d.learnedWords ?? {},
    level: d.level,
    levelUpdatedAt: d.levelUpdatedAt,
    settingsUpdatedAt: d.settingsUpdatedAt,
    placement: d.placement,
    enabledInterests: d.enabledInterests,
    preferredModel: d.preferredModel,
    placementOffer: d.placementOffer,
  };
}

// Decks ↔ rows. `cards` is an opaque jsonb payload, carried whole.
//
// A deck whose updatedAt is null (only reachable from a hand-corrupted blob —
// upsertDeck always stamps one) OMITS the column rather than sending null:
// decks.updated_at is NOT NULL with a `now()` default, so omitting it lets the
// server stamp the row instead of failing the write or fabricating a timestamp
// that would win LWW forever.
export function decksToRows(decks) {
  return Object.entries(decks ?? {}).map(([deckId, d]) => {
    const row = {
      deck_id: deckId,
      name: d?.name ?? deckId,
      cards: d?.cards ?? [],
      // ALWAYS sent, null included: regenerating into a tombstoned slot has to
      // CLEAR deleted_at on the server. Omitting it on the live case would
      // leave the old tombstone standing and the deck would vanish again on
      // the next pull.
      deleted_at: toIso(d?.deletedAt),
    };
    const updated = toIso(d?.updatedAt);
    if (updated !== null) row.updated_at = updated;
    return row;
  });
}

export function decksFromRows(rows) {
  const out = {};
  for (const r of rows ?? []) {
    if (!r?.deck_id) continue;
    // Tombstoned rows are KEPT, not filtered. A deletion only wins the merge
    // if the merge can see it; dropping it here would make the server look like
    // it simply has no deck, and the local copy would be pushed straight back.
    const deletedAt = toMs(r.deleted_at);
    out[r.deck_id] = {
      deckId: r.deck_id,
      name: r.name ?? r.deck_id,
      cards: deletedAt === null && Array.isArray(r.cards) ? r.cards : [],
      updatedAt: toMs(r.updated_at),
      deletedAt,
    };
  }
  return out;
}

// learnedByDeck rides its OWN COLUMN on settings, never a key inside `data`.
// settingsToRow above is an explicit allowlist, so an older client serialises
// only the fields it knows and would erase any unknown key inside `data` on its
// next push. A column it never names survives, because PostgREST's
// ON CONFLICT DO UPDATE SET touches only the columns the payload carries.
export function learnedByDeckToColumn(learnedByDeck) {
  return learnedByDeck && Object.keys(learnedByDeck).length > 0 ? learnedByDeck : {};
}

export function learnedByDeckFromRow(row) {
  const raw = row?.learned_by_deck;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [deckId, cards] of Object.entries(raw)) {
    if (!deckId || !cards || typeof cards !== 'object' || Array.isArray(cards)) continue;
    const kept = {};
    for (const [cardId, on] of Object.entries(cards))
      if (on === true && cardId) kept[cardId] = true;
    if (Object.keys(kept).length > 0) out[deckId] = kept;
  }
  return out;
}
