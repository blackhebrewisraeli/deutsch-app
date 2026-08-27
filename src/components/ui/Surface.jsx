import { COLORS, BORDER, RADIUS, SHADOW, SPACE } from '../../lib/theme';

// The elevation ramp: ground → surface-1 → surface-2 → surface-3.
//
// CARD.dark and CARD.alert are deliberately NOT elevations 3 and 4. They are
// inverted planes carrying their own paired ink, and numbering them into this
// ramp would imply they sit higher in the same stack — which is how a card ends
// up with unreadable body text.
const PLANE = {
  0: COLORS.paperDeep,
  1: COLORS.surface,
  2: COLORS.surfaceElevated,
};

/**
 * Non-interactive container.
 *
 * There is no `onClick`, on purpose. A clickable surface is InteractiveCard,
 * which guarantees a native button or link — fourteen league rows once shipped
 * as `<li onClick>`, unreachable by Tab and invisible to a screen reader as
 * controls, and stayed that way through a green 1,600-test suite.
 */
export default function Surface({
  elevation = 1,
  padding = 4,
  radius = 'xl',
  as: Tag = 'div',
  style,
  children,
  ...rest
}) {
  return (
    <Tag
      style={{
        background: PLANE[elevation] ?? PLANE[1],
        // Both, always. SHADOW.card is a fixed light-mode rgba that all but
        // disappears on a dark plane; the hairline is what separates the card
        // from its ground there. The redundancy is the point — do not "clean
        // it up".
        border: BORDER.panel,
        boxShadow: SHADOW.card,
        borderRadius: RADIUS[radius] ?? RADIUS.xl,
        padding: SPACE[padding] ?? 0,
        color: COLORS.ink,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
