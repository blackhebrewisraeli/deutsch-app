// Records when a synced setting last changed, so the settings adapter can do
// LWW. Additive field on the existing blob (no key rename).
import { loadState, saveState } from './storage.js';

export function stampSettings(now = Date.now()) {
  const s = loadState() ?? {};
  saveState({ ...s, settingsUpdatedAt: now });
}

// level gets its own timestamp so an unrelated, merely-newer settings write on
// another device can't win the whole-row LWW and drag level back with it —
// see mergeSettings in sync/merge.js.
export function stampLevel(now = Date.now()) {
  const s = loadState() ?? {};
  saveState({ ...s, levelUpdatedAt: now });
}
