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
export default function FeedbackPanel({ verdict, correctText, note, onNext }) {
  const isCorrect = verdict === 'correct';
  const isAlmost = verdict === 'almost';
  const bg = isCorrect ? COLORS.gold : isAlmost ? COLORS.paperDeep : COLORS.red;
  const fg = isCorrect || isAlmost ? COLORS.ink : COLORS.paper;
  const label = isCorrect ? '✓ CORRECT' : isAlmost ? '≈ ALMOST' : '✗ NOT QUITE';
  // Show the canonical answer when not fully correct (almost or wrong both
  // benefit from seeing the intended translation).
  const showCorrectText = !isCorrect && correctText;
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
          background: isCorrect ? COLORS.ink : COLORS.paper,
          color: isCorrect ? COLORS.paper : COLORS.ink,
        }}
      >
        NEXT EXERCISE <ArrowRight size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
