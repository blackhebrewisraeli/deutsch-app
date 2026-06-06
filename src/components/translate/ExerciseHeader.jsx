import { COLORS, FONTS, FONT_SIZE, LETTER_SPACING, SPACE } from '../../lib/theme';

// The "A1 — WORD TILES · Exercise 3 / 10" header above each exercise.
export default function ExerciseHeader({ level, idx, total }) {
  const labels = { a1: 'A1 — WORD TILES', a2: 'A2 — FILL THE BLANKS', b1: 'B1 — FREE TRANSLATION' };
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACE[4],
      }}
    >
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: FONT_SIZE.tag,
          letterSpacing: LETTER_SPACING.caps,
          color: COLORS.red,
          textTransform: 'uppercase',
        }}
      >
        {labels[level]}
      </span>
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: FONT_SIZE.tag,
          letterSpacing: LETTER_SPACING.wider,
          color: COLORS.mute,
        }}
      >
        Exercise {idx + 1} / {total}
      </span>
    </div>
  );
}
