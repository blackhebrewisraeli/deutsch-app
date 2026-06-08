import { COLORS } from '../../lib/theme';

// Daily-goal ring: red ring fills to `pct` (0–1); turns green with a ✓ when met.
export default function GoalRing({ pct, met, size = 48 }) {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, pct));
  const color = met ? COLORS.green : COLORS.red;
  return (
    <div
      title={met ? 'Daily goal reached!' : `Daily goal · ${Math.round(clamped * 100)}%`}
      style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e7dcae" strokeWidth="5" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
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
          fontSize: size * 0.34,
        }}
      >
        {met ? '✓' : '🎯'}
      </div>
    </div>
  );
}
