import { GOAL_PRESETS } from '../../lib/gamification';
import {
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  SPACE,
  RADIUS,
} from '../../lib/theme';

const OPTIONS = [
  { key: 'casual', label: 'Casual', xp: GOAL_PRESETS.casual },
  { key: 'regular', label: 'Regular', xp: GOAL_PRESETS.regular },
  { key: 'serious', label: 'Serious', xp: GOAL_PRESETS.serious },
];

// Daily-goal preset picker. Selecting calls onPick(xpValue).
export default function GoalPicker({ goal, onPick }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: SPACE[3] }}>
      {OPTIONS.map((o) => {
        const active = goal === o.xp;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onPick(o.xp)}
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
            <div
              style={{
                fontFamily: FONTS.display,
                fontSize: FONT_SIZE.xl,
                fontWeight: FONT_WEIGHT.bold,
              }}
            >
              {o.xp} XP
            </div>
          </button>
        );
      })}
    </div>
  );
}
