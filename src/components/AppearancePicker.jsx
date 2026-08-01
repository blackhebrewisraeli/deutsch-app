import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, SPACE, RADIUS } from '../lib/theme';

const OPTIONS = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

// Appearance mode picker — same three-button row pattern as GoalPicker.
export default function AppearancePicker({ mode, onPick }) {
  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: SPACE[3] }}
    >
      {OPTIONS.map((o) => {
        const active = mode === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onPick(o.key)}
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
          </button>
        );
      })}
    </div>
  );
}
