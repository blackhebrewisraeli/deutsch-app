// Deck-scoped vocabulary mastery, and the bridge back to the flat map it
// replaces. Pure — no storage, no network, no DOM.
//
// THE SHAPE
//
//   learnedByDeck = { greetings: { "Hallo": true }, "cefr-a1": { "zwei": true } }
//
// Deck id → card id → true, mirroring the SRS key it shadows. Nested rather
// than "greetings:Hallo" string keys because "everything learned in this deck"
// is what every reader actually wants, and because a whole deck's entry can
// then be dropped when a custom deck is deleted.
//
// Only `true` is ever stored. The old flat writer toggled (`!prev[word]`, fixed
// 2026-08-30), and storing presence rather than a boolean makes that class of
// bug unrepresentable: a key exists or it does not.
//
// THE TRANSITION
//
// `learnedWords` — the legacy flat map — is NOT removed, renamed or pruned.
// Reads consult the scoped map first and fall back to it, so:
//
//   - a word learned before the migration and attributed by backfillFromSrs
//     reads as learned in its own deck;
//   - a word learned before the migration that could NOT be attributed still
//     reads as learned in every deck containing it, exactly as today;
//   - a word learned after the migration marks only its own deck.
//
// Nobody ever sees a word un-learn itself, and the collision decays as learners
// re-answer. Pruning the flat map is deliberately NOT done here: it is
// union-merged across devices, so a deleted key is resurrected by the next push
// from any device that still holds it.

/** Everything learned in one deck, as a plain object (never null). */
const deckMap = (learnedByDeck, deckId) => learnedByDeck?.[deckId] ?? {};

/**
 * Is this card learned, in THIS deck? Scoped first, legacy second.
 *
 * @param {object} args
 * @param {Record<string, Record<string, true>>} [args.learnedByDeck]
 * @param {Record<string, unknown>} [args.learnedWords] legacy flat map
 * @param {string} args.deckId
 * @param {string} args.cardId
 */
export function isLearned({ learnedByDeck = null, learnedWords = null, deckId, cardId } = {}) {
  if (!cardId) return false;
  if (deckMap(learnedByDeck, deckId)[cardId] === true) return true;
  return Boolean(learnedWords?.[cardId]);
}

/**
 * Record a card as learned in one deck. Returns a NEW map; the input is never
 * mutated. Sets, never toggles — see the note above.
 */
export function markLearnedIn(learnedByDeck, deckId, cardId) {
  const base = learnedByDeck && typeof learnedByDeck === 'object' ? learnedByDeck : {};
  if (!deckId || !cardId) return base;
  if (base[deckId]?.[cardId] === true) return base; // already known, no churn

  return { ...base, [deckId]: { ...base[deckId], [cardId]: true } };
}

/** Drop a whole deck's mastery — used when a custom deck is deleted. */
export function forgetDeck(learnedByDeck, deckId) {
  const base = learnedByDeck && typeof learnedByDeck === 'object' ? learnedByDeck : {};
  if (!deckId || !(deckId in base)) return base;
  const next = { ...base };
  delete next[deckId];
  return next;
}

/**
 * How many DISTINCT words the learner knows, across both maps.
 *
 * Distinct is the point. During the transition the same word can appear as a
 * legacy flat key AND under one or more decks; counting keys would report it
 * two or three times and inflate the number on Home.
 */
export function learnedCountOf(learnedByDeck, learnedWords) {
  const words = new Set();
  for (const [word, on] of Object.entries(learnedWords ?? {})) if (on) words.add(word);
  for (const cards of Object.values(learnedByDeck ?? {})) {
    for (const [word, on] of Object.entries(cards ?? {})) if (on === true) words.add(word);
  }
  return words.size;
}

/** How many of a deck's cards are learned, under the dual read. */
export function learnedInDeck({ learnedByDeck, learnedWords, deckId, cards }) {
  if (!Array.isArray(cards)) return 0;
  return cards.filter((c) => c && isLearned({ learnedByDeck, learnedWords, deckId, cardId: c.id }))
    .length;
}

/**
 * Attribute legacy flat keys to the decks they were learned in, using the SRS
 * rows the learner already left behind.
 *
 * `recordVocabAnswer(deckId, cardId, verdict)` writes `deckId:cardId`, and
 * `advanceQueue` is reachable only from the SRS verdict buttons — a learner
 * cannot progress through a deck without leaving those rows. So SRS is a
 * faithful record of WHERE a word was practised. Measured on production: 39 of
 * 39 flat keys attributable, none unattributable.
 *
 * Deliberately additive and idempotent:
 *   - a word with no SRS row is left alone, served by the legacy fallback.
 *     Fanning it out to every deck containing it would bake today's wrong
 *     answer permanently into the new shape.
 *   - nothing is deleted from the flat map (it is union-merged; see above).
 *   - re-running folds in flat keys that arrived since, which is what a device
 *     syncing with an older one needs.
 *
 * @param {object} args
 * @param {Record<string, unknown>} args.learnedWords legacy flat map
 * @param {Record<string, unknown>} args.srs keyed `<deckId>:<cardId>`
 * @param {Record<string, Record<string, true>>} [args.learnedByDeck] existing scoped map
 * @returns {{ learnedByDeck: object, attributed: number, unattributed: number }}
 */
export function backfillFromSrs({ learnedWords = null, srs = null, learnedByDeck = null } = {}) {
  let next = learnedByDeck && typeof learnedByDeck === 'object' ? learnedByDeck : {};

  // cardId → the decks it has been practised in.
  const decksByCard = new Map();
  for (const key of Object.keys(srs ?? {})) {
    const sep = key.indexOf(':');
    if (sep <= 0) continue; // not a '<deckId>:<cardId>' key — ignore rather than guess
    const deckId = key.slice(0, sep);
    const cardId = key.slice(sep + 1);
    if (!cardId) continue;
    if (!decksByCard.has(cardId)) decksByCard.set(cardId, []);
    decksByCard.get(cardId).push(deckId);
  }

  let attributed = 0;
  let unattributed = 0;
  for (const [cardId, on] of Object.entries(learnedWords ?? {})) {
    if (!on) continue;
    const decks = decksByCard.get(cardId);
    if (!decks?.length) {
      unattributed += 1;
      continue;
    }
    for (const deckId of decks) next = markLearnedIn(next, deckId, cardId);
    attributed += 1;
  }

  return { learnedByDeck: next, attributed, unattributed };
}

/** Defensive read of the slice out of a state blob — localStorage is user-controlled. */
export function readLearnedByDeck(state) {
  const raw = state?.learnedByDeck;
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
