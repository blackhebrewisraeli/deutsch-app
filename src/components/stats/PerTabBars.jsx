import { BarChart3 } from 'lucide-react';
import { COLORS, FONTS, FONT_SIZE, LETTER_SPACING, SPACE, RADIUS } from '../../lib/theme';
import { TABS } from '../../lib/stats';
import StatusNote from '../ui/StatusNote';

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
      <StatusNote icon={BarChart3} style={{ padding: SPACE[3], gap: SPACE[2] }}>
        No exercises recorded yet.
      </StatusNote>
    );
  }

  return (
    <div
      data-testid="per-tab-bars"
      style={{ display: 'flex', flexDirection: 'column', gap: SPACE[2] }}
    >
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
                fontSize: FONT_SIZE.tag,
                color: COLORS.ink,
              }}
            >
              <span style={{ letterSpacing: LETTER_SPACING.caps }}>{TAB_LABELS[tab]}</span>
              <span style={{ color: COLORS.mute }}>
                {count} ({total === 0 ? 0 : Math.round((count / total) * 100)}%)
              </span>
            </div>
            <div
              data-testid="per-tab-track"
              style={{
                height: 6,
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
