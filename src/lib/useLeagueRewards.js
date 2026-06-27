import { useEffect } from 'react';
import { loadState, saveState } from './storage.js';
import { todayKey } from './stats.js';
import { getSupabase } from './auth.js';
import { LEAGUES_ENABLED, fetchMyResults } from './leagues.js';
import { claimWinnerRewards } from './leagueRewards.js';

// Claims any unclaimed league-winner rewards into local state when a signed-in
// user loads the app — not only when they open the Leagues tab. Idempotent
// (claimWinnerRewards dedups via gamification.leagueClaimed), so running once
// per sign-in is enough; failures are swallowed so a reward claim never blocks
// the app. The credited bonus XP flows through the normal bonusXp → xpForDay →
// sync path; the gamification recompute picks up the badge on its next run.
export function useLeagueRewards(userId) {
  useEffect(() => {
    if (!LEAGUES_ENABLED || !userId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const results = await fetchMyResults(getSupabase(), userId);
        if (cancelled) return;
        const cur = loadState() ?? {};
        const { state, claimedCount } = claimWinnerRewards(cur, results, todayKey());
        if (claimedCount > 0) saveState(state);
      } catch {
        // best-effort — never block the app on a reward claim
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);
}
