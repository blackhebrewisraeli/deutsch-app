import {
  COLORS,
  FONT_MONO,
  FONT_BODY,
  FONT_SIZE,
  LETTER_SPACING,
  SPACE,
  RADIUS,
  SHADOW,
} from '../../lib/theme';

// One-time first-visit banner explaining the exercise model. Dismissal is
// persisted by the parent (localStorage flag) via onDismiss.
export default function WelcomeBanner({ mobile, onDismiss }) {
  return (
    <div
      style={{
        borderRadius: RADIUS.lg,
        boxShadow: SHADOW.bar,
        background: COLORS.ink,
        color: COLORS.paper,
        padding: mobile ? SPACE[4] : SPACE[5],
        marginBottom: mobile ? SPACE[4] : SPACE[6],
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: SPACE[4],
        alignItems: 'center',
      }}
    >
      <div>
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: FONT_SIZE.tag,
            letterSpacing: LETTER_SPACING.caps,
            color: COLORS.gold,
            marginBottom: SPACE[2],
          }}
        >
          WILLKOMMEN
        </div>
        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: mobile ? FONT_SIZE.base : FONT_SIZE.md,
            lineHeight: 1.5,
          }}
        >
          Anna gives you a task each round — order a coffee, introduce yourself, ask for directions.
          Type or tap the mic, and she'll correct you in real time. Tabs{' '}
          <strong>02&ndash;04</strong> add alphabet drills, vocab cards, and translation exercises;{' '}
          <strong>05 Stats</strong> tracks what you've learned and surfaces what to review.
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        style={{
          background: 'transparent',
          border: `2px solid ${COLORS.paper}`,
          borderRadius: RADIUS.md,
          color: COLORS.paper,
          fontFamily: FONT_MONO,
          fontWeight: 700,
          fontSize: FONT_SIZE.tag,
          letterSpacing: LETTER_SPACING.widest,
          padding: `${SPACE[2]}px ${SPACE[4]}px`,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          alignSelf: mobile ? 'start' : 'center',
        }}
      >
        GOT IT →
      </button>
    </div>
  );
}
