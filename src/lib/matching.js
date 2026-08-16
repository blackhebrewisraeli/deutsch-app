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

// Glosses are synonym runs, not single words: 36% of the shipped ones contain a
// comma, 6% a semicolon, 3% a middot, 1% a slash. Splitting on those is what
// makes "clock" match the gloss "clock, watch".
const GLOSS_SEPARATORS = /[,;·/]/;

/**
 * Every string that should count as a correct answer for a card.
 *
 * Each whole gloss is kept ALONGSIDE its fragments. That is not redundancy: the
 * whole gloss is what grades correct today, so keeping it is what guarantees
 * this change cannot make a passing answer fail.
 *
 * Deliberately generous. A false rejection tells a learner their correct answer
 * is wrong and costs them the card; a false acceptance costs a slightly early
 * spacing in a self-study app with no score.
 *
 * @param {string[]|string|undefined} glosses
 * @returns {string[]}
 */
export function glossCandidates(glosses) {
  const list = Array.isArray(glosses) ? glosses : glosses ? [glosses] : [];
  const out = [];
  for (const gloss of list) {
    for (const candidate of [gloss, ...gloss.split(GLOSS_SEPARATORS)]) {
      const trimmed = candidate.trim();
      if (trimmed && !out.includes(trimmed)) out.push(trimmed);
    }
  }
  return out;
}

/**
 * The closest candidate to what the learner typed.
 *
 * Returns the minimum distance across the candidate set, so a caller's existing
 * 0 → correct, ≤2 → almost bands keep working unchanged; only the set of things
 * that can score 0 has widened.
 *
 * @param {string[]|string|undefined} glosses
 * @param {string} given
 * @param {import('./textRules').TextRules} [rules=ANSWER]
 * @returns {{ distance: number, matched: string|null }}
 */
export function bestGlossMatch(glosses, given, rules = ANSWER) {
  let best = { distance: Infinity, matched: null };
  for (const candidate of glossCandidates(glosses)) {
    const { distance } = fuzzyMatch(candidate, given, rules);
    if (distance < best.distance) best = { distance, matched: candidate };
  }
  return best;
}
