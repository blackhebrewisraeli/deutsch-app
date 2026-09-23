// Offline CEFR placement: pick a short slice of the active pack's translate
// banks, score them deterministically, and write the resulting level through
// the existing levelPref / settings-stamp path.
//
// Language-blind: this module never names German. It reads the pack's
// translateSentences banks (keyed A1/A2/B1 or a1/a2/b1) and the pack data
// contract fields (`en`, `de`, `words`, `blanks`) the rest of the engine
// already consumes. German-specific content lives in the pack.

import { loadState, saveState } from './storage.js';
import { setUserLevel, adoptLevel, hasStoredLevel } from './levelPref.js';
import { stampLevel } from './settingsStamp.js';
import { exactMatch } from './matching.js';

export const ITEMS_PER_BAND = 3;
export const PASS_THRESHOLD = 2;
export const PLACEMENT_BANDS = Object.freeze(['a1', 'a2', 'b1']);

/** Where a learner who skips placement (or never finishes it) starts. */
export const DEFAULT_PLACEMENT_LEVEL = 'a1';

/**
 * The `levelUpdatedAt` a default classification carries. Deliberately the
 * weakest real clock value there is: it beats "no level at all" (the merge
 * reads a missing stamp as -Infinity), so a brand-new account's default does
 * upload and follow the learner to their next device — but it loses to ANY
 * level a human actually chose, on any device, at any time. A default is the
 * engine filling a gap, not a choice, and must never win an argument with one.
 */
export const DEFAULT_PLACEMENT_STAMP = 1;

function bankFor(pack, level) {
  const banks = pack?.content?.translateSentences ?? {};
  return banks[level] ?? banks[level.toUpperCase()] ?? [];
}

function toTilesItem(sentence, index) {
  return {
    id: `a1:${index}`,
    band: 'a1',
    kind: 'tiles',
    prompt: sentence.en,
    words: sentence.words,
    distractors: sentence.distractors ?? [],
    note: sentence.note,
  };
}

function toBlanksItem(sentence, index) {
  return {
    id: `a2:${index}`,
    band: 'a2',
    kind: 'blanks',
    prompt: sentence.en,
    template: sentence.template,
    blanks: sentence.blanks,
    note: sentence.note,
  };
}

function toChoiceItem(sentence, index, bank) {
  const distractors = bank
    .filter((_, i) => i !== index)
    .slice(0, 3)
    .map((s) => s.de);
  return {
    id: `b1:${index}`,
    band: 'b1',
    kind: 'choice',
    prompt: sentence.en,
    answer: sentence.de,
    options: [sentence.de, ...distractors],
    note: sentence.note,
  };
}

/**
 * Build the fixed 9-item placement set from a language pack.
 * Order is A1 tiles → A2 blanks → B1 multiple-choice, three of each, taken
 * from the front of each bank so the set is stable across reloads and tests.
 *
 * @param {object} pack
 * @returns {object[]}
 */
export function buildPlacementItems(pack) {
  const a1 = bankFor(pack, 'a1').slice(0, ITEMS_PER_BAND).map(toTilesItem);
  const a2 = bankFor(pack, 'a2').slice(0, ITEMS_PER_BAND).map(toBlanksItem);
  const b1Bank = bankFor(pack, 'b1');
  const b1 = b1Bank.slice(0, ITEMS_PER_BAND).map((s, i) => toChoiceItem(s, i, b1Bank));
  return [...a1, ...a2, ...b1];
}

/**
 * Grade one item. `given` is:
 *   tiles  — the assembled sentence string
 *   blanks — an array of filled words, one per blank
 *   choice — the selected option string
 *
 * @param {object} item
 * @param {string | string[] | null | undefined} given
 * @returns {boolean}
 */
export function gradeItem(item, given) {
  if (!item) return false;
  if (item.kind === 'tiles') {
    if (typeof given !== 'string') return false;
    return exactMatch(item.words.join(' '), given);
  }
  if (item.kind === 'blanks') {
    if (!Array.isArray(given) || given.length !== item.blanks.length) return false;
    return item.blanks.every((b, i) => exactMatch(b.word, given[i]));
  }
  if (item.kind === 'choice') {
    if (typeof given !== 'string') return false;
    return exactMatch(item.answer, given);
  }
  return false;
}

/**
 * Band-gated classifier. A band "passes" at PASS_THRESHOLD correct out of
 * ITEMS_PER_BAND. B1 requires A1+A2+B1; A2 requires A1+A2; otherwise A1.
 *
 * Someone who cannot assemble A1 tiles is not placed at A2 just because they
 * guessed a blank; someone who cannot fill A2 blanks is not placed at B1.
 *
 * @param {{ a1?: number, a2?: number, b1?: number }} bands
 * @returns {'a1' | 'a2' | 'b1'}
 */
export function classifyBands(bands = {}) {
  const pass = (n) => (n ?? 0) >= PASS_THRESHOLD;
  if (pass(bands.a1) && pass(bands.a2) && pass(bands.b1)) return 'b1';
  if (pass(bands.a1) && pass(bands.a2)) return 'a2';
  return 'a1';
}

/**
 * Tally a list of per-item booleans against the items they belong to.
 *
 * @param {object[]} items
 * @param {boolean[]} verdicts
 * @returns {{ correct: number, total: number, bands: { a1: number, a2: number, b1: number }, level: 'a1' | 'a2' | 'b1' }}
 */
export function scorePlacement(items, verdicts) {
  const bands = { a1: 0, a2: 0, b1: 0 };
  let correct = 0;
  items.forEach((item, i) => {
    if (!verdicts[i]) return;
    correct += 1;
    if (Object.hasOwn(bands, item.band)) bands[item.band] += 1;
  });
  return {
    correct,
    total: items.length,
    bands,
    level: classifyBands(bands),
  };
}

/**
 * Persist a placement result. The CEFR code goes through setUserLevel so
 * `deutsch-level`, `levelUpdatedAt`, and LEVEL_CHANGE_EVENT all fire the way
 * every other writer already does. Metadata is additive on the state blob
 * (not a new localStorage key) and rides the same LWW clock as the level.
 *
 * @param {{ correct: number, total: number, bands: { a1: number, a2: number, b1: number }, level: 'a1' | 'a2' | 'b1' }} score
 * @param {{ now?: number }} [opts]
 * @returns {'a1' | 'a2' | 'b1' | null} the written level, or null if rejected
 */
export function applyPlacement(score, { now = Date.now() } = {}) {
  const level = score?.level;
  if (!setUserLevel(level)) return null;
  const s = loadState() ?? {};
  saveState({
    ...s,
    placement: {
      takenAt: now,
      source: 'placement',
      level,
      correct: score.correct,
      total: score.total,
      bands: score.bands,
    },
  });
  return level;
}

/**
 * Classify a learner who has no level at the lowest band, without asking.
 *
 * This is what makes placement OPTIONAL. The test used to be the only writer
 * a first-time learner had, so every exit that was not "finish all nine
 * questions" — Skip, a closed tab, a reload — left them unclassified, and the
 * gate took the whole screen again on the next load. Writing the default the
 * moment the test is first offered means every one of those exits already has
 * a level behind it, and the gate (which only fires on "no level") can never
 * fire for this learner again.
 *
 * Never overwrites: a stored level of any kind wins, so calling this for a
 * learner who has one is a no-op. Stamped with DEFAULT_PLACEMENT_STAMP rather
 * than now, via adoptLevel (announce, don't stamp) + an explicit stamp — see
 * the constant for why.
 *
 * @param {{ now?: number }} [opts]
 * @returns {'a1' | null} the written level, or null when one already existed
 */
export function applyDefaultPlacement({ now = Date.now() } = {}) {
  if (hasStoredLevel()) return null;
  const level = DEFAULT_PLACEMENT_LEVEL;
  // Stamp BEFORE announcing: adoptLevel fires LEVEL_CHANGE_EVENT synchronously,
  // and a listener that reads the blob in response should see the whole write.
  stampLevel(DEFAULT_PLACEMENT_STAMP);
  const s = loadState() ?? {};
  saveState({ ...s, placement: { takenAt: now, source: 'default', level } });
  adoptLevel(level);
  return level;
}

/** @returns {object | null} */
export function readPlacement() {
  return loadState()?.placement ?? null;
}
