// Language-agnostic answer matching. The pack supplies `normalize`;
// the matching algorithms here know nothing about any specific language.
import { levenshtein } from './utils';

/**
 * Exact equality after normalization.
 * @param {string} expected
 * @param {string} given
 * @param {(s: string) => string} normalize
 * @returns {boolean}
 */
export function exactMatch(expected, given, normalize) {
  return normalize(expected) === normalize(given);
}

/**
 * Fuzzy match via Levenshtein distance on normalized strings.
 * @param {string} expected
 * @param {string} given
 * @param {(s: string) => string} normalize
 * @param {number} [maxDistance=2]
 * @returns {{ ok: boolean, distance: number }}
 */
export function fuzzyMatch(expected, given, normalize, maxDistance = 2) {
  const distance = levenshtein(normalize(expected), normalize(given));
  return { ok: distance <= maxDistance, distance };
}
