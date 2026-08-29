// Cohort sizing lives in src/lib so the client can share it (explicit .js
// extension is REQUIRED — this module is bundled into Vercel serverless
// functions running native Node ESM; see src/lib/xpCore.js).
import { zoneCounts, LEAGUE_SIZE } from '../../src/lib/leagueZones.js';
// The league week now lives in src/lib too, because the client has to match a
// membership row against the current period (rank is null until settle). Same
// explicit .js extension requirement as above.
import { currentPeriodStart } from '../../src/lib/leagueCountdown.js';

export const TIERS = { MIN: 0, MAX: 4 };
export { LEAGUE_SIZE, zoneCounts, currentPeriodStart };

export function nextTier(tier, result) {
  const step = result === 'promoted' ? 1 : result === 'demoted' ? -1 : 0;
  return Math.max(TIERS.MIN, Math.min(TIERS.MAX, tier + step));
}

export function settleLeague(members) {
  const sorted = [...members].sort((a, b) => {
    if (b.weekly_xp !== a.weekly_xp) return b.weekly_xp - a.weekly_xp;
    return String(a.updated_at).localeCompare(String(b.updated_at));
  });
  const n = sorted.length;
  const { promote, demote } = zoneCounts(n);
  return sorted.map((m, i) => {
    let result = 'held';
    if (i < promote) result = 'promoted';
    else if (i >= n - demote) result = 'demoted';
    return { user_id: m.user_id, rank: i + 1, result };
  });
}
