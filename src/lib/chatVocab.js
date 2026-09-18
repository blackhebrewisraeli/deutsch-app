// Chat vocabulary allowlist. Pure — no storage, no network, no DOM.
//
// The engine talks about card ids and caller-supplied surface forms. It never
// reads `card.de` (that field is a pack contract; ChatTab passes termOf).
// Sparse learners get a small starter set from pack curated decks rather than
// a hard failure or a dump of an entire CEFR auto-deck.

import { learnedIdsOf } from './learnedWords.js';

/** Below this many learned terms, mix in the starter scaffold. */
export const SPARSE_THRESHOLD = 8;

/** How many unique starter terms to pull from pack decks. */
export const STARTER_LIMIT = 12;

/** Prompt budget — keep the system prompt bounded. */
export const MAX_ALLOWLIST = 80;

/**
 * Index pack (or test) cards by id. Later decks do not overwrite an earlier
 * id, so curated order wins over anything the caller concatenates after.
 * @param {Record<string, Array<{ id?: string }>> | null | undefined} decks
 * @returns {Map<string, object>}
 */
export function indexCardsById(decks) {
  const map = new Map();
  for (const cards of Object.values(decks ?? {})) {
    if (!Array.isArray(cards)) continue;
    for (const card of cards) {
      if (card && typeof card.id === 'string' && card.id && !map.has(card.id)) {
        map.set(card.id, card);
      }
    }
  }
  return map;
}

/**
 * Surface form for a learned id. `termOf` is the pack's display function
 * (ChatTab passes `card => card.de`). Missing cards fall back to the id
 * itself — custom-deck keys and the German pack's id-is-the-word both work.
 * @param {string} cardId
 * @param {Map<string, object> | null | undefined} cardsById
 * @param {(card: object) => unknown} [termOf]
 * @returns {string}
 */
export function resolveTerm(cardId, cardsById, termOf) {
  if (typeof cardId !== 'string') return '';
  const trimmed = cardId.trim();
  if (!trimmed) return '';
  const card = cardsById?.get(trimmed);
  if (card && typeof termOf === 'function') {
    const term = termOf(card);
    if (typeof term === 'string' && term.trim()) return term.trim();
  }
  return trimmed;
}

/**
 * Small A1-scale scaffold from pack curated decks, in deck-then-card order.
 * Auto CEFR decks are not passed here — ChatTab hands `content.decks`, which
 * is greetings/food/travel/numbers, not the lexicon-sized `cefr-a1` view.
 * @param {object} args
 * @param {Record<string, object[]>} [args.decks]
 * @param {(card: object) => unknown} [args.termOf]
 * @param {number} [args.limit]
 * @returns {string[]}
 */
export function starterTermsFromDecks({ decks, termOf, limit = STARTER_LIMIT } = {}) {
  const cap = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : STARTER_LIMIT;
  const cardsById = indexCardsById(decks);
  const seen = new Set();
  const out = [];
  for (const cards of Object.values(decks ?? {})) {
    if (!Array.isArray(cards)) continue;
    for (const card of cards) {
      const id = typeof card?.id === 'string' ? card.id : '';
      const term = resolveTerm(id, cardsById, termOf);
      const key = term.toLowerCase();
      if (!term || seen.has(key)) continue;
      seen.add(key);
      out.push(term);
      if (out.length >= cap) return out;
    }
  }
  return out;
}

function uniqueSorted(terms, maxTerms) {
  const seen = new Set();
  const out = [];
  for (const term of terms) {
    if (typeof term !== 'string') continue;
    const trimmed = term.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  out.sort((a, b) => a.localeCompare(b));
  const cap = Number.isFinite(maxTerms) && maxTerms > 0 ? Math.floor(maxTerms) : MAX_ALLOWLIST;
  return out.slice(0, cap);
}

/**
 * Stable chat allowlist: learned terms, plus a starter scaffold when sparse.
 * Never throws. Empty inputs → empty vocab (the prompt handles that case).
 *
 * @param {object} [args]
 * @param {Record<string, Record<string, true>>} [args.learnedByDeck]
 * @param {Record<string, unknown>} [args.learnedWords]
 * @param {Record<string, object[]>} [args.decks]
 * @param {(card: object) => unknown} [args.termOf]
 * @param {number} [args.sparseThreshold]
 * @param {number} [args.starterLimit]
 * @param {number} [args.maxTerms]
 * @returns {{ vocab: string[], sparse: boolean, learnedCount: number }}
 */
export function buildChatAllowlist({
  learnedByDeck,
  learnedWords,
  decks,
  termOf,
  sparseThreshold = SPARSE_THRESHOLD,
  starterLimit = STARTER_LIMIT,
  maxTerms = MAX_ALLOWLIST,
} = {}) {
  const cardsById = indexCardsById(decks);
  const learnedTerms = [];
  const seen = new Set();
  for (const id of learnedIdsOf(learnedByDeck, learnedWords)) {
    const term = resolveTerm(id, cardsById, termOf);
    const key = term.toLowerCase();
    if (!term || seen.has(key)) continue;
    seen.add(key);
    learnedTerms.push(term);
  }

  const threshold =
    Number.isFinite(sparseThreshold) && sparseThreshold >= 0 ? sparseThreshold : SPARSE_THRESHOLD;
  const sparse = learnedTerms.length < threshold;
  const mixed = sparse
    ? [...learnedTerms, ...starterTermsFromDecks({ decks, termOf, limit: starterLimit })]
    : learnedTerms;

  return {
    vocab: uniqueSorted(mixed, maxTerms),
    sparse,
    learnedCount: learnedTerms.length,
  };
}

/**
 * Scenarios that actually have a task list at this CEFR band.
 * @param {Array<{ id: string }>} scenarios
 * @param {Record<string, Record<string, unknown[]>>} chatTasks
 * @param {string} level
 * @returns {Array<{ id: string }>}
 */
export function scenariosForLevel(scenarios, chatTasks, level) {
  return (scenarios ?? []).filter((s) => (chatTasks?.[s?.id]?.[level] ?? []).length > 0);
}
