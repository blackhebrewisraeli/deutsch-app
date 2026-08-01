import {
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  SPACE,
  RADIUS,
} from '../../lib/theme';

// A row of equal-width pill buttons where exactly one is active — the Daily-goal
// presets, the Appearance mode and the Day/Night tone all render this. Extracted
// because the second copy was verbatim and a third was about to land; three
// copies of a button's styling is three places to miss when the redesign lands.
//
// `options` is [{ key, label, detail? }]. `detail` renders as a second line
// (the goal picker's "50 XP"); omit it for a label-only button.
export default function SegmentedPicker({ options, activeKey, onPick, ariaLabel }) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{
        display: 'grid',
        // minmax(0, 1fr), never a bare 1fr — see AGENTS.md. A bare track keeps
        // min-width:auto and pushes the page wider than the viewport.
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
        gap: SPACE[3],
      }}
    >
      {options.map((o) => {
        const active = o.key === activeKey;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onPick(o)}
            aria-pressed={active}
            style={{
              border: 'none',
              borderRadius: RADIUS.md,
              boxShadow: `0 4px 0 ${active ? COLORS.greenDeep : COLORS.lip}`,
              background: active ? COLORS.green : COLORS.card,
              color: active ? COLORS.paper : COLORS.ink,
              padding: SPACE[4],
              cursor: 'pointer',
              fontFamily: FONTS.mono,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontWeight: FONT_WEIGHT.bold,
                letterSpacing: LETTER_SPACING.widest,
                fontSize: FONT_SIZE.sm,
              }}
            >
              {o.label.toUpperCase()}
            </div>
            {o.detail != null && (
              <div
                style={{
                  fontFamily: FONTS.display,
                  fontSize: FONT_SIZE.xl,
                  fontWeight: FONT_WEIGHT.bold,
                }}
              >
                {o.detail}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
