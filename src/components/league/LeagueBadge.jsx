import { Shield } from 'lucide-react';
import {
  BORDER,
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  RADIUS,
  SPACE,
} from '../../lib/theme';
import { tierName } from '../../lib/leagueTier.js';
import Surface from '../ui/Surface';

// The ONE league display.
//
// There used to be two, on the same page, and they DISAGREED — not by accident
// but by construction. The Profile card read `profile.tier`, which the profile
// endpoint derives from the learner's most recent membership row; the
// leaderboard header read the tier of the league joinLeague() had just placed
// them in. Between a settle and this week's join those are different numbers,
// so the page could say Silver in one card and Gold in the next, six pixels
// apart, with no way for a reader to tell which one was about them.
//
// Deleting one of the two was not enough: the answer to "which tier am I in"
// had to have a single owner. That is this component plus `tierName`, and the
// callers now pass a tier in rather than each indexing TIER_NAMES their own way.
//
// Two variants, one visual language:
//   full    — the Profile page card: shield, tier, and what it has been worth.
//   compact — Home's at-a-glance pill, inline beside XP / level / streak.
//
// The chrome is deliberately NOT tier-coloured. A five-step colour ramp would
// need five tokens this palette does not have, and inventing them means either
// hardcoded hex (the guard in noHardcodedColors.test.js) or borrowing semantic
// tokens — an error red for Ruby, a success green for Sapphire — which is how a
// design system starts lying. The tier is carried by its NAME, set in the
// display face at a size nothing else in the card competes with, and the gold
// accent marks the shield as the one expressive element rather than as a rank.

const SHIELD = {
  full: 64,
  compact: 28,
};

const ICON = {
  full: 30,
  compact: 15,
};

/**
 * @param {object} props
 * @param {unknown} props.tier          tier index; anything unusable reads Bronze
 * @param {number} [props.wins]         settled leagues topped, `full` only
 * @param {number|null} [props.rank]    live position in the cohort
 * @param {number|null} [props.cohortSize]
 * @param {'full'|'compact'} [props.variant]
 */
export default function LeagueBadge({
  tier,
  wins = 0,
  rank = null,
  cohortSize = null,
  variant = 'full',
}) {
  const name = tierName(tier);
  const compact = variant === 'compact';
  const hasRank = Number.isFinite(rank) && rank > 0;

  const shield = (
    <div
      aria-hidden="true"
      style={{
        display: 'grid',
        placeItems: 'center',
        width: SHIELD[variant] ?? SHIELD.full,
        height: SHIELD[variant] ?? SHIELD.full,
        flexShrink: 0,
        borderRadius: RADIUS.pill,
        background: COLORS.surface2,
        border: `1px solid ${COLORS.borderStrong}`,
        color: COLORS.gold,
      }}
    >
      <Shield size={ICON[variant] ?? ICON.full} />
    </div>
  );

  if (compact) {
    return (
      <span
        data-testid="league-badge-compact"
        // The accessible name carries the rank too. Sighted readers get it from
        // the "#3/25" beside the tier; a screen reader arriving at a pill that
        // announced only "Bronze" would be told the league and not the standing,
        // which is the half that changes.
        aria-label={hasRank ? `${name} League, Platz ${rank} von ${cohortSize}` : `${name} League`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE[2],
          minWidth: 0,
          flexShrink: 0,
          paddingRight: SPACE[2],
        }}
      >
        {shield}
        <span
          aria-hidden="true"
          style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 2 }}
        >
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.tag,
              letterSpacing: LETTER_SPACING.caps,
              textTransform: 'uppercase',
              color: COLORS.mute,
              lineHeight: 1,
            }}
          >
            Liga
          </span>
          <span
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: SPACE[1],
              minWidth: 0,
              lineHeight: 1,
            }}
          >
            <span
              data-testid="league-badge-tier"
              style={{
                fontFamily: FONTS.display,
                fontWeight: FONT_WEIGHT.bold,
                fontSize: FONT_SIZE.lg,
                color: COLORS.ink,
                // A tier name is one short word, but the column it sits in can
                // be 77px at 320px — it truncates rather than widening Home.
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {name}
            </span>
            {hasRank && (
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: FONT_SIZE.sm,
                  color: COLORS.inkSoft,
                  flexShrink: 0,
                }}
              >
                #{rank}
                {Number.isFinite(cohortSize) ? `/${cohortSize}` : ''}
              </span>
            )}
          </span>
        </span>
      </span>
    );
  }

  return (
    <Surface
      elevation={2}
      padding={4}
      radius="xl"
      data-testid="profile-league"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE[4],
        minWidth: 0,
      }}
    >
      {shield}
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: SPACE[1] }}>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: FONT_SIZE.tag,
            letterSpacing: LETTER_SPACING.caps,
            textTransform: 'uppercase',
            color: COLORS.mute,
          }}
        >
          Liga
        </div>
        <div
          data-testid="league-badge-tier"
          style={{
            fontFamily: FONTS.display,
            fontSize: FONT_SIZE['2xl'],
            fontWeight: FONT_WEIGHT.bold,
            lineHeight: 1.05,
            color: COLORS.ink,
            overflowWrap: 'anywhere',
          }}
        >
          {name}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: SPACE[2],
            fontFamily: FONTS.mono,
            fontSize: FONT_SIZE.sm,
            color: COLORS.inkSoft,
            minWidth: 0,
          }}
        >
          {hasRank && (
            <span
              style={{
                borderRadius: RADIUS.pill,
                border: BORDER.panel,
                background: COLORS.surface2,
                padding: `2px ${SPACE[2]}px`,
                flexShrink: 0,
              }}
            >
              Platz {rank}
              {Number.isFinite(cohortSize) ? ` / ${cohortSize}` : ''}
            </span>
          )}
          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
            {wins > 0 ? `${wins} Ligasiege` : 'Noch kein Ligasieg'}
          </span>
        </div>
      </div>
    </Surface>
  );
}
