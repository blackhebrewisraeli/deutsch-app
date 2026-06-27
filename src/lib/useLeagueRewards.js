import { useEffect, useRef } from 'react';
import { loadState, saveState } from './storage.js';
import { todayKey } from './stats.js';
import { getSupabase } from './auth.js';
import { LEAGUES_ENABLED, fetchMyResults } from './leagues.js';
import { claimWinnerRewards, WINNER_BONUS_XP } from './leagueRewards.js';

// Claims any unclaimed league-winner rewards into local state when a signed-in
// user loads the app — not only when they open the Leagues tab. Idempotent
// (claimWinnerRewards dedups via gamification.leagueClaimed), so running once
// per sign-in is enough; failures are swallowed so a reward claim never blocks
// the app. The credited bonus XP flows through the normal bonusXp → xpForDay →
// sync path; the gamification recompute picks up the badge on its next run.
//
// onClaimed(count, xp) fires once when a new win is claimed, so the caller can
// surface a celebration toast. It's held in a ref so passing a fresh inline
// callback each render does not re-trigger the effect.
export function useLeagueRewards(userId, onClaimed) {
  const onClaimedRef = useRef(onClaimed);
  onClaimedRef.current = onClaimed;

  useEffect(() => {
    if (!LEAGUES_ENABLED || !userId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const results = await fetchMyResults(getSupabase(), userId);
        if (cancelled) return;
        const cur = loadState() ?? {};
        const { state, claimedCount } = claimWinnerRewards(cur, results, todayKey());
        if (claimedCount > 0) {
          saveState(state);
          if (onClaimedRef.current)
            onClaimedRef.current(claimedCount, claimedCount * WINNER_BONUS_XP);
        }
      } catch {
        // best-effort — never block the app on a reward claim
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);
}
