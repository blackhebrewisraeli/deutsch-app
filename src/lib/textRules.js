// Language-agnostic text normalization. The ALGORITHM lives here; WHICH rules
// apply is data. The engine owns the answer-language sets below; each pack
// owns its own language via `validation.target`.

/**
 * @typedef {object} TextRules
 * @property {boolean} trim
 * @property {boolean} caseFold
 * @property {boolean} stripCombiningMarks
 * @property {[string, string][]} replacements
 */

/**
 * Apply a rule set to a string.
 *
 * Operation order is contractual: trim → caseFold → stripCombiningMarks →
 * replacements. Case-folding precedes replacement so a pack declares only
 * lowercase pairs (`['ä', 'ae']`) and `ÄRGER` still folds to `aerger`.
 *
 * `caseFold` is `toLowerCase()`, NOT Unicode full case folding. Full folding
 * already maps ß→ss internally, which would silently pre-empt the German
 * pack's own declaration and make `replacements` look inert for the one pair
 * it most obviously governs.
 *
 * @param {string} s
 * @param {TextRules} rules
 * @returns {string}
 */
export function normalizeText(s, rules) {
  // Called on user input inside a render path: never throw, never blank the
  // screen. Rules themselves are contract-validated, so they are trusted.
  let out = typeof s === 'string' ? s : '';
  if (rules.trim) out = out.trim();
  if (rules.caseFold) out = out.toLowerCase();
  if (rules.stripCombiningMarks) {
    out = out.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');
  }
  for (const [from, to] of rules.replacements) out = out.split(from).join(to);
  return out;
}

/**
 * App-supplied strings compared to each other (tile exercises). There is no
 * human input to forgive, so nothing is folded — which is also what makes a
 * word/distractor collision such as `Fuß`/`Fuss` impossible by construction.
 */
export const STRICT = {
  trim: true,
  caseFold: false,
  stripCombiningMarks: false,
  replacements: [],
};

/**
 * Typed English answers. English is the UI language and is shared by every
 * pack, so one definition serves all of them. Reproduces the old German-pack
 * `(s) => s.trim().toLowerCase()` exactly.
 *
 * Phase 4 note: this assumes the answer language is English. If the UI ever
 * offers learning German *from* another language, ANSWER becomes a property
 * of the UI locale rather than a constant.
 */
export const ANSWER = {
  trim: true,
  caseFold: true,
  stripCombiningMarks: false,
  replacements: [],
};
