import { stampSettings } from './settingsStamp';

/**
 * NOT part of synced `deutsch-app-state-v1` — the level lives outside that
 * blob. It still syncs between a signed-in user's devices: sync.js's settings
 * payload reads and writes `deutsch-level` alongside (not inside) the state
 * blob, so a signed-in account carries its level across devices even though
 * a genuinely fresh device with no session has nothing to seed from.
 */
export const LEVEL_KEY = 'deutsch-level';

export const LEVELS = Object.freeze(['a1', 'a2', 'b1']);

/**
 * Fired on `window` after the level changes, so components holding the level in
 * state can resync without polling or prop-drilling. `detail.level` carries the
 * new value.
 *
 * Dispatched from `writeLevel` rather than only from `setUserLevel`, so the
 * existing callers (the picker, the entry splash, sync) all emit it too — a
 * notifier only half the writers fire is worse than none, because a listener
 * would look correct and miss updates.
 */
export const LEVEL_CHANGE_EVENT = 'deutsch-level-change';

// Values written by builds that predate the CEFR codes.
const LEGACY = { beginner: 'a1', intermediate: 'b1' };

/** Human-readable name per level — the picker shows CEFR codes, this glosses them. */
export const LEVEL_NAMES = { a1: 'Beginner', a2: 'Elementary', b1: 'Intermediate' };

/**
 * Map a raw stored value to a level, or null when it is not one.
 * Legacy values resolve; anything else does not. Single source of truth for
 * "is this a level?" so readLevel and hasStoredLevel cannot disagree.
 * @param {string | null} stored
 * @returns {'a1' | 'a2' | 'b1' | null}
 */
function resolveStored(stored) {
  if (LEVELS.includes(stored)) return stored;
  if (Object.hasOwn(LEGACY, stored)) return LEGACY[stored];
  return null;
}

/**
 * @returns {'a1' | 'a2' | 'b1'} the stored level, a1 when unset or corrupt
 */
export function readLevel() {
  try {
    return resolveStored(localStorage.getItem(LEVEL_KEY)) ?? 'a1';
  } catch {
    // private mode / blocked storage
  }
  return 'a1';
}

/**
 * Has this device stored a valid (or legacy-resolvable) level? Guarded like
 * the rest of this module — blocked storage and junk values both read as "no
 * level chosen", which shows the picker rather than silently landing on A1.
 * @returns {boolean}
 */
export function hasStoredLevel() {
  try {
    return resolveStored(localStorage.getItem(LEVEL_KEY)) !== null;
  } catch {
    return false;
  }
}

/**
 * Persist a level and stamp settings for last-write-wins sync.
 * Unknown values are ignored rather than persisted.
 * @param {string} level
 * @returns {boolean} whether the value was a level and was therefore applied
 */
export function writeLevel(level) {
  if (!LEVELS.includes(level)) return false;
  try {
    localStorage.setItem(LEVEL_KEY, level);
  } catch {
    // best-effort; the caller's in-memory state still updates
  }
  stampSettings();
  notifyLevelChange(level);
  return true;
}

/**
 * Announce the change. Fired even when the storage write was refused (private
 * mode), because the session's in-memory state did move and the UI should
 * follow it — the alternative is a picker that visibly does nothing.
 *
 * The try/catch covers constructing/dispatching the event, not listeners: the
 * DOM already isolates a throwing listener from the dispatcher, routing it to
 * the global error handler instead. So there is nothing to catch there, and a
 * test asserting it would only be asserting jsdom.
 * @param {'a1' | 'a2' | 'b1'} level
 */
function notifyLevelChange(level) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  try {
    window.dispatchEvent(new CustomEvent(LEVEL_CHANGE_EVENT, { detail: { level } }));
  } catch {
    // no CustomEvent (very old/odd environments) — nothing to announce to
  }
}

/**
 * The current level. Alias of `readLevel`, named for callers that think in
 * terms of "the user's level" rather than "the stored preference".
 * @returns {'a1' | 'a2' | 'b1'} a1 when unset or corrupt
 */
export function getUserLevel() {
  return readLevel();
}

/**
 * Validate, persist and announce a level.
 *
 * Levels are LOWERCASE CEFR codes — 'a1' | 'a2' | 'b1'. Uppercase is rejected
 * rather than coerced: `deutsch-level` has held lowercase since the CEFR codes
 * landed, and quietly accepting 'A1' would let a caller write a value that
 * `resolveStored` then reads back as corrupt, resetting the user to a1.
 * @param {string} level
 * @returns {boolean} whether the value was accepted
 */
export function setUserLevel(level) {
  return writeLevel(level);
}
