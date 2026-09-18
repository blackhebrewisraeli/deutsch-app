// Interest-topic selection. Pure — no storage, no network, no DOM.
//
// The engine talks about catalog ids. Pack-owned labels, cards, and prompt
// hints stay in src/packs/de/interests.js.

/** Group label the Vocab pickers use when any topic is enabled. */
export const INTERESTS_GROUP = 'Interests';

/**
 * Known enabled topic ids, unique, in catalog order.
 * Unknown / non-string values are dropped. Missing catalog → empty.
 *
 * @param {unknown} raw
 * @param {Array<{ id?: string }>} [catalog]
 * @returns {string[]}
 */
export function sanitizeEnabledInterests(raw, catalog = []) {
  const allowed = new Set();
  for (const topic of catalog ?? []) {
    if (typeof topic?.id === 'string' && topic.id) allowed.add(topic.id);
  }
  const enabled = new Set();
  if (Array.isArray(raw)) {
    for (const id of raw) {
      if (typeof id === 'string' && allowed.has(id)) enabled.add(id);
    }
  }
  const out = [];
  for (const topic of catalog ?? []) {
    if (enabled.has(topic.id)) out.push(topic.id);
  }
  return out;
}

/**
 * Flip one catalog id. Unknown ids are ignored.
 *
 * @param {string} id
 * @param {unknown} enabled
 * @param {Array<{ id?: string }>} [catalog]
 * @returns {string[]}
 */
export function toggleInterest(id, enabled, catalog = []) {
  if (typeof id !== 'string' || !id) {
    return sanitizeEnabledInterests(enabled, catalog);
  }
  const current = new Set(sanitizeEnabledInterests(enabled, catalog));
  if (current.has(id)) current.delete(id);
  else current.add(id);
  return sanitizeEnabledInterests([...current], catalog);
}

/**
 * Catalog rows the learner currently has on.
 *
 * @param {Array<{ id?: string }>} [catalog]
 * @param {unknown} enabledIds
 * @returns {Array<object>}
 */
export function enabledTopics(catalog = [], enabledIds) {
  const on = new Set(sanitizeEnabledInterests(enabledIds, catalog));
  return (catalog ?? []).filter((topic) => on.has(topic.id));
}

/**
 * Picker rows for enabled interest decks. `resolvedDecks` supplies counts
 * when the pack has already joined lexicon ids into cards.
 *
 * @param {Array<{ id?: string, label?: string, deckId?: string }>} [catalog]
 * @param {unknown} enabledIds
 * @param {Record<string, unknown[]> | null | undefined} [resolvedDecks]
 * @returns {Array<{ id: string, name: string, count: number }>}
 */
export function interestPickerDecks(catalog = [], enabledIds, resolvedDecks) {
  return enabledTopics(catalog, enabledIds)
    .filter((topic) => typeof topic.deckId === 'string' && topic.deckId)
    .map((topic) => ({
      id: topic.deckId,
      name: typeof topic.label === 'string' && topic.label ? topic.label : topic.deckId,
      count: Array.isArray(resolvedDecks?.[topic.deckId]) ? resolvedDecks[topic.deckId].length : 0,
    }));
}

/**
 * English prompt hints for enabled topics. Empty when nothing is on.
 *
 * @param {Array<{ id?: string, promptHint?: string }>} [catalog]
 * @param {unknown} enabledIds
 * @returns {string[]}
 */
export function interestPromptHints(catalog = [], enabledIds) {
  const out = [];
  for (const topic of enabledTopics(catalog, enabledIds)) {
    if (typeof topic.promptHint === 'string' && topic.promptHint.trim()) {
      out.push(topic.promptHint.trim());
    }
  }
  return out;
}

/**
 * Whether this deck id belongs to an enabled interest topic.
 *
 * @param {string | null | undefined} deckId
 * @param {Array<{ deckId?: string }>} [catalog]
 * @param {unknown} enabledIds
 * @returns {boolean}
 */
export function isEnabledInterestDeck(deckId, catalog = [], enabledIds) {
  if (typeof deckId !== 'string' || !deckId) return false;
  return enabledTopics(catalog, enabledIds).some((topic) => topic.deckId === deckId);
}
