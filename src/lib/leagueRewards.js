// Flat league-winner reward, claimed client-side. Server records rank/result;
// the winner's XP bonus is applied locally so it flows through the existing
// bonusXp → xpForDay → sync path (never written server-side).
export const WINNER_BONUS_XP = 50;

// Pure reducer. results: array of { league_id, rank, result }. Returns a new
// state with bonus XP added to today for each previously-unclaimed rank-1
// result. Idempotent via gamification.leagueClaimed, which is serialised by
// settingsToRow and union-merged by mergeSettings — without BOTH of those the
// claim set does not survive a reconcile and every past win is re-awarded on
// the next load.
//
// stats.leagueWins is DERIVED from the claim set, not incremented. `stats` is
// deliberately absent from settingsToRow's allowlist (the public profile reads
// wins from rank-1 memberships instead — see api/v1/league/profile.js), so a
// counter that only ever went up had no way to converge: two devices each
// claiming a different league would sum to the wrong total, and this bug
// inflated it without bound. The length of the union-merged id set is the
// number of distinct leagues won, on every device, by construction.
//
// `changed` is true whenever the returned state differs from the input —
// including the claimedCount:0 case where only the derived counter was
// corrected. Callers persist on `changed` and celebrate on `claimedCount`.
export function claimWinnerRewards(state, results, todayKey) {
  const s = state ?? {};
  const g = s.gamification ?? {};
  const claimed = g.leagueClaimed ?? [];
  const newlyClaimed = [];

  for (const r of results ?? []) {
    // Checked against newlyClaimed too: a results array that repeats one
    // league_id must not be paid twice within a single call.
    if (
      r?.rank === 1 &&
      r.league_id != null &&
      !claimed.includes(r.league_id) &&
      !newlyClaimed.includes(r.league_id)
    ) {
      newlyClaimed.push(r.league_id);
    }
  }

  if (newlyClaimed.length === 0) {
    // Nothing to pay out, but the derived counter may still be stale — a device
    // that just pulled someone else's claims, or one carrying a count inflated
    // by the re-award bug. Reconcile it without touching XP.
    if ((s.stats?.leagueWins ?? 0) === claimed.length)
      return { state: s, claimedCount: 0, changed: false };
    return {
      state: { ...s, stats: { ...(s.stats ?? {}), leagueWins: claimed.length } },
      claimedCount: 0,
      changed: true,
    };
  }

  const daily = { ...(s.daily ?? {}) };
  const prevDay = daily[todayKey] ?? { total: 0, bonusXp: 0, byTab: {}, byLevel: {} };
  daily[todayKey] = {
    ...prevDay,
    bonusXp: (prevDay.bonusXp ?? 0) + newlyClaimed.length * WINNER_BONUS_XP,
  };

  const nextClaimed = [...claimed, ...newlyClaimed];
  const stats = { ...(s.stats ?? {}), leagueWins: nextClaimed.length };

  return {
    state: {
      ...s,
      daily,
      stats,
      gamification: { ...g, leagueClaimed: nextClaimed },
    },
    claimedCount: newlyClaimed.length,
    changed: true,
  };
}
