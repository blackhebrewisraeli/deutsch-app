import { COLORS, FONT_DISPLAY, FONT_MONO } from '../../lib/theme';
import { SCENARIOS } from '../../data/content';
import { SectionLabel } from '../UI';

// Section A — the scenario list (Free Chat / Coffee / Meet / Airport).
// Horizontal scroller on mobile, vertical list on desktop.
export default function ScenarioPicker({ scenario, setScenario, mobile }) {
  return (
    <>
      <SectionLabel num="A" text="Scenario" />
      <div
        style={{
          display: 'flex',
          flexDirection: mobile ? 'row' : 'column',
          gap: 0,
          border: `2px solid ${COLORS.ink}`,
          overflowX: mobile ? 'auto' : 'visible',
        }}
      >
        {SCENARIOS.map((s) => {
          const active = scenario === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setScenario(s.id)}
              style={{
                padding: mobile ? '10px 14px' : 16,
                background: active ? COLORS.ink : COLORS.paper,
                color: active ? COLORS.paper : COLORS.ink,
                border: 'none',
                borderBottom: mobile ? 'none' : `2px solid ${COLORS.ink}`,
                borderRight: mobile ? `2px solid ${COLORS.ink}` : 'none',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: mobile ? 8 : 14,
                transition: 'all 0.15s',
                flexShrink: mobile ? 0 : 1,
                whiteSpace: mobile ? 'nowrap' : 'normal',
              }}
            >
              <span style={{ fontSize: mobile ? 16 : 20 }}>{s.icon}</span>
              <div>
                <div
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontWeight: 600,
                    fontSize: mobile ? 14 : 16,
                  }}
                >
                  {s.name}
                </div>
                {!mobile && (
                  <div
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: 9,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      opacity: 0.7,
                    }}
                  >
                    {s.desc}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
