import { useEffect, useState, Fragment } from 'react';
import { useAuth, getSupabase } from '../../lib/auth.js';
import {
  joinLeague,
  refreshLeague,
  fetchStandings,
  TIER_NAMES,
  LEAGUES_ENABLED,
} from '../../lib/leagues.js';
import { zoneCounts } from '../../lib/leagueZones.js';
import { weekRemaining } from '../../lib/leagueCountdown.js';
import { COLORS, SPACE } from '../../lib/theme.js';

const SPARSE_BELOW = 5; // show the "still filling up" note under this many members

function ZoneLabel({ text, color }) {
  return (
    <li
      aria-hidden="true"
      style={{
        borderTop: `2px solid ${color}`,
        margin: `${SPACE[1]}px 0`,
        padding: `${SPACE[1]}px ${SPACE[2]}px 0`,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        color,
      }}
    >
      {text}
    </li>
  );
}

export default function LeaderboardSection({ onSelectUser }) {
  const { user } = useAuth();
  const [state, setState] = useState({ status: 'idle', league: null, rows: [] });

  useEffect(() => {
    if (!LEAGUES_ENABLED || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const league = await joinLeague();
        await refreshLeague();
        const rows = await fetchStandings(getSupabase(), league.league_id);
        if (!cancelled) setState({ status: 'ready', league, rows });
        // Reward claiming lives in the app-load useLeagueRewards hook so winners
        // are credited even without opening this tab.
      } catch {
        if (!cancelled) setState({ status: 'error', league: null, rows: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!LEAGUES_ENABLED) return null;

  if (!user) {
    return (
      <div style={{ padding: SPACE[6], textAlign: 'center', color: COLORS.mute }}>
        <p style={{ margin: 0 }}>Sign in to join a league and compete this week.</p>
      </div>
    );
  }

  if (state.status === 'error') {
    return <p style={{ color: COLORS.red, padding: SPACE[4] }}>Couldn't load your league.</p>;
  }
  if (state.status !== 'ready') {
    return <p style={{ color: COLORS.mute, padding: SPACE[4] }}>Loading league…</p>;
  }

  const n = state.rows.length;
  // Promotion/relegation zones come from the SAME logic the settle job uses, so
  // the dividers reflect exactly who will advance/drop this week.
  const { promote, demote } = zoneCounts(n);
  const relegationStart = n - demote; // index of the first relegated row
  const countdown = weekRemaining(state.league.period_start);

  return (
    <div style={{ padding: SPACE[4] }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: SPACE[2],
        }}
      >
        <h3 style={{ margin: 0, color: COLORS.ink }}>{TIER_NAMES[state.league.tier]} League</h3>
        <span style={{ fontSize: 13, color: COLORS.mute }}>
          {countdown.ended ? 'Settling soon' : `Ends in ${countdown.label}`}
        </span>
      </div>

      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {state.rows.map((row, i) => {
          const isMe = row.user_id === user.id;
          const showPromote = promote > 0 && promote < n && i === promote;
          const showRelegate = demote > 0 && relegationStart > promote && i === relegationStart;
          return (
            <Fragment key={row.user_id}>
              {showPromote && <ZoneLabel text="↑ Promotion" color={COLORS.green} />}
              {showRelegate && <ZoneLabel text="↓ Relegation" color={COLORS.red} />}
              <li
                onClick={() => onSelectUser(row.user_id)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  padding: SPACE[2],
                  background: isMe ? COLORS.paperDeep : 'transparent',
                  fontWeight: isMe ? 700 : 400,
                  color: COLORS.ink,
                }}
              >
                <span>
                  {i + 1}. <span>{row.handle}</span>
                </span>
                <span>{row.weekly_xp} XP</span>
              </li>
            </Fragment>
          );
        })}
      </ol>

      {n < SPARSE_BELOW && (
        <p style={{ margin: `${SPACE[3]}px 0 0`, fontSize: 13, color: COLORS.mute }}>
          Your league is still filling up — more learners will join this week.
        </p>
      )}
    </div>
  );
}
