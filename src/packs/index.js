// Pack registry. Phase 0: German only. The active pack is a module singleton;
// a Context/hook can wrap it in Phase 4 when the language picker arrives.
import { dePack } from './de';

const PACKS = { de: dePack };

/** @param {string} id @returns {object|undefined} */
export function getPack(id) {
  return PACKS[id];
}

/** The active language pack. */
export const activePack = dePack;
