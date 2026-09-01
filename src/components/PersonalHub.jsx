import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, RADIUS, SPACE } from '../lib/theme';
import Surface from './ui/Surface';
import { Row, Stack } from './ui/Layout';
import Heading from './ui/Heading';
import { Meta } from './ui/Text';
import { activePack } from '../packs';
import { isAuthConfigured } from '../lib/auth.js';
import Avatar from './ui/Avatar';

const EMPTY_SCORE = {
  level: 1,
  rankName: '',
  xpIntoLevel: 0,
  xpToNext: 50,
  progress: 0,
  totalXp: 0,
};

// Who you are, and where you stand — one card at the top of Home.
//
// Merges the identity row with the XP glance that used to sit in a second
// card beneath it. Both were derived from the same learner; splitting them
// made Home open with two headers for one person, and let the level and the
// total XP arrive as two props that could disagree. `score` is one object
// from one read of one log, so that disagreement is unrepresentable.
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
      <Row align="center" gap={4}>
        <Avatar profile={profile} userId={user?.id} size={40} />

        {/* minmax(0, 1fr) semantics: this column must be allowed to shrink, or
            a long handle pushes the chip off a 320px screen. */}
        <Stack gap={1} style={{ minWidth: 0, flex: 1 }}>
          <Heading level={2} style={{ margin: 0 }}>
            {copy.greeting?.(name)}
          </Heading>
          {showsAccountLine && (
            <Meta
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
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
          gridTemplateColumns: 'auto minmax(0, 1fr) auto',
          gap: SPACE[4],
          alignItems: 'center',
          marginTop: SPACE[5],
          paddingTop: SPACE[4],
          borderTop: `1px solid ${COLORS.border}`,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: FONTS.display,
              fontWeight: FONT_WEIGHT.black,
              fontSize: FONT_SIZE['4xl'],
              color: COLORS.ink,
              lineHeight: 1,
            }}
          >
            {lvl.level}
          </div>
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.tag,
              letterSpacing: LETTER_SPACING.caps,
              color: COLORS.mute,
            }}
          >
            LEVEL
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: FONTS.display,
              fontSize: FONT_SIZE.xl,
              fontWeight: FONT_WEIGHT.bold,
              color: COLORS.ink,
            }}
          >
            {lvl.rankName}
          </div>
          <div
            style={{
              height: 10,
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
          <div style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.sm, color: COLORS.mute }}>
            {lvl.xpIntoLevel} / {lvl.xpToNext} XP to next · {lvl.totalXp} XP total
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: FONTS.display,
              fontWeight: FONT_WEIGHT.bold,
              fontSize: FONT_SIZE['3xl'],
              color: COLORS.ink,
            }}
          >
            {learnedCount}
          </div>
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.tag,
              letterSpacing: LETTER_SPACING.caps,
              color: COLORS.mute,
            }}
          >
            LEARNED
          </div>
        </div>
      </div>
    </Surface>
  );
}
