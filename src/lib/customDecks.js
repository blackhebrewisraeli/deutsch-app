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

export const CUSTOM_DECK_ID = 'custom';

// A generated deck is ~10 cards. This is not a product limit — it is a guard on
// the blob: saveState() swallows quota failures, so one pathological response
// would silently drop the ENTIRE write, taking learnedWords and stats with it.
export const MAX_CARDS_PER_DECK = 100;

const isUsableCard = (c) => c && typeof c.id === 'string' && c.id.length > 0;

/**
 * Read the decks slice out of a state blob, defensively.
 *
 * localStorage is user-controlled and may hold a blob written by an older
 * build (no `decks` key at all) or a corrupted one. Anything unusable is
 * dropped rather than thrown, because a bad deck must never stop the app from
 * loading the rest of the learner's progress.
 *
 * @param {object|null|undefined} state
 * @returns {Record<string, {deckId: string, name: string, cards: object[], updatedAt: number|null}>}
 */
export function readDecks(state) {
  const raw = state?.decks;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

  const out = {};
  for (const [deckId, deck] of Object.entries(raw)) {
    if (!deckId || !deck || typeof deck !== 'object' || !Array.isArray(deck.cards)) continue;
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
    };
  }
  return out;
}

/**
 * Add or replace one deck. Returns a NEW map; the input is never mutated.
 * A deck with no usable cards is rejected outright — storing an empty deck
 * would put an entry in the picker that cannot be drilled.
 */
export function upsertDeck(decks, { deckId, name, cards } = {}, now = Date.now()) {
  const base = decks && typeof decks === 'object' ? decks : {};
  if (!deckId || !Array.isArray(cards)) return base;

  const usable = cards.filter(isUsableCard).slice(0, MAX_CARDS_PER_DECK);
  if (usable.length === 0) return base;

  return {
    ...base,
    [deckId]: {
      deckId,
      name: typeof name === 'string' && name ? name : deckId,
      cards: usable,
      updatedAt: now,
    },
  };
}

/** The cards for one deck, or null when it is absent — VocabTab's shape. */
export function cardsFor(decks, deckId) {
  const cards = decks?.[deckId]?.cards;
  return Array.isArray(cards) && cards.length > 0 ? cards : null;
}
