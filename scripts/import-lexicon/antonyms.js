// Antonym quality control.
//
// Wiktionary's antonyms are listed per SENSE, and the import flattens an entry's
// senses into one card. That is fine for glosses but noisy for opposites: a
// preposition inherits the opposites of its adjectival sense, and a bookkeeping
// term inherits nothing a learner would recognise. Runs after mergeHomographs,
// when the shipped set — and therefore what counts as a headword — is known.

// Only content words are drilled. Function words are where sense-bleed
// concentrates: "zu" the preposition carries "auf / offen / geöffnet" from "zu"
// the adjective, and "ob" carries the dialect forms of an obsolete preposition.
const CONTENT_POS = new Set(['adj', 'noun', 'verb', 'adv']);

// Residual noise the structural rules cannot see. Kept small and explicit, the
// way filter.js keeps its profanity list — an allow-list would need curating the
// whole lexicon, while these are the handful of entries whose antonym sets are
// wrong rather than merely thin.
//
// - nominalised function words: Er/Sie, Neues/Gutes/Altes
// - bookkeeping senses: Haben/Soll (debit and credit)
// - vague or one-sided pairs: schon/fast/rund/recht/früher/knapp
// Deny the HEADWORD only when its whole antonym set is wrong. Where just one
// token is junk — "weniger ↔ mehr, plus, und" — deny the token instead, so the
// good half of the pair survives.
const DENY_HEADWORD = new Set([
  'er', 'sie', 'haben', 'soll', 'neues', 'gutes', 'altes',
  'schon', 'fast', 'rund', 'recht', 'früher', 'knapp', 'gut',
]);

// Tokens that are not an opposite of anything, or belong to a different sense
// of the headword than the card shows.
const DENY_ANTONYM = new Set([
  'und', 'plus', 'heute', 'ganz', 'nicht', 'knapp', 'gut',
  'link', 'weit', 'einfach', 'gegeneinander',
]);

/**
 * @param {object[]} entries the merged, filtered lexicon
 * @returns {object[]} the same entries with `antonyms` pruned
 */
export function pruneAntonyms(entries) {
  const headwords = new Set(entries.map((e) => e.de.toLowerCase()));
  return entries.map((entry) => {
    const lemma = entry.de.toLowerCase();
    if (!CONTENT_POS.has(entry.pos) || DENY_HEADWORD.has(lemma)) {
      return { ...entry, antonyms: [] };
    }
    const antonyms = (entry.antonyms ?? []).filter((a) => {
      const key = a.toLowerCase();
      // An opposite the learner can never look up in this app is not worth
      // asking for — it is usually a dialect form or a rare derivation.
      return headwords.has(key) && !DENY_ANTONYM.has(key) && key !== lemma;
    });
    return { ...entry, antonyms };
  });
}
