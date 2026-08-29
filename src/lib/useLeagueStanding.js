import { useEffect, useState } from 'react';
import { getSupabase } from './auth.js';
import { LEAGUES_ENABLED, fetchMyMembership, fetchStandings } from './leagues.js';
import { currentPeriodStart } from './leagueCountdown.js';
import { zoneCounts } from './leagueZones.js';

// The caller's live league standing for Home, as TWO READS and nothing else.
//
// Why not reuse the leaderboard's fetch: LeaderboardSection calls joinLeague()
// and refreshLeague() before reading, and both are WRITES — join can create a
// league row and a membership. Home is the landing tab, opened every session,
// so running that sequence here would turn every app open into two database
// writes. If there is no membership for this period the mission simply does not
// fire; a learner who has not joined a league has no standing to be at risk of,
// and Home must not create one for them.
//
// Why rank is derived rather than read: league_members.rank is written only by
// the weekly settle cron, so it is NULL during the live week. Position has to
// come from the ordering of weekly_xp within the cohort — the same thing
// LeaderboardSection does — and the drop-zone size comes from zoneCounts, which
// settlement itself uses, so what the mission claims matches what will happen.
//
// Freshness: weekly_xp is only as current as the last refresh call, so this can
// lag XP earned since. That is accepted, not fixed here — refreshing is the
// write we are avoiding. The mission is a nudge; the Leagues tab stays the
// accurate surface.

/**
 * @param {string|undefined} userId
 * @returns {{rank: number, cohortSize: number, inDemotionZone: boolean}|null}
 */
export function useLeagueStanding(userId) {
  const [standing, setStanding] = useState(null);

  useEffect(() => {
    if (!LEAGUES_ENABLED || !userId) {
      setStanding(null);
      return undefined;
    }
    let cancelled = false;

    (async () => {
      try {
        const supabase = await getSupabase();
        const membership = await fetchMyMembership(supabase, userId, currentPeriodStart());
        if (cancelled) return;
        if (!membership?.league_id) {
          setStanding(null);
          return;
        }

        const rows = await fetchStandings(supabase, membership.league_id);
        if (cancelled) return;

        const cohortSize = rows.length;
        const rank = rows.findIndex((r) => r.user_id === userId) + 1;
        if (rank === 0) {
          setStanding(null);
          return;
        }

        const { demote } = zoneCounts(cohortSize);
        setStanding({ rank, cohortSize, inDemotionZone: demote > 0 && rank > cohortSize - demote });
      } catch {
        // Best-effort: a failed league read must never break Home. The mission
        // just does not appear.
        if (!cancelled) setStanding(null);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Fetched once per user, not per render: Home re-renders on every progress
    // event, and a standing changes at most a few times a day.
  }, [userId]);

  return standing;
}
