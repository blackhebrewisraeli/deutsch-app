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
      learnedWords: local.learnedWords,
      level,
      levelUpdatedAt,
      settingsUpdatedAt: local.settingsUpdatedAt,
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
    },
    learnedWords: d.learnedWords ?? {},
    level: d.level,
    levelUpdatedAt: d.levelUpdatedAt,
    settingsUpdatedAt: d.settingsUpdatedAt,
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
    const row = { deck_id: deckId, name: d?.name ?? deckId, cards: d?.cards ?? [] };
    const updated = toIso(d?.updatedAt);
    if (updated !== null) row.updated_at = updated;
    return row;
  });
}

export function decksFromRows(rows) {
  const out = {};
  for (const r of rows ?? []) {
    if (!r?.deck_id) continue;
    out[r.deck_id] = {
      deckId: r.deck_id,
      name: r.name ?? r.deck_id,
      cards: Array.isArray(r.cards) ? r.cards : [],
      updatedAt: toMs(r.updated_at),
    };
  }
  return out;
}
