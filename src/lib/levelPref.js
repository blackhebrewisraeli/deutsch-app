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
 * @returns {'a1' | 'a2' | 'b1'} the stored level, a1 when unset or corrupt
 */
export function readLevel() {
  try {
    const stored = localStorage.getItem(LEVEL_KEY);
    if (LEVELS.includes(stored)) return stored;
    if (Object.hasOwn(LEGACY, stored)) return LEGACY[stored];
  } catch {
    // private mode / blocked storage
  }
  return 'a1';
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
