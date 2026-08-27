import { useState } from 'react';
import { COLORS, BORDER, RADIUS, SHADOW, SPACE } from '../../lib/theme';

const PLANE = {
  0: COLORS.paperDeep,
  1: COLORS.surface,
  2: COLORS.surfaceElevated,
};

/**
 * A card the user can activate: a deck tile, a league row, a scenario entry.
 *
 * It renders a native <button> or <a href>. There is no third option and `as`
 * accepts nothing else — that is the whole point. Fourteen league rows shipped
 * as `<li onClick>`: dead to Tab, invisible to a screen reader as controls, and
 * green across a 1,600-test suite, because nothing about a click handler on a
 * list item is detectable from the DOM assertions those tests were making.
 *
 * `role="button"` + tabIndex + onKeyDown is the wrong repair: it hand-rolls
 * Enter/Space activation, the disabled state, form participation and the focus
 * ring the native element already has.
 *
 * A list of these keeps its semantics: a <ul> with <li> wrappers, each <li>
 * containing one card. The <li> is the list item; the card is the control.
 */
export default function InteractiveCard({
  as = 'button',
  selected = false,
  disabled = false,
  elevation = 1,
  href,
  style,
  children,
  ...rest
}) {
  const [pressed, setPressed] = useState(false);
  const isLink = as === 'a';
  const Tag = isLink ? 'a' : 'button';

  // Mirrors Button's press feel so the whole app sinks the same way.
  const pressStyle =
    pressed && !disabled
      ? { transform: 'translateY(3px)', boxShadow: `0 1px 0 ${COLORS.lip}` }
      : null;

  // Selection is never signalled by colour alone (WCAG 1.4.1). The border
  // weight change is the non-colour channel.
  const edge = selected ? `1px solid ${COLORS.borderStrong}` : BORDER.panel;

  const semantics = isLink
    ? {
        // No disabled attribute exists for links, so the href has to go —
        // otherwise a "disabled" link is still navigable.
        href: disabled ? undefined : href,
        'aria-disabled': disabled || undefined,
        'aria-current': selected || undefined,
      }
    : {
        type: 'button',
        disabled,
        'aria-pressed': selected || undefined,
      };

  return (
    <Tag
      data-ui="button"
      // Full-bleed inside a list: an outset ring is clipped by the container
      // edge and overlaps the neighbouring row.
      data-focus-inset=""
      {...semantics}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        background: PLANE[elevation] ?? PLANE[1],
        border: edge,
        boxShadow: SHADOW.press(COLORS.lip),
        borderRadius: RADIUS.xl,
        padding: SPACE[4],
        color: COLORS.ink,
        // A <button> centres its content and inherits none of the page font.
        textAlign: 'left',
        font: 'inherit',
        width: '100%',
        display: 'block',
        textDecoration: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...(disabled ? { opacity: 0.45 } : null),
        ...pressStyle,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
