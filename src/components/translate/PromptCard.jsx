import {
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  SPACE,
  BORDER,
} from '../../lib/theme';

// The English sentence the learner must translate to German.
export default function PromptCard({ text }) {
  return (
    <div
      style={{
        border: BORDER.standard,
        background: COLORS.paper,
        padding: `${SPACE[5]}px ${SPACE[6]}px`,
        marginBottom: SPACE[4],
      }}
    >
      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: FONT_SIZE.tag,
          letterSpacing: LETTER_SPACING.caps,
          color: COLORS.mute,
          marginBottom: SPACE[2],
        }}
      >
        TRANSLATE TO GERMAN
      </div>
      <div
        style={{
          fontFamily: FONTS.display,
          fontSize: FONT_SIZE['2xl'],
          fontWeight: FONT_WEIGHT.semibold,
          lineHeight: 1.3,
        }}
      >
        {text}
      </div>
    </div>
  );
}
