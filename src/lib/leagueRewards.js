// Flat league-winner reward, claimed client-side. Server records rank/result;
// the winner's XP bonus is applied locally so it flows through the existing
// bonusXp → xpForDay → sync path (never written server-side).
export const WINNER_BONUS_XP = 50;

// Pure reducer. results: array of { league_id, rank, result }. Returns a new
// state with bonus XP added to today and leagueWins incremented for each
// previously-unclaimed rank-1 result. Idempotent via gamification.leagueClaimed.
export function claimWinnerRewards(state, results, todayKey) {
  const s = state ?? {};
  const g = s.gamification ?? {};
  const claimed = g.leagueClaimed ?? [];
  const newlyClaimed = [];

  for (const r of results ?? []) {
    if (r?.rank === 1 && r.league_id != null && !claimed.includes(r.league_id)) {
      newlyClaimed.push(r.league_id);
    }
  }
  if (newlyClaimed.length === 0) return { state: s, claimedCount: 0 };

  const daily = { ...(s.daily ?? {}) };
  const prevDay = daily[todayKey] ?? { total: 0, bonusXp: 0, byTab: {}, byLevel: {} };
  daily[todayKey] = {
    ...prevDay,
    bonusXp: (prevDay.bonusXp ?? 0) + newlyClaimed.length * WINNER_BONUS_XP,
  };

  const stats = { ...(s.stats ?? {}) };
  stats.leagueWins = (stats.leagueWins ?? 0) + newlyClaimed.length;

  return {
    state: {
      ...s,
      daily,
      stats,
      gamification: { ...g, leagueClaimed: [...claimed, ...newlyClaimed] },
    },
    claimedCount: newlyClaimed.length,
  };
}
