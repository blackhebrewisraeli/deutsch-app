import { LEVELS, getUserLevel } from './levelPref.js';

/**
 * Practice gating off the classified CEFR code.
 *
 * Translate's *default* mode is still 1:1 with LEVEL_MODES (A1 tiles, A2
 * blanks, B1 typing). The allowed *set* is cumulative so a higher
 * classification may still run a lower band (A1 vocab decks at A2) and so a
 * caller that asks for B1 on an A1 learner is clamped down, never up.
 *
 * Language-blind: CEFR codes and pack-authored `auto.level` only.
 */

function asLevel(value) {
  return LEVELS.includes(value) ? value : null;
}

/**
 * Rank in LEVELS, or 0 (a1) when the value is not a level.
 * @param {string | null | undefined} level
 * @returns {number}
 */
export function levelRank(level) {
  const i = LEVELS.indexOf(level);
  return i >= 0 ? i : 0;
}

/**
 * Modes a classified learner may run, lowest first.
 * Unknown / missing classification → A1 only.
 * @param {string | null | undefined} [classified]
 * @returns {Array<'a1' | 'a2' | 'b1'>}
 */
export function allowedModes(classified = getUserLevel()) {
  const level = asLevel(classified) ?? 'a1';
  return LEVELS.slice(0, levelRank(level) + 1);
}

/**
 * @param {string | null | undefined} mode
 * @param {string | null | undefined} [classified]
 * @returns {boolean}
 */
export function isModeAllowed(mode, classified = getUserLevel()) {
  return allowedModes(classified).includes(mode);
}

/**
 * The mode to actually run. Never above classified.
 * An allowed requested mode is kept (so B1 may still practice A1 tiles);
 * anything else — including junk — falls back to the classified code, or a1.
 * @param {string | null | undefined} requested
 * @param {string | null | undefined} [classified]
 * @returns {'a1' | 'a2' | 'b1'}
 */
export function clampMode(requested, classified = getUserLevel()) {
  const cls = asLevel(classified) ?? 'a1';
  if (isModeAllowed(requested, cls)) return requested;
  return cls;
}

/**
 * The classified CEFR code itself. Chat pedagogy uses this rather than
 * clampMode: a B1 learner should get B1 tutor talk, not a leftover a1 prop.
 * Junk / missing → a1. Never above what is stored.
 * @param {string | null | undefined} [classified]
 * @returns {'a1' | 'a2' | 'b1'}
 */
export function classifiedLevel(classified = getUserLevel()) {
  return asLevel(classified) ?? 'a1';
}

/**
 * CEFR code a pack deck declares, or null when the deck is unleveled
 * (greetings, topics, frequency, custom).
 * @param {{ auto?: { level?: string } } | null | undefined} def
 * @returns {'a1' | 'a2' | 'b1' | null}
 */
export function cefrOfDeckDef(def) {
  const raw = def?.auto?.level;
  if (typeof raw !== 'string') return null;
  return asLevel(raw.toLowerCase());
}

/**
 * Unleveled decks are allowed at every classification. A CEFR-tagged deck
 * (`auto.level`) must sit at or below classified.
 * @param {{ auto?: { level?: string } } | null | undefined} def
 * @param {string | null | undefined} [classified]
 * @returns {boolean}
 */
export function isDeckAllowedForLevel(def, classified = getUserLevel()) {
  const cefr = cefrOfDeckDef(def);
  if (!cefr) return true;
  return isModeAllowed(cefr, classified);
}

/**
 * @param {string | null | undefined} deckId
 * @param {string | null | undefined} classified
 * @param {Array<{ id: string, auto?: { level?: string } }>} [catalog]
 * @returns {boolean}
 */
export function isDeckIdAllowed(deckId, classified, catalog = []) {
  if (!deckId) return true;
  const def = catalog.find((d) => d.id === deckId);
  return isDeckAllowedForLevel(def, classified);
}

/**
 * @template {{ auto?: { level?: string } }} T
 * @param {T[]} catalog
 * @param {string | null | undefined} [classified]
 * @returns {T[]}
 */
export function filterCatalogByLevel(catalog, classified = getUserLevel()) {
  return (catalog ?? []).filter((d) => isDeckAllowedForLevel(d, classified));
}
