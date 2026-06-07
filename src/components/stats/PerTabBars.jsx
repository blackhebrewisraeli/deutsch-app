import { COLORS, FONTS, FONT_SIZE, LETTER_SPACING, SPACE, RADIUS } from '../../lib/theme';
import { TABS } from '../../lib/stats';

const TAB_LABELS = {
  chat: '01 Chat',
  alphabet: '02 Alphabet',
  vocab: '03 Vocab',
  translate: '04 Translate',
};

// Section C — exercises-per-tab horizontal bars; the most-used tab is red.
export default function PerTabBars({ breakdown }) {
  const max = Math.max(...Object.values(breakdown), 1);
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);

  if (total === 0) {
    return (
      <div
        style={{
          fontFamily: FONTS.body,
          fontStyle: 'italic',
          color: COLORS.mute,
          fontSize: FONT_SIZE.base,
        }}
      >
        No exercises recorded yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[3] }}>
      {TABS.map((tab) => {
        const count = breakdown[tab];
        const pct = Math.round((count / max) * 100);
        return (
          <div key={tab}>
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
              <span style={{ letterSpacing: LETTER_SPACING.caps }}>{TAB_LABELS[tab]}</span>
              <span style={{ color: COLORS.mute }}>
                {count} ({total === 0 ? 0 : Math.round((count / total) * 100)}%)
              </span>
            </div>
            <div
              style={{
                height: 14,
                borderRadius: RADIUS.pill,
                background: COLORS.paperDeep,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: count === max ? COLORS.red : COLORS.ink,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
