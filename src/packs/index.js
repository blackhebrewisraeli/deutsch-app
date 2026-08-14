// Pack registry. Phase 0: German only. The active pack is a module singleton;
// a Context/hook can wrap it in Phase 4 when the language picker arrives.
import { dePack } from './de';

const PACKS = { de: dePack };

/** @param {string} id @returns {object|undefined} */
export function getPack(id) {
  return PACKS[id];
}

// Phase 4 replaces this constant with a stored preference; the indirection
// exists now so that change lands in one place. `PACKS` is declared above, so
// getPack() resolves cleanly at module-eval time.
const DEFAULT_PACK_ID = 'de';

/** The active language pack. */
export const activePack = getPack(DEFAULT_PACK_ID);
