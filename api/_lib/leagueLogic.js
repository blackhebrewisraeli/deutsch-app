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

export function settleLeague(members) {
  const sorted = [...members].sort((a, b) => {
    if (b.weekly_xp !== a.weekly_xp) return b.weekly_xp - a.weekly_xp;
    return String(a.updated_at).localeCompare(String(b.updated_at));
  });
  const n = sorted.length;
  return sorted.map((m, i) => {
    let result = 'held';
    if (i < PROMOTE_COUNT) result = 'promoted';
    else if (i >= n - DEMOTE_COUNT) result = 'demoted';
    return { user_id: m.user_id, rank: i + 1, result };
  });
}
