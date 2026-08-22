import { COLORS, FONTS, FONT_SIZE, LETTER_SPACING, SPACE } from '../../lib/theme';
import { LEVEL_MODES } from '../../lib/levelPref';

// The "A1 — WORD TILES · Exercise 3 / 10" header above each exercise.
export default function ExerciseHeader({ level, idx, total }) {
  // Derived from LEVEL_MODES rather than a second copy of the same three
  // strings — the level switchers caption the mode too, and the two must
  // agree. (This is why B1 now reads FREE TYPING, not FREE TRANSLATION.)
  const mode = LEVEL_MODES[level];
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
        {mode ? `${level.toUpperCase()} — ${mode.label.toUpperCase()}` : ''}
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
