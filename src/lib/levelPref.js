import { stampSettings } from './settingsStamp';

/** Per-device practice level. NOT part of synced `deutsch-app-state-v1`. */
export const LEVEL_KEY = 'deutsch-level';

export const LEVELS = ['a1', 'a2', 'b1'];

// Values written by builds that predate the CEFR codes.
const LEGACY = { beginner: 'a1', intermediate: 'b1' };

/**
 * @returns {'a1' | 'a2' | 'b1'} the stored level, a1 when unset or corrupt
 */
export function readLevel() {
  try {
    const stored = localStorage.getItem(LEVEL_KEY);
    if (LEVELS.includes(stored)) return stored;
    if (stored in LEGACY) return LEGACY[stored];
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
