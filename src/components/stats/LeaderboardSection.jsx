import { useEffect, useState, Fragment } from 'react';
import { Users } from 'lucide-react';
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
import { COLORS, RADIUS, SPACE } from '../../lib/theme.js';
import StatusNote from '../ui/StatusNote';

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
  const userId = user?.id;
  const [state, setState] = useState({ status: 'idle', league: null, rows: [] });

  // Depend on the stable id, not the user object — a fresh object identity on
  // re-render would otherwise re-fire join/refresh and could double-create a
  // membership.
  useEffect(() => {
    if (!LEAGUES_ENABLED || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const league = await joinLeague();
        await refreshLeague();
        const rows = await fetchStandings(await getSupabase(), league.league_id);
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
  }, [userId]);

  if (!LEAGUES_ENABLED) return null;

  if (!user) {
    return <StatusNote icon={Users}>Sign in to join a league and compete this week.</StatusNote>;
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
          const isMe = row.user_id === userId;
          const showPromote = promote > 0 && promote < n && i === promote;
          const showRelegate = demote > 0 && relegationStart > promote && i === relegationStart;
          return (
            <Fragment key={row.user_id}>
              {showPromote && <ZoneLabel text="↑ Promotion" color={COLORS.green} />}
              {showRelegate && <ZoneLabel text="↓ Relegation" color={COLORS.red} />}
              <li style={{ padding: 0 }}>
                {/* The row is a real <button>, not a clickable <li>: that is
                    what puts it in the tab order and gives it Enter AND Space
                    for free. It fills the list item so the whole row stays the
                    click target. */}
                <button
                  type="button"
                  // The app's one focus ring, from injectGlobalStyles. The
                  // offset is inset because the rows are full-bleed inside the
                  // list: an outset ring is clipped by the container edge and
                  // overlaps the neighbouring row.
                  data-ui="button"
                  data-focus-inset=""
                  onClick={() => onSelectUser(row.user_id)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: SPACE[2],
                    width: '100%',
                    boxSizing: 'border-box',
                    textAlign: 'left',
                    font: 'inherit',
                    border: 'none',
                    borderRadius: RADIUS.sm,
                    cursor: 'pointer',
                    padding: SPACE[2],
                    background: isMe ? COLORS.paperDeep : 'transparent',
                    fontWeight: isMe ? 700 : 400,
                    color: COLORS.ink,
                  }}
                >
                  {/* minWidth:0 lets a long handle ellipsize instead of
                      widening the row past a 320px viewport. */}
                  <span
                    style={{
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {i + 1}. <span>{row.handle}</span>
                  </span>
                  <span style={{ flexShrink: 0 }}>{row.weekly_xp} XP</span>
                </button>
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
