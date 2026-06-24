// Records when a synced setting last changed, so the settings adapter can do
// LWW. Additive field on the existing blob (no key rename).
import { loadState, saveState } from './storage.js';

export function stampSettings(now = Date.now()) {
  const s = loadState() ?? {};
  saveState({ ...s, settingsUpdatedAt: now });
}
