// Language-agnostic answer matching. Callers pass a rule set from textRules —
// the engine's CHOICE / ANSWER, or a pack's own `validation.target`. The
// algorithms here know nothing about any specific language.
import { levenshtein } from './utils';
import { normalizeText, CHOICE, ANSWER } from './textRules';

/**
 * Exact equality after normalization.
 *
 * Defaults to CHOICE because the comparisons that omit rules are the ones
 * between app-supplied tiles, where only capitalisation can vary.
 *
 * @param {string} expected
 * @param {string} given
 * @param {import('./textRules').TextRules} [rules=CHOICE]
 * @returns {boolean}
 */
export function exactMatch(expected, given, rules = CHOICE) {
  return normalizeText(expected, rules) === normalizeText(given, rules);
}

/**
 * Fuzzy match via Levenshtein distance on normalized strings.
 *
 * NOTE: `levenshtein` lowercases internally, so distance is already
 * case-insensitive whatever the rule set says.
 *
 * @param {string} expected
 * @param {string} given
 * @param {import('./textRules').TextRules} [rules=ANSWER]
 * @param {number} [maxDistance=2]
 * @returns {{ ok: boolean, distance: number }}
 */
export function fuzzyMatch(expected, given, rules = ANSWER, maxDistance = 2) {
  const distance = levenshtein(normalizeText(expected, rules), normalizeText(given, rules));
  return { ok: distance <= maxDistance, distance };
}
