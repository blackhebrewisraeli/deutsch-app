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
import { Body, Meta } from './ui/Text';
import { activePack } from '../packs';
import Avatar from './ui/Avatar';
import GoalRing from './gamification/GoalRing';
import LeagueBadge from './league/LeagueBadge';
import { LEAGUES_ENABLED } from '../lib/leagues.js';
import { useWindowWidth, bp } from '../lib/useWindowWidth';

const EMPTY_SCORE = {
  level: 1,
  rankName: '',
  xpIntoLevel: 0,
  xpToNext: 50,
  progress: 0,
  totalXp: 0,
};

// SPACE[16] is the original hub chip (64). #268 doubled it to 128, which still
// reads as ~10–15% of the card. Desktop grows to 4× the chip so the mark is a
// column, not a header button; mobile gives the avatar its own equal track so
// it is half the identity band. Never a bare `1fr` — minmax(0, 1fr) is what
// lets the column shrink below its content instead of pushing the page wide.
const AVATAR_DESKTOP = SPACE[16] * 4;
const IDENTITY_COLUMNS_WIDE = `${AVATAR_DESKTOP}px minmax(0, 1fr)`;
const IDENTITY_COLUMNS_NARROW = 'minmax(0, 1fr) minmax(0, 1fr)';

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
// that also holds today's Missionen / Tagesaufgaben (`today`) on wide viewports
// and, below the top row, the emphasized recommended actions (`recommended`).
// On a narrow viewport the avatar column is half the identity band, so `today`
// drops under that band instead of squeezing into the remaining half. HomeTab
// composes those boards into these slots so they are not three competing page
// sections.
//
// Standing is quiet on purpose. The daily-goal ring, total XP, level, and a
// live streak stay visible; dense Learned / XP-to-next counters do not compete
// with the actions. Arithmetic is unchanged; this file only decides what to
// print.
//
// Spacing is denser than the first identity-card pass: #270 grew the avatar
// and type, which left Missionen / Tagesaufgaben / Recommended sitting in
// empty vertical air. Tokens step down one SPACE stop; the avatar column is
// untouched.
//
// Read-only on purpose, and now read-only completely. Decision E5 keeps account
// MANAGEMENT — email, sign out, export, danger zone — exclusive to Settings; the
// hub used to own one control, a "Settings →" link beside the avatar, and that is
// gone. It made the landing screen carry two Settings doors while the header
// account bubble — the affordance a learner actually reaches for — was the less
// obvious of the two. The bubble is now the single door to Profile and Settings,
// so this card renders nothing interactive at all.
export default function PersonalHub({
  user,
  profile,
  cefrLevel,
  score = EMPTY_SCORE,
  streak = 0,
  goalPct = 0,
  goalMet = false,
  league = null,
  today = null,
  recommended = null,
}) {
  const copy = activePack.content.identity ?? {};
  const lvl = score ?? EMPTY_SCORE;
  const wide = useWindowWidth() >= bp.wide;

  // A chosen display name is how the app addresses the learner. The handle is
  // the unique social identifier and stays visible on its own line; it is only
  // a greeting fallback when no display name has been chosen yet.
  const displayName = typeof profile?.display_name === 'string' ? profile.display_name.trim() : '';
  const name = user ? displayName || profile?.handle || user.email?.split('@')[0] || null : null;

  const createdAt = profile?.created_at ? new Date(profile.created_at) : null;
  const showsAccountLine = Boolean(user);

  const identityFacts = (
    <Stack gap={2} style={{ minWidth: 0 }}>
      <Stack gap={1} style={{ minWidth: 0 }}>
        <Row wrap={false} align="flex-start" gap={2} style={{ minWidth: 0 }}>
          <Heading
            id={IDENTITY_HEADING_ID}
            level={2}
            style={{
              margin: 0,
              overflowWrap: 'anywhere',
              maxWidth: '100%',
              lineHeight: 1.15,
              flex: 1,
              minWidth: 0,
              // Heading level 2 is 24px — same as a section title, smaller
              // than the wordmark. This card's greeting is the identity
              // display line; 4xl matches the masthead without touching
              // Heading's global scale.
              //
              // Narrow steps down to 2xl, and that is not taste. At 320px the
              // avatar owns half the identity band, which leaves the greeting
              // a measured 77px of track — so "Guten Tag" broke as "Gut / en /
              // Tag", three lines of a two-word greeting, with the word split
              // mid-syllable. Same curve as Heading size="display": the
              // display face scales with the space it has instead of holding
              // one size until it shatters.
              fontSize: wide ? FONT_SIZE['4xl'] : FONT_SIZE['2xl'],
            }}
          >
            {copy.greeting?.(name)}
          </Heading>
          {/* The band chip beside a 36px greeting. It sat at 10px with the
              widest tracking, which is the recipe for a label you SCAN past —
              this is a fact about the learner and reads as one at 11px. The
              trailing caps tracking is dropped so the glyphs are not pushed
              off-centre inside their own border. */}
          <span
            aria-label={copy.levelLabel?.(String(cefrLevel ?? '').toUpperCase())}
            style={{
              flexShrink: 0,
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.ipa,
              fontWeight: FONT_WEIGHT.bold,
              letterSpacing: LETTER_SPACING.wider,
              color: COLORS.ink,
              border: `1px solid ${COLORS.mute}`,
              borderRadius: RADIUS.sm,
              padding: `${SPACE[1]}px ${SPACE[2]}px`,
            }}
          >
            {String(cefrLevel ?? '').toUpperCase()}
          </span>
        </Row>
        {/* `soft`, not `muted`. Supporting prose across the app is inkSoft and
            labels are mute; these two lines had it backwards, so the handle
            and the level — the two facts this card exists to state — were set
            in the quietest ink on the page. */}
        {showsAccountLine && (
          <Body size="sm" tone="soft" as="div" style={TRUNCATE}>
            {[
              profile?.handle ? `@${profile.handle}` : null,
              createdAt ? copy.memberSince?.(createdAt) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Body>
        )}
      </Stack>

      <Row wrap gap={2} align="center" data-testid="home-identity-standing" style={{ minWidth: 0 }}>
        <GoalRing pct={goalPct} met={goalMet} size={SPACE[12]} />
        <span
          data-testid="home-identity-xp"
          aria-label={`${lvl.totalXp ?? 0} XP`}
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: SPACE[1],
            minWidth: 0,
            flexShrink: 0,
          }}
        >
          <span
            data-testid="home-identity-xp-value"
            style={{
              fontFamily: FONTS.display,
              fontWeight: FONT_WEIGHT.bold,
              fontSize: FONT_SIZE['3xl'],
              lineHeight: 1,
              color: COLORS.ink,
            }}
          >
            {lvl.totalXp ?? 0}
          </span>{' '}
          <Meta tone="soft" style={{ letterSpacing: LETTER_SPACING.wider }}>
            XP
          </Meta>
        </span>
        <span
          data-testid="home-identity-level-group"
          style={{
            display: 'flex',
            alignItems: 'baseline',
            columnGap: SPACE[1],
            rowGap: SPACE[1],
            flexWrap: 'wrap',
            minWidth: 0,
            overflowWrap: 'anywhere',
            flex: '1 1 8ch',
            borderLeft: BORDER.panel,
            paddingLeft: SPACE[2],
          }}
        >
          <Meta>Level</Meta>{' '}
          <span
            data-testid="home-identity-level"
            style={{
              fontFamily: FONTS.display,
              fontWeight: FONT_WEIGHT.bold,
              fontSize: FONT_SIZE['3xl'],
              lineHeight: 1,
              color: COLORS.ink,
            }}
          >
            {lvl.level}
          </span>
          {lvl.rankName ? (
            <>
              {' · '}
              <Body
                size="sm"
                tone="soft"
                as="span"
                style={{ minWidth: 0, overflowWrap: 'anywhere' }}
              >
                {lvl.rankName}
              </Body>
            </>
          ) : null}
        </span>
        {streak > 0 ? (
          <span
            aria-label={`Streak ${streak}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACE[1],
              minWidth: 0,
              flexShrink: 0,
              color: COLORS.gold,
            }}
          >
            <Flame size={FONT_SIZE.lg} aria-hidden="true" />
            <span
              data-testid="home-identity-streak"
              style={{
                fontFamily: FONTS.mono,
                fontWeight: FONT_WEIGHT.bold,
                fontSize: FONT_SIZE.sm,
                lineHeight: 1,
                color: COLORS.inkSoft,
              }}
            >
              {streak}
            </span>
          </span>
        ) : null}
        {/* Standing at a glance. A READ-ONLY badge: `league` comes from
            useLeagueStanding, which deliberately never joins or refreshes — see
            that hook's header for why Home must not write on open. A signed-in
            learner with no membership yet still sees Bronze, because Bronze is
            the floor everyone starts on rather than an unknown. This is the
            league STANDING, not the leaderboard: the roster of 25 names stays
            exclusive to the Profile tab (HomeTab's E5 exclusion). */}
        {LEAGUES_ENABLED && user ? (
          <LeagueBadge
            variant="compact"
            tier={league?.tier}
            rank={league?.rank ?? null}
            cohortSize={league?.cohortSize ?? null}
          />
        ) : null}
      </Row>

      {/* The Settings link stood here, between the level line and the today slot.
          Nothing replaces it: both are direct children of this Stack, so the
          gap collapses to a single SPACE step rather than leaving a hole. */}
      {wide ? today : null}
    </Stack>
  );

  return (
    <Surface as="section" elevation={1} padding={4} aria-labelledby={IDENTITY_HEADING_ID}>
      <div
        data-testid="home-identity-row"
        style={{
          display: 'grid',
          gridTemplateColumns: wide ? IDENTITY_COLUMNS_WIDE : IDENTITY_COLUMNS_NARROW,
          gap: SPACE[4],
          alignItems: 'start',
          minWidth: 0,
        }}
      >
        <div
          data-testid="home-identity-avatar"
          style={{
            width: '100%',
            aspectRatio: '1 / 1',
            maxWidth: '100%',
            minWidth: 0,
            borderRadius: '50%',
            background: COLORS.paperDeep,
            border: `1px solid ${COLORS.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          <Avatar
            profile={profile}
            userId={user?.id}
            size={AVATAR_DESKTOP}
            style={{ width: '100%', height: '100%' }}
          />
        </div>

        {/* minmax(0, 1fr) semantics: this column must be allowed to shrink, or
            a long handle pushes the chip off a 320px screen. Wrapping the
            greeting (rather than nowrap) is the overflow behaviour — a handle
            is the name, and ellipsizing it would hide the one fact the hub
            exists to show. */}
        {identityFacts}
      </div>

      {!wide && today && <div style={{ marginTop: SPACE[3], minWidth: 0 }}>{today}</div>}

      {recommended && (
        <div
          data-testid="home-recommended-well"
          style={{
            marginTop: SPACE[4],
            paddingTop: SPACE[3],
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
