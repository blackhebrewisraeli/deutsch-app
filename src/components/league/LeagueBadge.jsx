import { Shield } from 'lucide-react';
import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACE } from '../../lib/theme';
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
//   full    — the Profile page card.
//   compact — Home's at-a-glance pill, inline beside XP / level / streak.
//
// Both deliberately say ONE thing: the learner's league. Rank and cohort size
// belong to the leaderboard, where the surrounding roster gives those numbers
// meaning. Repeating "#2/2" in an identity badge made a short name overflow and
// turned a stable identity marker into a second, noisier standings display.
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
 * @param {'full'|'compact'} [props.variant]
 */
export default function LeagueBadge({ tier, variant = 'full' }) {
  const name = tierName(tier);
  const compact = variant === 'compact';

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
        aria-label={`${name} League`}
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
          data-testid="league-badge-tier"
          aria-hidden="true"
          style={{
            minWidth: 0,
            fontFamily: FONTS.display,
            fontWeight: FONT_WEIGHT.bold,
            fontSize: FONT_SIZE.lg,
            lineHeight: 1,
            color: COLORS.ink,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
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
      aria-label={`${name} League`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE[3],
        minWidth: 0,
      }}
    >
      {shield}
      <div
        data-testid="league-badge-tier"
        style={{
          minWidth: 0,
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
    </Surface>
  );
}
