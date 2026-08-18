import { COLORS, FONTS, FONT_WEIGHT } from '../../lib/theme';

// Circle showing the level number, wrapped by an SVG XP ring (green) that fills
// to `progress` (0–1) toward the next level. `rank` shown via title on hover.
export default function LevelBadge({ level, progress, rank, size = 52 }) {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <div
      title={rank ? `${rank} · Level ${level}` : `Level ${level}`}
      style={{
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
        // Its own plane. The ring colours (success, track, error) are audited
        // against `surface`, not against the masthead's charcoal, where the
        // filled arc falls to 2.2:1 in light.night. Sitting the control on its
        // own disc keeps every existing pairing valid instead of needing a
        // mode-independent copy of each ring colour.
        background: COLORS.surface,
        borderRadius: '50%',
      }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={COLORS.track}
          strokeWidth="5"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={COLORS.green}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: FONTS.display,
          fontWeight: FONT_WEIGHT.black,
          fontSize: size * 0.36,
          color: COLORS.ink,
        }}
      >
        {level}
      </div>
    </div>
  );
}
