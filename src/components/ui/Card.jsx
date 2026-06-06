import { CARD } from '../../lib/theme';

// Rounded, soft-shadow card. Spread CARD[variant] then allow per-use overrides.
export default function Card({ variant = 'base', style, children, ...rest }) {
  return (
    <div style={{ ...(CARD[variant] ?? CARD.base), ...style }} {...rest}>
      {children}
    </div>
  );
}
