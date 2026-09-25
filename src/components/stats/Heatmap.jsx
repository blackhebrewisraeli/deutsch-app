import { COLORS, FONTS, FONT_SIZE, LETTER_SPACING, SPACE } from '../../lib/theme';

// Heatmap intensity palette (0 = no activity … 4 = 20+ exercises).
const INTENSITY_COLORS = [
  COLORS.paperDeep, // 0 — no activity
  COLORS.heat1, // 1 — 1–3 events  (gold + alpha, per mode)
  COLORS.heat2, // 2 — 4–9 events
  COLORS.gold, // 3 — 10–19 events
  COLORS.red, // 4 — 20+ events
];

// Section B — GitHub-style 12-month activity grid (7 rows, columns = weeks).
export default function Heatmap({ data, mobile }) {
  const cellSize = mobile ? 7 : 8;
  const gap = 1;
  // grid-auto-flow: column means each column (week) fills top to bottom.
  const weeks = Math.ceil(data.length / 7);

  return (
    <div
      data-testid="activity-heatmap"
      style={{
        display: 'grid',
        gridTemplateRows: `repeat(7, ${cellSize}px)`,
        gridAutoFlow: 'column',
        gridAutoColumns: `${cellSize}px`,
        gap,
        overflowX: 'auto',
        paddingBottom: SPACE[1],
        maxWidth: '100%',
      }}
    >
      {data.map((day) => (
        <div
          key={day.date}
          title={`${day.date} · ${day.total} exercise${day.total === 1 ? '' : 's'}`}
          style={{
            width: cellSize,
            height: cellSize,
            background: INTENSITY_COLORS[day.intensity],
            border: `1px solid ${COLORS.inkA20}`,
          }}
        />
      ))}
      {/* Pad the trailing column so the grid stays rectangular. */}
      {data.length < weeks * 7 &&
        Array.from({ length: weeks * 7 - data.length }).map((_, i) => (
          <div
            key={`pad-${i}`}
            style={{
              width: cellSize,
              height: cellSize,
              background: 'transparent',
            }}
          />
        ))}
    </div>
  );
}

export function HeatmapLegend() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE[2],
        marginTop: SPACE[2],
        fontFamily: FONTS.mono,
        fontSize: FONT_SIZE.tag,
        letterSpacing: LETTER_SPACING.caps,
        color: COLORS.mute,
      }}
    >
      <span>LESS</span>
      {INTENSITY_COLORS.map((c, i) => (
        <span
          key={i}
          style={{
            width: 7,
            height: 7,
            background: c,
            border: `1px solid ${COLORS.inkA20}`,
          }}
        />
      ))}
      <span>MORE</span>
    </div>
  );
}
