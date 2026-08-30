// Per-deck completion, derived from data App already holds. No storage reads,
// no network, no DOM — everything is injected, mirroring lib/missions.js so the
// mission pipeline stays pure end to end.
//
// This is the same arithmetic ui/DeckProgress.jsx does for the ACTIVE deck
// (`cards.filter((c) => learnedWords[c.id]).length`), widened to every deck it
// is handed. There is deliberately no Supabase work here: `learnedWords` is
// already App state and already synced inside settings.data.learnedWords.
//
// `learnedWords` is keyed by CARD ID and is a vocabulary-mastery flag, not a
// per-deck completion record — so a card id appearing in two decks counts in
// both. The four curated decks are disjoint and deckProgress.test.js pins that,
// so the assumption is enforced rather than hoped for.

import { learnedInDeck } from './learnedWords.js';

/**
 * @param {object} args
 * @param {Record<string, Array<{id: string}>>} args.decks deckId → cards
 * @param {Record<string, unknown>} args.learnedWords legacy flat map, card id → truthy
 * @param {Record<string, Record<string, true>>} [args.learnedByDeck] deck-scoped mastery
 * @returns {Array<{deckId: string, done: number, total: number}>}
 */
export function deckProgressFor({ decks = null, learnedWords = null, learnedByDeck = null } = {}) {
  if (!decks || typeof decks !== 'object') return [];

  return Object.entries(decks)
    .filter(([, cards]) => Array.isArray(cards) && cards.length > 0)
    .map(([deckId, cards]) => ({
      deckId,
      done: learnedInDeck({ learnedByDeck, learnedWords, deckId, cards }),
      total: cards.length,
    }));
}
