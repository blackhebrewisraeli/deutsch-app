import { useState } from 'react';
import { BUTTON, RADIUS } from '../../lib/theme';

// Square sizes for the icon variant. Everything else takes its size from the
// btnBase padding in theme.js.
const ICON_SIZE = { md: 32, sm: 28 };

/**
 * Chunky 3D-press button. Reads its resting styles from BUTTON[variant] and adds
 * the states inline styles cannot express.
 *
 * Division of labour, so it stays predictable:
 *   - resting appearance ....... inline, from BUTTON[variant]
 *   - :hover and :focus-visible  the global sheet (injectGlobalStyles), matched
 *                                on the data-ui / data-variant attributes below
 *   - :active .................. React state, because pointer-down needs a
 *                                boxShadow rewrite the sheet cannot express
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  style,
  children,
  onClick,
  disabled = false,
  busy = false,
  type = 'button',
  ...rest
}) {
  const [pressed, setPressed] = useState(false);
  const base = BUTTON[variant] ?? BUTTON.primary;
  const inert = disabled || busy;

  // An icon-only button with no accessible name is an unnamed control. A warning
  // rather than a throw: crashing a production screen over a missing label makes
  // the a11y defect worse, not better. The paired test is what actually stops
  // one landing.
  if (variant === 'icon' && !rest['aria-label'] && !rest['aria-labelledby']) {
    console.error('Button: variant="icon" needs an aria-label — an icon-only button has no name.');
  }

  // Shrink the 4px lip to 1px and sink the button 3px while pressed.
  const pressStyle =
    pressed && !inert && typeof base.boxShadow === 'string'
      ? { transform: 'translateY(3px)', boxShadow: base.boxShadow.replace('0 4px 0', '0 1px 0') }
      : null;

  const square = ICON_SIZE[size] ?? ICON_SIZE.md;
  const squared = variant === 'icon' ? { width: square, height: square } : null;

  return (
    <button
      type={type}
      // The two attributes the global stylesheet matches on. A primitive opts
      // into the app's one focus ring by carrying data-ui.
      data-ui="button"
      data-variant={variant}
      // busy does NOT set `disabled`. A disabled element leaves the tab order,
      // so a button that disables itself at the moment it is activated takes
      // the user's focus position with it and drops them at <body>. Guarding
      // onClick keeps the button focusable and the keyboard context intact.
      aria-busy={busy || undefined}
      disabled={disabled}
      onClick={busy ? undefined : onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        ...base,
        ...squared,
        // Anchors the busy spinner. Harmless when not busy.
        position: 'relative',
        ...(disabled ? { opacity: 0.45, cursor: 'not-allowed' } : null),
        ...(busy && !disabled ? { cursor: 'progress' } : null),
        // Merge order is the contract: state styles, THEN the caller's style.
        // The old order put `style` before pressStyle, so a caller override
        // silently lost the moment the button was pressed.
        ...pressStyle,
        ...style,
      }}
      {...rest}
    >
      {/* The label stays rendered and only fades. Swapping it out would let the
          button narrow mid-press, which moves every control beside it. */}
      <span style={busy ? { opacity: 0.25 } : undefined}>{children}</span>
      {busy && (
        <span
          data-ui="spinner"
          aria-hidden="true"
          className="ui-spinner"
          style={{
            position: 'absolute',
            // currentColor, so the spinner is whatever ink this variant already
            // uses — no per-variant spinner colour, and nothing to keep in
            // contrast.
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: RADIUS.pill,
            width: 14,
            height: 14,
          }}
        />
      )}
    </button>
  );
}
