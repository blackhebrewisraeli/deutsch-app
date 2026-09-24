/**
 * How the learner composes a Chat turn, and the ladder between the modes.
 * Scaffolding runs from most supported (arrange given words) to least (type
 * freely). Everything here is pure and language-blind: tokens are split on
 * whitespace and punctuation is Unicode `\p{P}`.
 */
export const INPUT_MODES = Object.freeze({
  WORD_BANK: 'word_bank',
  CHOICE_BLANK: 'choice_blank',
  TYPED_BLANK: 'typed_blank',
  FREE_TEXT: 'free_text',
});

/** The scaffold ladder, most support first. */
export const STAGES = Object.freeze([
  INPUT_MODES.WORD_BANK,
  INPUT_MODES.CHOICE_BLANK,
  INPUT_MODES.TYPED_BLANK,
  INPUT_MODES.FREE_TEXT,
]);

/** Consecutive clean (or corrected) graded turns that move one stage. */
export const STEP_AFTER = 2;

const START_BY_BAND = Object.freeze({
  a1: INPUT_MODES.WORD_BANK,
  a2: INPUT_MODES.CHOICE_BLANK,
  b1: INPUT_MODES.TYPED_BLANK,
});

/** MOCK: kept until ChatTab moves to startingStage (removed in the same PR). */
export function defaultInputMode(level) {
  const band = String(level ?? '').toLowerCase();
  return band === 'a1' || band === 'a2' ? INPUT_MODES.WORD_BANK : INPUT_MODES.FREE_TEXT;
}

/** Where a learner at this CEFR band starts a conversation. */
export function startingStage(level) {
  return START_BY_BAND[String(level ?? '').toLowerCase()] ?? INPUT_MODES.WORD_BANK;
}

/**
 * One graded turn's effect on progression. `streak` counts consecutive clean
 * turns (positive) or corrected ones (negative); a flip in direction restarts
 * it, and so does any stage change — including one clamped at either end.
 *
 * @param {{ stage: string, streak: number }} progression
 * @param {boolean} corrected
 * @returns {{ stage: string, streak: number, moved: 'up' | 'down' | null }}
 */
export function advance({ stage, streak }, corrected) {
  const count = corrected ? Math.min(streak, 0) - 1 : Math.max(streak, 0) + 1;
  if (Math.abs(count) < STEP_AFTER) return { stage, streak: count, moved: null };
  const idx = STAGES.indexOf(stage);
  const target = idx === -1 ? undefined : STAGES[idx + (corrected ? -1 : 1)];
  if (!target) return { stage, streak: 0, moved: null };
  return { stage: target, streak: 0, moved: corrected ? 'down' : 'up' };
}

const EDGE_PUNCT = /^\p{P}+|\p{P}+$/gu;
const core = (token) => token.replace(EDGE_PUNCT, '');
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;

/**
 * Validates the AI's `next` suggestion into what the scaffolded composers
 * render. Anything unusable returns null, and that turn falls back to free
 * text rather than rendering a broken exercise.
 *
 * @param {unknown} next
 * @returns {{ en: string, tokens: string[], blankIndex: number, answer: string, distractors: string[] } | null}
 */
export function parseScaffold(next) {
  if (!next || typeof next !== 'object') return null;
  const { de, en, blank, distractors } = next;
  if (!nonEmpty(de) || !nonEmpty(blank) || !Array.isArray(distractors)) return null;
  if (distractors.length === 0 || !distractors.every(nonEmpty)) return null;
  const key = blank.trim().toLowerCase();
  if (distractors.some((d) => d.trim().toLowerCase() === key)) return null;

  const tokens = de.trim().split(/\s+/);
  const blankIndex = tokens.findIndex((t) => core(t).toLowerCase() === key);
  if (blankIndex === -1) return null;

  return {
    en: nonEmpty(en) ? en.trim() : '',
    tokens,
    blankIndex,
    answer: core(tokens[blankIndex]),
    distractors: [...new Set(distractors.map((d) => d.trim()))],
  };
}

/**
 * The sentence either side of the gap. Punctuation glued to the blank token
 * stays outside the gap, so "Kaffee," becomes gap + ",".
 *
 * @param {{ tokens: string[], blankIndex: number }} scaffold
 * @returns {{ before: string, after: string }}
 */
export function gapParts({ tokens, blankIndex }) {
  const token = tokens[blankIndex];
  const word = core(token);
  const at = token.indexOf(word);
  const head = tokens.slice(0, blankIndex).join(' ');
  const tail = tokens.slice(blankIndex + 1).join(' ');
  return {
    before: (head ? `${head} ` : '') + token.slice(0, at),
    after: token.slice(at + word.length) + (tail ? ` ${tail}` : ''),
  };
}
