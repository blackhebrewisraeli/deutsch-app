// Custom (AI-generated) decks, as a slice of the local state blob.
//
// Pure — no storage reads, no network, no DOM. The caller loads and saves the
// blob; these helpers only reshape it, which is what makes them testable and
// what keeps the single-writer discipline in App (`saveState({ ...cur, … })`).
//
// The shape mirrors the `public.decks` table's primary key —
// `(user_id, pack_id, deck_id)` — so the sync adapter in phase 2 is a rename
// rather than a reshape:
//
//   state.decks = { custom: { deckId, name, cards, updatedAt } }
//
// `updatedAt` is stamped on every write even though nothing reads it yet: it is
// the per-deck LWW clock the sync merge will compare, and a deck written before
// sync existed must not arrive with a null one.

import { MAX_CUSTOM_DECKS } from './gameConfig.js';

export const CUSTOM_DECK_ID = 'custom';

/**
 * A fresh deck id.
 *
 * RANDOM, never derived from the topic. mergeDecks resolves a shared id by
 * last-write-wins, so two devices minting the same id for DIFFERENT decks would
 * silently discard one — identity here is data safety, not tidiness. A hash of
 * the topic would make two "weather" decks collide by design and let a
 * regeneration overwrite the earlier deck.
 *
 * randomUUID needs a secure context; the fallback carries a timestamp plus ~40
 * bits of randomness, which is ample for one learner's own decks.
 */
export function newDeckId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `custom-${uuid}`;
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// A generated deck is ~10 cards. This is not a product limit — it is a guard on
// the blob: saveState() swallows quota failures, so one pathological response
// would silently drop the ENTIRE write, taking learnedWords and stats with it.
export const MAX_CARDS_PER_DECK = 100;

export { MAX_CUSTOM_DECKS };

const isUsableCard = (c) => c && typeof c.id === 'string' && c.id.length > 0;
const tombstoneTime = (deck) => (Number.isFinite(deck?.deletedAt) ? deck.deletedAt : null);

/** True when this entry records a deletion rather than a deck. */
export function isTombstone(deck) {
  return tombstoneTime(deck) !== null;
}

/**
 * Read the decks slice out of a state blob, defensively.
 *
 * localStorage is user-controlled and may hold a blob written by an older
 * build (no `decks` key at all) or a corrupted one. Anything unusable is
 * dropped rather than thrown, because a bad deck must never stop the app from
 * loading the rest of the learner's progress.
 *
 * Tombstones are KEPT, cards and all-usable-cards rules waived. They carry no
 * cards by design, so the usable-card filter would drop exactly the records
 * whose whole job is to outlive the deck — and a dropped tombstone is a deck
 * that comes back on the next pull. Use liveDecks() for anything the learner
 * should see.
 *
 * @param {object|null|undefined} state
 * @returns {Record<string, {deckId: string, name: string, cards: object[], updatedAt: number|null}>}
 */
export function readDecks(state) {
  const raw = state?.decks;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

  const out = {};
  for (const [deckId, deck] of Object.entries(raw)) {
    if (!deckId || !deck || typeof deck !== 'object') continue;

    const deletedAt = tombstoneTime(deck);
    if (deletedAt !== null) {
      out[deckId] = {
        deckId,
        name: typeof deck.name === 'string' && deck.name ? deck.name : deckId,
        cards: [],
        updatedAt: Number.isFinite(deck.updatedAt) ? deck.updatedAt : deletedAt,
        deletedAt,
      };
      continue;
    }

    if (!Array.isArray(deck.cards)) continue;
    // A card with no id cannot be tracked: learnedWords and srsKey are both
    // keyed by it, so it would be undrillable rather than merely odd.
    const cards = deck.cards.filter(isUsableCard).slice(0, MAX_CARDS_PER_DECK);
    if (cards.length === 0) continue;

    out[deckId] = {
      // Taken from the KEY, not the stored field, so a blob whose inner deckId
      // disagrees with its key cannot address a different deck.
      deckId,
      name: typeof deck.name === 'string' && deck.name ? deck.name : deckId,
      cards,
      updatedAt: Number.isFinite(deck.updatedAt) ? deck.updatedAt : null,
      deletedAt: null,
    };
  }
  return out;
}

/** Only the decks a learner can actually see and drill. */
export function liveDecks(decks) {
  const out = {};
  for (const [deckId, deck] of Object.entries(decks ?? {})) {
    if (!isTombstone(deck)) out[deckId] = deck;
  }
  return out;
}

/**
 * Replace a deck with a tombstone. Returns a NEW map.
 *
 * `updatedAt` is advanced to the deletion time on purpose: that is what makes
 * the merge need no special case at all. A tombstone is just the record whose
 * most recent write was a removal, so per-deck LWW compares it against an edit
 * the same way it compares two edits. Cards are dropped — a tombstone must not
 * keep carrying the payload it exists to retire.
 *
 * Deleting a deck that is not there is a no-op rather than a bare tombstone,
 * so a stray click cannot invent a record to sync.
 */
export function deleteDeck(decks, deckId, now = Date.now()) {
  const base = decks && typeof decks === 'object' ? decks : {};
  const existing = base[deckId];
  if (!deckId || !existing || isTombstone(existing)) return base;

  return {
    ...base,
    [deckId]: {
      deckId,
      name: existing.name ?? deckId,
      cards: [],
      updatedAt: now,
      deletedAt: now,
    },
  };
}

/**
 * Add or replace one deck. Returns a NEW map; the input is never mutated.
 * A deck with no usable cards is rejected outright — storing an empty deck
 * would put an entry in the picker that cannot be drilled.
 *
 * THE CAP LIVES HERE, and only here. This is the creation path: sync never
 * calls it (it uses mergeDecks), so enforcing a limit here cannot delete a deck
 * that arrived from another device. Two devices can each fill their quota
 * offline and legitimately union past the cap; the merge must leave that alone.
 *
 * The count is of LIVE decks. Counting raw entries would let a learner's own
 * tombstones fill the quota, locking them out after enough delete-and-retry.
 *
 * Replacing a deck that is already live is always allowed — it adds nothing.
 * Reviving a TOMBSTONED id does add one, so it is capped like any new deck.
 */
export function upsertDeck(
  decks,
  { deckId, name, cards } = {},
  now = Date.now(),
  max = MAX_CUSTOM_DECKS
) {
  const base = decks && typeof decks === 'object' ? decks : {};
  if (!deckId || !Array.isArray(cards)) return base;

  const usable = cards.filter(isUsableCard).slice(0, MAX_CARDS_PER_DECK);
  if (usable.length === 0) return base;

  const live = liveDecks(base);
  const addsADeck = !(deckId in live);
  if (addsADeck && Object.keys(live).length >= max) return base;

  return {
    ...base,
    [deckId]: {
      deckId,
      name: typeof name === 'string' && name ? name : deckId,
      cards: usable,
      updatedAt: now,
      // Regenerating into a tombstoned slot revives it. Explicitly null rather
      // than absent so the pushed row CLEARS deleted_at on the server instead
      // of leaving a live deck married to an old tombstone.
      deletedAt: null,
    },
  };
}

/**
 * The cards for one deck, or null when it is absent or tombstoned — VocabTab's
 * shape. A tombstone carries no cards, so this returns null for it either way;
 * the explicit check states the intent rather than relying on that.
 */
export function cardsFor(decks, deckId) {
  const deck = decks?.[deckId];
  if (!deck || isTombstone(deck)) return null;
  return Array.isArray(deck.cards) && deck.cards.length > 0 ? deck.cards : null;
}
