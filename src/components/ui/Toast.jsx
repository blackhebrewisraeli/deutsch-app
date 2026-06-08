import { useEffect } from 'react';
import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, RADIUS, SHADOW, SPACE } from '../../lib/theme';

// One auto-dismissing toast. `onDone` is called after the lifetime elapses.
export function Toast({ icon, title, sub, onDone, ttl = 3200 }) {
  useEffect(() => {
    const t = setTimeout(onDone, ttl);
    return () => clearTimeout(t);
  }, [onDone, ttl]);

  return (
    <div
      className="slide-up"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE[3],
        background: COLORS.ink,
        color: COLORS.paper,
        borderRadius: RADIUS.lg,
        boxShadow: SHADOW.bar,
        padding: `${SPACE[3]}px ${SPACE[5]}px`,
        minWidth: 240,
        pointerEvents: 'auto',
      }}
    >
      <span style={{ fontSize: 26 }}>{icon}</span>
      <div>
        <div
          style={{
            fontFamily: FONTS.display,
            fontWeight: FONT_WEIGHT.bold,
            fontSize: FONT_SIZE.lg,
          }}
        >
          {title}
        </div>
        {sub && (
          <div style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag, color: COLORS.gold }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

// Fixed stack of toasts near the top-center. `toasts` = [{id, icon, title, sub}].
export default function ToastStack({ toasts, onDismiss }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <Toast
          key={t.id}
          icon={t.icon}
          title={t.title}
          sub={t.sub}
          onDone={() => onDismiss(t.id)}
        />
      ))}
    </div>
  );
}
