// The tier ladder, and the one function that names a rung of it.
//
// PURE — no imports, no I/O — and in its own module for the same reason
// leagueZones.js is: leagues.js is the NETWORK module, so every component test
// stubs it wholesale, and anything living there has to be restated in each of
// those stubs. A restated constant is a second definition free to drift from
// the one the app renders, and a stub that forgets a newly-added export takes
// the component down at render time rather than failing an assertion.
//
// Mirrors api/_lib/leagueLogic.js's TIERS: MIN is 0 and MAX is the last index.
export const TIER_NAMES = ['Bronze', 'Silver', 'Gold', 'Sapphire', 'Ruby'];

/**
 * The name of a tier, defaulting to Bronze.
 *
 * Bronze is the FLOOR, not a fallback for missing data: it is TIERS.MIN on the
 * server, join.js starts every new player there, and nobody can be in a league
 * below it. So "no tier yet" and "tier 0" are the same standing, and both read
 * "Bronze".
 *
 * Indexing TIER_NAMES directly does not say that. `TIER_NAMES[undefined]` and
 * `TIER_NAMES[7]` are both `undefined`, which React renders as NOTHING — a
 * league card with a blank where its tier goes. Three call sites indexed the
 * array raw and only one of them defaulted, which is why this is a function
 * rather than a convention.
 *
 * @param {unknown} tier
 * @returns {string} one of TIER_NAMES, never undefined
 */
export function tierName(tier) {
  const i = Number(tier);
  if (!Number.isInteger(i) || i < 0 || i >= TIER_NAMES.length) return TIER_NAMES[0];
  return TIER_NAMES[i];
}
