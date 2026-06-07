import { COLORS, FONTS, FONT_SIZE, LETTER_SPACING, SPACE, RADIUS } from '../../lib/theme';
import { LEVELS } from '../../lib/stats';

const LEVEL_LABELS = { a1: 'A1', a2: 'A2', b1: 'B1' };

// Section D — three-way stacked accuracy bar (correct / almost / wrong) per CEFR level.
export default function AccuracyByLevel({ byLevel }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[4] }}>
      {LEVELS.map((level) => {
        const { correct, almost, wrong } = byLevel[level];
        const total = correct + almost + wrong;
        const pct = (n) => (total === 0 ? 0 : (n / total) * 100);
        return (
          <div key={level}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: SPACE[1],
                fontFamily: FONTS.mono,
                fontSize: FONT_SIZE.sm,
                color: COLORS.ink,
              }}
            >
              <span style={{ letterSpacing: LETTER_SPACING.caps }}>{LEVEL_LABELS[level]}</span>
              <span style={{ color: COLORS.mute }}>
                {total === 0
                  ? 'no data'
                  : `${correct + almost} of ${total} (${Math.round(pct(correct + almost))}%)`}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                height: 14,
                borderRadius: RADIUS.pill,
                background: COLORS.paperDeep,
                overflow: 'hidden',
              }}
            >
              {total === 0 ? null : (
                <>
                  {correct > 0 && (
                    <div style={{ width: `${pct(correct)}%`, background: COLORS.gold }} />
                  )}
                  {almost > 0 && (
                    <div style={{ width: `${pct(almost)}%`, background: COLORS.paperDeep }} />
                  )}
                  {wrong > 0 && <div style={{ width: `${pct(wrong)}%`, background: COLORS.red }} />}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
