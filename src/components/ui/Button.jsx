import { useState } from 'react';
import { BUTTON } from '../../lib/theme';

// Chunky 3D-press button. Reads resting styles from BUTTON[variant] and adds
// the press interaction (translateY + lip-shrink) on pointer-down — inline
// styles can't express :active, so we track it in state.
export default function Button({
  variant = 'primary',
  style,
  children,
  onClick,
  disabled = false,
  type = 'button',
  ...rest
}) {
  const [pressed, setPressed] = useState(false);
  const base = BUTTON[variant] ?? BUTTON.primary;

  // Shrink the 4px lip to 1px and sink the button 3px while pressed.
  const pressStyle =
    pressed && !disabled && typeof base.boxShadow === 'string'
      ? { transform: 'translateY(3px)', boxShadow: base.boxShadow.replace('0 4px 0', '0 1px 0') }
      : null;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        ...base,
        ...(disabled ? { opacity: 0.45, cursor: 'not-allowed' } : null),
        ...style,
        ...pressStyle,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
