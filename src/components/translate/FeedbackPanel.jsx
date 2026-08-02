import { ArrowRight } from 'lucide-react';
import {
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  SPACE,
  RADIUS,
  SHADOW,
  BUTTON,
} from '../../lib/theme';

// Three-way result panel shown after an answer: correct (gold) / almost
// (paperDeep) / wrong (red). Shows the canonical answer when not fully correct.
// xp + mult: when provided and verdict is correct/almost, shows a +N XP ×M🔥
// flourish (mult badge omitted when mult === 1).
export default function FeedbackPanel({ verdict, correctText, note, xp, mult, onNext }) {
  const isCorrect = verdict === 'correct';
  const isAlmost = verdict === 'almost';
  const bg = isCorrect ? COLORS.gold : isAlmost ? COLORS.paperDeep : COLORS.red;
  // Gold fill needs accentOn; mode-flipping ink fails on gold in dark mode.
  const fg = isCorrect ? COLORS.accentOn : isAlmost ? COLORS.ink : COLORS.paper;
  const label = isCorrect ? '✓ CORRECT' : isAlmost ? '≈ ALMOST' : '✗ NOT QUITE';
  const showCorrectText = !isCorrect && correctText;
  const showFlourish = (isCorrect || isAlmost) && xp > 0;
  return (
    <div
      className={verdict === 'wrong' ? 'wiggle' : 'pop'}
      style={{
        borderRadius: RADIUS.lg,
        boxShadow: SHADOW.card,
        background: bg,
        color: fg,
        padding: SPACE[5],
        marginTop: SPACE[4],
      }}
    >
      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: FONT_SIZE.tag,
          letterSpacing: LETTER_SPACING.caps,
          marginBottom: SPACE[2],
        }}
      >
        {label}
      </div>
      {showFlourish && (
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: FONT_SIZE.sm,
            fontWeight: FONT_WEIGHT.bold,
            opacity: 0.8,
            marginBottom: SPACE[2],
          }}
        >
          +{xp} XP{mult > 1 ? ` ×${mult}🔥` : ''}
        </div>
      )}
      {showCorrectText && (
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: FONT_SIZE.xl,
            fontWeight: FONT_WEIGHT.semibold,
            marginBottom: SPACE[2],
          }}
        >
          {correctText}
        </div>
      )}
      {note && (
        <div
          style={{
            fontFamily: FONTS.body,
            fontStyle: 'italic',
            fontSize: FONT_SIZE.base,
            opacity: 0.85,
            marginBottom: SPACE[4],
          }}
        >
          {note}
        </div>
      )}
      <button
        type="button"
        onClick={onNext}
        aria-label="Next exercise"
        style={{
          ...BUTTON.primary,
          background: isCorrect ? COLORS.accentOn : COLORS.paper,
          color: isCorrect ? COLORS.gold : COLORS.ink,
        }}
      >
        NEXT EXERCISE <ArrowRight size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
