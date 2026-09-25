import { useId } from 'react';
import { Trophy } from 'lucide-react';
import { activePack } from '../../packs';
import { BORDER, COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACE } from '../../lib/theme';
import Avatar from '../ui/Avatar';
import Heading from '../ui/Heading';

const MAX_ROWS = 3;

function handleLabel(handle, fallback) {
  const value = typeof handle === 'string' ? handle.trim().replace(/^@+/, '') : '';
  return value ? `@${value}` : fallback;
}

// Private profiles deliberately lead with the public identifier rather than
// the chosen full name. The passport endpoint still returns enough identity
// data to draw the avatar and identify the row; this boundary decides what the
// compact public leaderboard is allowed to print.
function leaderboardDisplayName(leader, copy) {
  const profile = leader?.profile;
  const handle = profile?.handle || leader?.handle;
  const fallback = copy.anonymousHandle ?? '@anonym';
  if (profile?.is_private) return handleLabel(handle, fallback);

  const display = typeof profile?.display_name === 'string' ? profile.display_name.trim() : '';
  return display || handleLabel(handle, fallback);
}

export default function LeaderboardWidget({ leaders = [] }) {
  const copy = activePack.content.identity ?? {};
  const headingId = useId();
  const rows = leaders.slice(0, MAX_ROWS);

  if (rows.length === 0) return null;

  return (
    <section
      data-testid="home-leaderboard-widget"
      aria-labelledby={headingId}
      style={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        padding: SPACE[2],
        background: COLORS.paperDeep,
        border: BORDER.panel,
        borderRadius: RADIUS.lg,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE[2],
          minWidth: 0,
          marginBottom: SPACE[1],
        }}
      >
        <Trophy size={FONT_SIZE.md} color={COLORS.goldDeep} aria-hidden="true" />
        <Heading id={headingId} level={3} size="sm" style={{ lineHeight: 1.1 }}>
          {copy.leaderboardTitle ?? 'Top 3'}
        </Heading>
      </div>

      <ol
        aria-label={copy.leaderboardLabel ?? 'Top 3 leaderboard'}
        style={{ listStyle: 'none', margin: 0, padding: 0, minWidth: 0 }}
      >
        {rows.map((leader, index) => {
          const rank = index + 1;
          const name = leaderboardDisplayName(leader, copy);
          return (
            <li
              key={leader.user_id}
              style={{
                display: 'grid',
                gridTemplateColumns: '24px 28px minmax(0, 1fr) auto',
                alignItems: 'center',
                gap: SPACE[2],
                width: '100%',
                maxWidth: '100%',
                minWidth: 0,
                boxSizing: 'border-box',
                padding: `${SPACE[1]}px ${SPACE[2]}px`,
                borderRadius: RADIUS.md,
                background: rank === 1 ? COLORS.goldSoft : 'transparent',
              }}
            >
              <span
                aria-label={`Rank ${rank}`}
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  width: 24,
                  height: 24,
                  borderRadius: RADIUS.pill,
                  background: rank === 1 ? COLORS.gold : COLORS.surface,
                  color: rank === 1 ? COLORS.accentOn : COLORS.inkSoft,
                  fontFamily: FONTS.mono,
                  fontSize: FONT_SIZE.ipa,
                  fontWeight: FONT_WEIGHT.bold,
                  lineHeight: 1,
                }}
              >
                {rank}
              </span>
              <Avatar profile={leader.profile} userId={leader.user_id} size={28} />
              <span
                title={name}
                style={{
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontFamily: FONTS.body,
                  fontSize: FONT_SIZE.base,
                  fontWeight: rank === 1 ? FONT_WEIGHT.bold : FONT_WEIGHT.medium,
                  color: COLORS.ink,
                }}
              >
                {name}
              </span>
              <span
                style={{
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                  fontFamily: FONTS.mono,
                  fontSize: FONT_SIZE.ipa,
                  fontWeight: FONT_WEIGHT.bold,
                  color: COLORS.inkSoft,
                }}
              >
                {copy.leaderboardXp?.(leader.weekly_xp) ?? `${leader.weekly_xp ?? 0} XP`}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
