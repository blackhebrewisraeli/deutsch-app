import { ACHIEVEMENTS } from '../../lib/gamification';
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

/**
 * Tile floor, and the one number in this file that was measured rather than
 * chosen.
 *
 * At 140px the grid could fit only ONE column inside the 288px content box a
 * 320px viewport leaves (140 × 2 + 12 gap = 292 > 288), so fifteen badges
 * stacked into a 1758px wall — more than two phone screens of scrolling for a
 * section that is meant to be glanceable. 104px fits two columns with room to
 * spare and roughly halves that height.
 */
const MIN_TILE = 104;

/**
 * Every achievement as a tile: earned reads as a solid card, locked as an
 * empty outline waiting to be filled.
 *
 * `achievements` is the persisted `{ id: unlockedTs }` map.
 *
 * WHY THE LOCKED STATE CHANGED
 * ----------------------------
 * It used to be `opacity: 0.55` plus `grayscale(1)` over the whole tile, which
 * dimmed the TEXT as much as the icon. This app measures rendered contrast in
 * CI, and fading a muted foreground to just over half strength is the wrong
 * side of that gate to sit on — a locked badge still has to be readable, it is
 * the thing telling a learner what to aim at.
 *
 * So the dimming moved onto the ICON alone, and the state is carried by the
 * BORDER instead: solid for earned, dashed for locked. The word underneath
 * ("FREIGESCHALTET" / "GESPERRT") is what a screen reader gets either way —
 * the border is a second, visual channel, never the only one.
 *
 * The drop shadow is gone. SHADOW.card on every earned tile turned a grid of
 * fifteen into fifteen floating slabs; a hairline border from the structural
 * token draws the same boundary without the weight.
 */
export default function BadgeGrid({ achievements }) {
  return (
    // A real list: fifteen sibling tiles are a list, and a screen reader that
    // announces "list, 15 items" tells a learner how much is here before they
    // start arrowing through it.
    <ul
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${MIN_TILE}px, 1fr))`,
        gap: SPACE[2],
        minWidth: 0,
      }}
    >
      {ACHIEVEMENTS.map((a) => {
        const earned = Boolean(achievements?.[a.id]);
        return (
          <li
            key={a.id}
            data-badge={earned ? 'earned' : 'locked'}
            style={{
              minWidth: 0,
              display: 'grid',
              gap: SPACE[1],
              justifyItems: 'center',
              textAlign: 'center',
              padding: `${SPACE[3]}px ${SPACE[2]}px`,
              borderRadius: RADIUS.md,
              background: earned ? COLORS.card : 'transparent',
              border: earned ? BORDER.panel : `1px dashed ${COLORS.border}`,
            }}
          >
            {/* The only thing that dims. The glyph is decorative — the badge's
                name and state are both spelled out below it. */}
            <span
              aria-hidden="true"
              style={{ fontSize: FONT_SIZE['2xl'], lineHeight: 1.2, opacity: earned ? 1 : 0.4 }}
            >
              {a.icon}
            </span>

            <span
              style={{
                minWidth: 0,
                fontFamily: FONTS.display,
                fontSize: FONT_SIZE.base,
                fontWeight: FONT_WEIGHT.semibold,
                lineHeight: 1.25,
                color: earned ? COLORS.ink : COLORS.mute,
                // A two-word badge name has to wrap inside a 104px tile rather
                // than widen it.
                overflowWrap: 'anywhere',
              }}
            >
              {a.name}
            </span>

            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: FONT_SIZE.label,
                // `caps` tracking (0.2em) pushes FREIGESCHALTET past the inner
                // width of a 104px tile; `wide` keeps the mono label feeling
                // set without making it the widest thing in the grid.
                letterSpacing: LETTER_SPACING.wide,
                textTransform: 'uppercase',
                lineHeight: 1.4,
                color: COLORS.mute,
                overflowWrap: 'anywhere',
                minWidth: 0,
              }}
            >
              {earned ? 'FREIGESCHALTET' : 'GESPERRT'}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
