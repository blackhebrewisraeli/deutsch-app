// Shared league cohort sizing. Imported by BOTH the settle endpoint (server,
// api/_lib/leagueLogic.js) and the leaderboard UI (client, LeaderboardSection)
// so the promotion/relegation dividers a user sees match exactly who settlement
// will promote/demote. Pure — no imports, no I/O.
export const LEAGUE_SIZE = 25;
export const PROMOTE_COUNT = 7;
export const DEMOTE_COUNT = 5;

// Promotion/demotion zone sizes for a cohort of n members. Full-size leagues
// (n >= PROMOTE_COUNT + DEMOTE_COUNT) keep the flat 7/5 split; smaller cohorts
// scale both zones proportionally so they never overlap.
export function zoneCounts(n) {
  if (n >= PROMOTE_COUNT + DEMOTE_COUNT) return { promote: PROMOTE_COUNT, demote: DEMOTE_COUNT };
  if (n <= 0) return { promote: 0, demote: 0 };
  const promote = Math.max(1, Math.round((n * PROMOTE_COUNT) / LEAGUE_SIZE));
  const demote = Math.min(Math.round((n * DEMOTE_COUNT) / LEAGUE_SIZE), Math.max(0, n - promote));
  return { promote, demote };
}
