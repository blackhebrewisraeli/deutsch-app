import { useMemo } from 'react';
import { COLORS } from '../../lib/theme';

const PIECE_COLORS = [COLORS.red, COLORS.gold, COLORS.green, COLORS.ink];

// Dependency-free celebration burst. Mount it (conditionally, from the parent)
// to play once; absolutely positioned, fills its nearest positioned ancestor.
// Relies on the `confetti` keyframe defined in App.jsx.
export default function Confetti({ count = 28 }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        bg: PIECE_COLORS[i % PIECE_COLORS.length],
        delay: Math.random() * 0.15,
        dx: (Math.random() - 0.5) * 240,
        rot: Math.random() * 720 - 360,
        dur: 0.9 + Math.random() * 0.6,
      })),
    [count]
  );

  return (
    <div
      aria-hidden="true"
      className="confetti-layer"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            position: 'absolute',
            top: '38%',
            left: `${p.left}%`,
            width: 8,
            height: 8,
            background: p.bg,
            borderRadius: 2,
            '--dx': `${p.dx}px`,
            '--rot': `${p.rot}deg`,
            animation: `confetti ${p.dur}s ${p.delay}s ease-out forwards`,
          }}
        />
      ))}
    </div>
  );
}
