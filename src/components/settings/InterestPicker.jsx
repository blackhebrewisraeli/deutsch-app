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
import { toggleInterest } from '../../lib/interests';

/**
 * Multi-select topic toggles. Pack supplies labels/icons; this component
 * only flips ids through `toggleInterest`.
 */
export default function InterestPicker({ topics = [], enabled = [], onChange }) {
  return (
    <div
      role="group"
      aria-label="Interest topics"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.max(topics.length, 1)}, minmax(0, 1fr))`,
        gap: SPACE[3],
      }}
    >
      {topics.map((topic) => {
        const active = enabled.includes(topic.id);
        return (
          <button
            key={topic.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange?.(toggleInterest(topic.id, enabled, topics))}
            style={{
              border: 'none',
              borderRadius: RADIUS.md,
              boxShadow: SHADOW.press(active ? COLORS.greenDeep : COLORS.lip),
              background: active ? COLORS.green : COLORS.card,
              color: active ? COLORS.paper : COLORS.ink,
              padding: SPACE[4],
              cursor: 'pointer',
              fontFamily: FONTS.mono,
              textAlign: 'center',
              minWidth: 0,
            }}
          >
            <div style={{ fontSize: FONT_SIZE.lg, marginBottom: SPACE[1] }} aria-hidden="true">
              {topic.icon}
            </div>
            <div
              style={{
                fontWeight: FONT_WEIGHT.bold,
                letterSpacing: LETTER_SPACING.widest,
                fontSize: FONT_SIZE.sm,
                textTransform: 'uppercase',
                overflowWrap: 'anywhere',
              }}
            >
              {topic.label}
            </div>
          </button>
        );
      })}
    </div>
  );
}
