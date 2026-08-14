import {
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  RADIUS,
  SHADOW,
} from '../../lib/theme';
import Confetti from '../ui/Confetti';

/**
 * @param {{ learnedCount: number, onDismiss: () => void }} props
 */
export default function DeckCompleteBanner({ learnedCount, onDismiss }) {
  return (
    <div
      className="slide-up pop"
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: `linear-gradient(90deg, ${COLORS.gold} 0%, ${COLORS.goldBright} 50%, ${COLORS.gold} 100%)`,
        backgroundSize: '200% auto',
        animation: 'shimmer 2s linear infinite',
        borderRadius: RADIUS.lg,
        boxShadow: SHADOW.card,
        padding: '16px 20px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Confetti />
      <span
        style={{
          fontFamily: FONTS.display,
          fontSize: FONT_SIZE.xl,
          fontWeight: FONT_WEIGHT.bold,
          color: COLORS.ink,
        }}
      >
        🎉 Deck complete — {learnedCount} words learned
      </span>
      <button
        type="button"
        onClick={onDismiss}
        style={{
          background: 'transparent',
          border: `1px solid ${COLORS.ink}`,
          borderRadius: RADIUS.sm,
          fontFamily: FONTS.mono,
          fontSize: FONT_SIZE.tag,
          letterSpacing: LETTER_SPACING.widest,
          padding: '4px 10px',
          cursor: 'pointer',
          color: COLORS.ink,
        }}
      >
        DISMISS
      </button>
    </div>
  );
}
