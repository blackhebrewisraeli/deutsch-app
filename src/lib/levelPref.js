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
 */
export function writeLevel(level) {
  if (!LEVELS.includes(level)) return;
  try {
    localStorage.setItem(LEVEL_KEY, level);
  } catch {
    // best-effort; the caller's in-memory state still updates
  }
  stampSettings();
}
