import { Flame } from 'lucide-react';
import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, RADIUS, SPACE } from '../lib/theme';
import Surface from './ui/Surface';
import { Row, Stack } from './ui/Layout';
import Heading from './ui/Heading';
import { Meta } from './ui/Text';
import { activePack } from '../packs';
import { isAuthConfigured } from '../lib/auth.js';
import Avatar from './ui/Avatar';
import GoalRing from './gamification/GoalRing';

const EMPTY_SCORE = {
  level: 1,
  rankName: '',
  xpIntoLevel: 0,
  xpToNext: 50,
  progress: 0,
  totalXp: 0,
};

const AVATAR_SIZE = SPACE[16];
const TRUNCATE = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

// Who you are, and where you stand — one card at the top of Home.
//
// Identity is the visual anchor: a large avatar, the greeting, and the CEFR
// chip. XP arithmetic, streak, and the daily-goal ring used to arrive as a
// second header-sized block (and, for streak/goal, as a loose row under the
// hub). They are the same learner's standing, so they live here as a compact
// secondary row rather than competing with the face and name.
//
// Read-only on purpose. Decision E5 keeps account MANAGEMENT — email, sign
// out, export, danger zone — exclusive to Settings. The single interactive
// element is the link into that Settings view.
export default function PersonalHub({
  user,
  profile,
  cefrLevel,
  score = EMPTY_SCORE,
  learnedCount = 0,
  streak = 0,
  goalPct = 0,
  goalMet = false,
  onOpenSettings,
}) {
  const copy = activePack.content.identity ?? {};
  const lvl = score ?? EMPTY_SCORE;

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
    <Surface elevation={1} padding={4}>
      <Row wrap={false} align="flex-start" gap={4}>
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
        <Stack gap={1} style={{ minWidth: 0, flex: 1 }}>
          <Heading
            level={2}
            style={{ margin: 0, overflowWrap: 'anywhere', maxWidth: '100%', lineHeight: 1.2 }}
          >
            {copy.greeting?.(name)}
          </Heading>
          {showsAccountLine && (
            <Meta style={TRUNCATE}>
              {[
                profile?.handle ? `@${profile.handle}` : null,
                createdAt ? copy.memberSince?.(createdAt) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Meta>
          )}
        </Stack>

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

      {/* Only shown when there is an account to manage, and only when there is
          a backend to manage it against — AccountChip and AccountSection make
          the same check, so an unreachable Settings link never appears. */}
      {showsAccountLine && isAuthConfigured() && (
        <div style={{ marginTop: SPACE[3] }}>
          <button
            type="button"
            onClick={onOpenSettings}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.tag,
              color: COLORS.mute,
              textDecoration: 'underline',
            }}
          >
            {copy.settingsLink} →
          </button>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0, 1fr)',
          gap: SPACE[4],
          alignItems: 'center',
          marginTop: SPACE[5],
          paddingTop: SPACE[4],
          borderTop: `1px solid ${COLORS.border}`,
        }}
      >
        <Row wrap={false} gap={3} align="center" style={{ flexShrink: 0 }}>
          <GoalRing pct={goalPct} met={goalMet} size={48} />
          <span
            aria-label={`Streak ${streak}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACE[1],
              minWidth: 0,
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
        </Row>

        <div style={{ minWidth: 0 }}>
          <Row align="baseline" gap={2} style={{ minWidth: 0 }}>
            <Row wrap={false} align="baseline" gap={2} style={{ flexShrink: 0 }}>
              <span
                style={{
                  fontFamily: FONTS.display,
                  fontWeight: FONT_WEIGHT.black,
                  fontSize: FONT_SIZE.xl,
                  color: COLORS.ink,
                  lineHeight: 1,
                }}
              >
                {lvl.level}
              </span>
              <Meta>Level</Meta>
            </Row>
            <span
              style={{
                fontFamily: FONTS.display,
                fontSize: FONT_SIZE.lg,
                fontWeight: FONT_WEIGHT.bold,
                color: COLORS.ink,
                overflowWrap: 'anywhere',
                minWidth: 0,
                flex: '1 1 8ch',
              }}
            >
              {lvl.rankName}
            </span>
            <Row wrap={false} align="baseline" gap={2} style={{ flexShrink: 0 }}>
              <span
                style={{
                  fontFamily: FONTS.display,
                  fontWeight: FONT_WEIGHT.bold,
                  fontSize: FONT_SIZE.lg,
                  color: COLORS.ink,
                  lineHeight: 1,
                }}
              >
                {learnedCount}
              </span>
              <Meta>Learned</Meta>
            </Row>
          </Row>
          <div
            style={{
              height: 6,
              borderRadius: RADIUS.pill,
              background: COLORS.paperDeep,
              overflow: 'hidden',
              margin: `${SPACE[2]}px 0`,
            }}
          >
            <div
              style={{
                width: `${Math.round((lvl.progress ?? 0) * 100)}%`,
                height: '100%',
                background: COLORS.green,
              }}
            />
          </div>
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.sm,
              color: COLORS.mute,
              overflowWrap: 'anywhere',
            }}
          >
            {lvl.xpIntoLevel} / {lvl.xpToNext} XP to next · {lvl.totalXp} XP total
          </div>
        </div>
      </div>
    </Surface>
  );
}
