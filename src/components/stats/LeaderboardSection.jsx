import { useEffect, useState } from 'react';
import { useAuth, getSupabase } from '../../lib/auth.js';
import {
  joinLeague,
  refreshLeague,
  fetchStandings,
  TIER_NAMES,
  LEAGUES_ENABLED,
} from '../../lib/leagues.js';
import { COLORS, SPACE } from '../../lib/theme.js';

const PROMOTE_ZONE = 7;
const DEMOTE_ZONE = 5;

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
  return (
    <div style={{ padding: SPACE[4] }}>
      <h3 style={{ margin: `0 0 ${SPACE[2]}px`, color: COLORS.ink }}>
        <span>{TIER_NAMES[state.league.tier]}</span>
        {' League'}
      </h3>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {state.rows.map((row, i) => {
          const isMe = row.user_id === user.id;
          const zoneBorder =
            i === PROMOTE_ZONE - 1
              ? `2px solid ${COLORS.green}`
              : i === n - DEMOTE_ZONE
                ? `2px solid ${COLORS.red}`
                : 'none';
          return (
            <li
              key={row.user_id}
              onClick={() => onSelectUser(row.user_id)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                cursor: 'pointer',
                padding: SPACE[2],
                borderBottom: zoneBorder,
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
          );
        })}
      </ol>
    </div>
  );
}
