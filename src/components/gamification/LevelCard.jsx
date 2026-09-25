import {
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  SPACE,
  RADIUS,
  SHADOW,
} from '../../lib/theme';

// Stats "Fortschritt" header card: level number, rank, XP-to-next bar, total XP,
// and the LEARNED figure (moved here from the app header).
export default function LevelCard({ lvl, totalXp, learnedCount }) {
  return (
    <div
      data-testid="level-card"
      style={{
        borderRadius: RADIUS.lg,
        boxShadow: SHADOW.card,
        background: COLORS.card,
        padding: SPACE[3],
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0, 1fr) auto',
        gap: SPACE[3],
        alignItems: 'center',
        minWidth: 0,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: FONTS.display,
            fontWeight: FONT_WEIGHT.black,
            fontSize: FONT_SIZE['4xl'],
            color: COLORS.ink,
            lineHeight: 1,
          }}
        >
          {lvl.level}
        </div>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: FONT_SIZE.tag,
            letterSpacing: LETTER_SPACING.caps,
            color: COLORS.mute,
          }}
        >
          LEVEL
        </div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: FONT_SIZE.lg,
            fontWeight: FONT_WEIGHT.bold,
            color: COLORS.ink,
            overflowWrap: 'anywhere',
          }}
        >
          {lvl.rankName}
        </div>
        <div
          data-testid="level-progress-track"
          style={{
            height: 6,
            borderRadius: RADIUS.pill,
            background: COLORS.paperDeep,
            overflow: 'hidden',
            margin: `${SPACE[2]}px 0`,
          }}
        >
          <div
            style={{
              width: `${Math.round(lvl.progress * 100)}%`,
              height: '100%',
              background: COLORS.green,
              transition: 'width 0.4s ease',
            }}
          />
        </div>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: FONT_SIZE.sm,
            color: COLORS.mute,
            overflowWrap: 'anywhere',
          }}
        >
          {lvl.xpIntoLevel} / {lvl.xpToNext} XP to next · {totalXp} XP total
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: FONTS.display,
            fontWeight: FONT_WEIGHT.bold,
            fontSize: FONT_SIZE['3xl'],
            color: COLORS.ink,
          }}
        >
          {learnedCount}
        </div>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: FONT_SIZE.tag,
            letterSpacing: LETTER_SPACING.caps,
            color: COLORS.mute,
          }}
        >
          LEARNED
        </div>
      </div>
    </div>
  );
}
