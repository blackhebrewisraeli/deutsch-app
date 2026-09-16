import { Flame } from 'lucide-react';
import {
  BORDER,
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  RADIUS,
  SPACE,
} from '../lib/theme';
import Surface from './ui/Surface';
import { Row, Stack } from './ui/Layout';
import Heading from './ui/Heading';
import { Body } from './ui/Text';
import { activePack } from '../packs';
import { isAuthConfigured } from '../lib/auth.js';
import Avatar from './ui/Avatar';
import GoalRing from './gamification/GoalRing';
import { useWindowWidth, bp } from '../lib/useWindowWidth';

const EMPTY_SCORE = {
  level: 1,
  rankName: '',
  xpIntoLevel: 0,
  xpToNext: 50,
  progress: 0,
  totalXp: 0,
};

// SPACE[16] is the previous hub avatar (64). The identity mark is 2× that so
// it reads as the card's anchor rather than a header chip.
const AVATAR_SIZE = SPACE[16] * 2;
const TRUNCATE = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const IDENTITY_HEADING_ID = 'home-identity-heading';

// Who you are, what is open today, and what to do next — one card at the top
// of Home.
//
// Identity is the visual anchor: a large avatar plus a compact greeting column
// that also holds today's Missionen / Tagesaufgaben (`today`) and, below the
// top row, the emphasized recommended actions (`recommended`). HomeTab composes
// those boards into these slots so they are not three competing page sections.
//
// Standing is quiet on purpose. The daily-goal ring and streak stay visible;
// dense Learned / XP-total counters do not — they compete with the actions.
// Arithmetic is unchanged; this file only decides what to print.
//
// Read-only on purpose. Decision E5 keeps account MANAGEMENT — email, sign
// out, export, danger zone — exclusive to Settings. The single interactive
// element owned by the hub itself is the link into that Settings view.
export default function PersonalHub({
  user,
  profile,
  cefrLevel,
  score = EMPTY_SCORE,
  streak = 0,
  goalPct = 0,
  goalMet = false,
  onOpenSettings,
  today = null,
  recommended = null,
}) {
  const copy = activePack.content.identity ?? {};
  const lvl = score ?? EMPTY_SCORE;
  const wide = useWindowWidth() >= bp.wide;

  // The league handle, then the email's local part. `display_name` used to sit
  // at the front of this chain; it was written by a form nobody filled in and
  // was null for every account, so the chain always fell through it. `handle`
  // is the one name: it is unique, it is denormalised onto league_members, and
  // it is what other learners already see on the leaderboard.
  //
  // A guest has neither and is greeted without a name rather than with a
  // placeholder that implies an account.
  const name = user ? (profile?.handle ?? user.email?.split('@')[0] ?? null) : null;

  const createdAt = profile?.created_at ? new Date(profile.created_at) : null;
  const showsAccountLine = Boolean(user);

  return (
    <Surface as="section" elevation={1} padding={4} aria-labelledby={IDENTITY_HEADING_ID}>
      <div
        data-testid="home-identity-row"
        style={{
          display: 'grid',
          gridTemplateColumns: wide ? `${AVATAR_SIZE}px minmax(0, 1fr)` : 'minmax(0, 1fr)',
          gap: SPACE[5],
          alignItems: 'start',
          minWidth: 0,
        }}
      >
        <div
          style={{
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            borderRadius: '50%',
            background: COLORS.paperDeep,
            border: `1px solid ${COLORS.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          <Avatar profile={profile} userId={user?.id} size={AVATAR_SIZE} />
        </div>

        {/* minmax(0, 1fr) semantics: this column must be allowed to shrink, or
            a long handle pushes the chip off a 320px screen. Wrapping the
            greeting (rather than nowrap) is the overflow behaviour — a handle
            is the name, and ellipsizing it would hide the one fact the hub
            exists to show. */}
        <Stack gap={3} style={{ minWidth: 0 }}>
          <Stack gap={1} style={{ minWidth: 0 }}>
            <Row wrap={false} align="flex-start" gap={3} style={{ minWidth: 0 }}>
              <Heading
                id={IDENTITY_HEADING_ID}
                level={2}
                style={{
                  margin: 0,
                  overflowWrap: 'anywhere',
                  maxWidth: '100%',
                  lineHeight: 1.2,
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {copy.greeting?.(name)}
              </Heading>
              <span
                aria-label={copy.levelLabel?.(String(cefrLevel ?? '').toUpperCase())}
                style={{
                  flexShrink: 0,
                  fontFamily: FONTS.mono,
                  fontSize: FONT_SIZE.tag,
                  fontWeight: FONT_WEIGHT.bold,
                  letterSpacing: LETTER_SPACING.caps,
                  color: COLORS.ink,
                  border: `1px solid ${COLORS.mute}`,
                  borderRadius: RADIUS.sm,
                  padding: `${SPACE[1]}px ${SPACE[2]}px`,
                }}
              >
                {String(cefrLevel ?? '').toUpperCase()}
              </span>
            </Row>
            {showsAccountLine && (
              <Body size="sm" tone="muted" as="div" style={TRUNCATE}>
                {[
                  profile?.handle ? `@${profile.handle}` : null,
                  createdAt ? copy.memberSince?.(createdAt) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Body>
            )}
          </Stack>

          <Row wrap gap={3} align="center" style={{ minWidth: 0 }}>
            <GoalRing pct={goalPct} met={goalMet} size={48} />
            <span
              aria-label={`Streak ${streak}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACE[1],
                minWidth: 0,
                flexShrink: 0,
              }}
            >
              <span style={{ color: COLORS.gold, display: 'flex' }} aria-hidden="true">
                <Flame size={14} />
              </span>
              <span
                style={{
                  fontFamily: FONTS.display,
                  fontWeight: FONT_WEIGHT.bold,
                  fontSize: FONT_SIZE.xl,
                  lineHeight: 1,
                  color: COLORS.ink,
                }}
              >
                {streak}
              </span>
            </span>
            <Body
              size="sm"
              tone="muted"
              as="div"
              style={{ minWidth: 0, overflowWrap: 'anywhere', flex: '1 1 8ch' }}
            >
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: FONT_SIZE.tag,
                  fontWeight: FONT_WEIGHT.bold,
                  letterSpacing: LETTER_SPACING.caps,
                  textTransform: 'uppercase',
                }}
              >
                Level
              </span>{' '}
              <span
                style={{
                  fontFamily: FONTS.display,
                  fontWeight: FONT_WEIGHT.bold,
                  fontSize: FONT_SIZE.md,
                  color: COLORS.ink,
                }}
              >
                {lvl.level}
              </span>
              {lvl.rankName ? (
                <>
                  {' · '}
                  <span style={{ overflowWrap: 'anywhere', minWidth: 0 }}>{lvl.rankName}</span>
                </>
              ) : null}
            </Body>
          </Row>

          {/* Only shown when there is an account to manage, and only when there is
              a backend to manage it against — AccountChip and AccountSection make
              the same check, so an unreachable Settings link never appears. */}
          {showsAccountLine && isAuthConfigured() && (
            <button
              type="button"
              onClick={onOpenSettings}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                alignSelf: 'flex-start',
                fontFamily: FONTS.mono,
                fontSize: FONT_SIZE.tag,
                color: COLORS.mute,
                textDecoration: 'underline',
              }}
            >
              {copy.settingsLink} →
            </button>
          )}

          {today}
        </Stack>
      </div>

      {recommended && (
        <div
          data-testid="home-recommended-well"
          style={{
            marginTop: SPACE[6],
            paddingTop: SPACE[5],
            borderTop: BORDER.panel,
            minWidth: 0,
          }}
        >
          {recommended}
        </div>
      )}
    </Surface>
  );
}
