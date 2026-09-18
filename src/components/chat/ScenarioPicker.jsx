import {
  COLORS,
  FONT_DISPLAY,
  FONT_MONO,
  FONT_SIZE,
  LETTER_SPACING,
  RADIUS,
  SPACE,
} from '../../lib/theme';
import { activePack } from '../../packs';
const { scenarios: SCENARIOS } = activePack.content;

// Scenario list (Free Chat / Coffee / Meet / Airport).
// Horizontal scroller on mobile, vertical list on desktop.
export default function ScenarioPicker({
  scenario,
  setScenario,
  mobile,
  level,
  scenarios = SCENARIOS,
}) {
  const heading = level ? `Scenario · ${String(level).toUpperCase()}` : 'Scenario';
  return (
    <>
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: FONT_SIZE.tag,
          letterSpacing: LETTER_SPACING.caps,
          textTransform: 'uppercase',
          color: COLORS.mute,
          marginBottom: SPACE[3],
        }}
      >
        {heading}
      </div>
      <div
        role="radiogroup"
        aria-label="Choose chat scenario"
        style={{
          display: 'flex',
          flexDirection: mobile ? 'row' : 'column',
          gap: 0,
          borderRadius: RADIUS.lg,
          border: `1px solid ${COLORS.border}`,
          overflow: 'hidden',
          overflowX: mobile ? 'auto' : 'visible',
          background: COLORS.surface,
        }}
      >
        {scenarios.map((s) => {
          const active = scenario === s.id;
          return (
            <button
              key={s.id}
              type="button"
              data-ui="button"
              data-focus-inset=""
              data-focus-on-dark={active ? '' : undefined}
              onClick={() => setScenario(s.id)}
              role="radio"
              aria-checked={active}
              aria-label={`${s.name} scenario`}
              style={{
                padding: mobile ? '10px 14px' : '12px 14px',
                background: active ? COLORS.ink : COLORS.surface,
                color: active ? COLORS.paper : COLORS.ink,
                border: 'none',
                borderBottom: mobile ? 'none' : `1px solid ${COLORS.inkA12}`,
                borderRight: mobile ? `1px solid ${COLORS.inkA12}` : 'none',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: mobile ? 8 : 10,
                transition: 'all 0.15s',
                flexShrink: mobile ? 0 : 1,
                whiteSpace: mobile ? 'nowrap' : 'normal',
                minWidth: 0,
              }}
            >
              <span style={{ fontSize: mobile ? 16 : 18 }}>{s.icon}</span>
              <div
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 600,
                  fontSize: mobile ? 14 : 15,
                  minWidth: 0,
                }}
              >
                {s.name}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
