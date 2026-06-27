export const TIERS = { MIN: 0, MAX: 4 };
export const LEAGUE_SIZE = 25;
const PROMOTE_COUNT = 7;
const DEMOTE_COUNT = 5;

export function currentPeriodStart(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = d.getUTCDay(); // 0=Sun..6=Sat
  const delta = dow === 0 ? -6 : 1 - dow; // back to Monday
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function nextTier(tier, result) {
  const step = result === 'promoted' ? 1 : result === 'demoted' ? -1 : 0;
  return Math.max(TIERS.MIN, Math.min(TIERS.MAX, tier + step));
}

// Promotion/demotion zone sizes for a cohort of n members. Full-size leagues
// (n >= PROMOTE_COUNT + DEMOTE_COUNT) keep the flat 7/5 split. Smaller cohorts
// scale both zones proportionally so they never overlap — without this, a tiny
// early-userbase league (n < 12) would put a member in both the promote and
// demote zones at once.
export function zoneCounts(n) {
  if (n >= PROMOTE_COUNT + DEMOTE_COUNT) return { promote: PROMOTE_COUNT, demote: DEMOTE_COUNT };
  if (n <= 0) return { promote: 0, demote: 0 };
  const promote = Math.max(1, Math.round((n * PROMOTE_COUNT) / LEAGUE_SIZE));
  const demote = Math.min(Math.round((n * DEMOTE_COUNT) / LEAGUE_SIZE), Math.max(0, n - promote));
  return { promote, demote };
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
