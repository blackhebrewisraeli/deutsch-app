import { ACHIEVEMENTS } from '../../lib/gamification';
import {
  BORDER,
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  LINE_HEIGHT,
  OPACITY,
  RADIUS,
  SPACE,
} from '../../lib/theme';

/**
 * Tile floor, and the one number here that is a LAYOUT decision rather than a
 * style value — so it is a named constant, not a token.
 *
 * It was measured, not chosen. At 140px the grid could fit only ONE column
 * inside the 288px content box a 320px viewport leaves (140 × 2 + 12 gap = 292
 * > 288), so fifteen badges stacked into a 1758px wall — more than two phone
 * screens for a section meant to be glanceable. 104px fits two columns at
 * 320px and three at 375px, taking those to 751px and 547px.
 */
const MIN_TILE = 104;

/**
 * Every achievement as a tile: earned reads as a filled card, locked as an
 * outline waiting to be filled in.
 *
 * `achievements` is the persisted `{ id: unlockedTs }` map.
 *
 * EVERY VISUAL VALUE HERE COMES FROM A TOKEN.
 * The version this replaces carried `fontSize: 30`, `fontSize: 9`,
 * `fontWeight: 600`, `opacity: 0.55` and `SHADOW.card` as literals — five
 * decisions this file had no business making on its own. Sizes are FONT_SIZE,
 * weight is FONT_WEIGHT, rhythm is LINE_HEIGHT, transparency is OPACITY, the
 * outline is BORDER, the fill is COLORS and the spacing is SPACE.
 *
 * WHY THE LOCKED STATE CHANGED
 * ----------------------------
 * It used to be `opacity: 0.55` plus `grayscale(1)` over the whole tile, which
 * dimmed the NAME as much as the icon. This app measures rendered contrast in
 * CI, and a locked badge is the thing telling a learner what to aim at — it
 * has to stay readable.
 *
 * So the transparency moved onto the ICON alone, which is decorative because
 * the badge's name and state are both spelled out beneath it, and the state is
 * carried by the BORDER instead: solid for earned, dashed for locked. The word
 * underneath is unchanged, so what a screen reader gets is what it always got
 * and the border is a second channel rather than the only one.
 *
 * The drop shadow is gone. SHADOW.card on every earned tile turned a grid of
 * fifteen into fifteen floating slabs; a hairline draws the same boundary flat.
 */
export default function BadgeGrid({ achievements }) {
  return (
    // A real list: fifteen sibling tiles are a list, and a screen reader that
    // announces "list, 15 items" says how much is here before a learner starts
    // arrowing through it.
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
              border: earned ? BORDER.panel : BORDER.panelDashed,
            }}
          >
            {/* The only thing that fades. Decorative: the name and the state
                are both written out below it. */}
            <span
              aria-hidden="true"
              style={{
                fontSize: FONT_SIZE['2xl'],
                lineHeight: LINE_HEIGHT.tight,
                opacity: earned ? 1 : OPACITY.dim,
              }}
            >
              {a.icon}
            </span>

            <span
              style={{
                minWidth: 0,
                fontFamily: FONTS.display,
                fontSize: FONT_SIZE.base,
                fontWeight: FONT_WEIGHT.semibold,
                lineHeight: LINE_HEIGHT.snug,
                // A real foreground token, never a faded ink: this is text, and
                // rendered contrast is audited.
                color: earned ? COLORS.ink : COLORS.mute,
                // A two-word badge name wraps inside a 104px tile rather than
                // widening it.
                overflowWrap: 'anywhere',
              }}
            >
              {a.name}
            </span>

            <span
              style={{
                minWidth: 0,
                fontFamily: FONTS.mono,
                fontSize: FONT_SIZE.label,
                // `caps` (0.2em) pushes FREIGESCHALTET past the inner width of
                // a 104px tile; `wide` keeps the mono label set without making
                // it the widest thing in the grid.
                letterSpacing: LETTER_SPACING.wide,
                lineHeight: LINE_HEIGHT.normal,
                textTransform: 'uppercase',
                color: COLORS.mute,
                overflowWrap: 'anywhere',
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
