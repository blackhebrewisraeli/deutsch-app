/**
 * How the learner composes a Chat turn. Scaffolding runs from most supported
 * (arrange given words) to least (type freely).
 *
 * Only WORD_BANK and FREE_TEXT have UI today; FILL_IN_THE_BLANK is named so
 * the contract is fixed before its component exists.
 */
export const INPUT_MODES = Object.freeze({
  WORD_BANK: 'word_bank',
  FILL_IN_THE_BLANK: 'fill_in_the_blank',
  FREE_TEXT: 'free_text',
});

/**
 * MOCK: which mode a learner starts in. The real decision will come from the
 * AI turn payload; until then beginners (A1/A2) get the word bank and everyone
 * else free text. Band-based, so it stays language-blind.
 */
export function defaultInputMode(level) {
  const band = String(level ?? '').toLowerCase();
  return band === 'a1' || band === 'a2' ? INPUT_MODES.WORD_BANK : INPUT_MODES.FREE_TEXT;
}
