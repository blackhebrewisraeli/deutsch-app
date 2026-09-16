import { useEffect } from 'react';
import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, RADIUS, SHADOW, SPACE } from '../../lib/theme';

// One auto-dismissing toast. `onDone` is called after the lifetime elapses, or
// immediately when the learner dismisses it.
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
      {/* Decoration beside a text title — announcing it would read the toast
          twice over. */}
      <span aria-hidden="true" style={{ fontSize: 26 }}>
        {icon}
      </span>
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
          <div style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag, color: COLORS.paper }}>
            {sub}
          </div>
        )}
      </div>
      {/* Named with the toast's own title so stacked toasts do not present a
          row of identical "Dismiss" buttons. */}
      <button
        type="button"
        // The toast plane is COLORS.ink, which is also the default focus ring.
        // data-focus-on-dark paints the ring in currentColor — paper here, the
        // paired ink this plane already uses for its text. Same attribute the
        // masthead Sign-in control carries; the global sheet is the one recipe.
        data-ui="button"
        data-focus-on-dark=""
        aria-label={title ? `Dismiss ${title}` : 'Dismiss notification'}
        onClick={onDone}
        style={{
          marginLeft: 'auto',
          flexShrink: 0,
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          borderRadius: RADIUS.pill,
          // Inherits the plane's paired ink, so it can never drift from the
          // title it sits beside — and so the dark-plane ring tracks it.
          color: 'currentColor',
          fontSize: FONT_SIZE.xl,
          lineHeight: 1,
          cursor: 'pointer',
          padding: 0,
        }}
      >
        {/* The button's accessible name comes from aria-label; this glyph is
            purely visual. */}
        <span aria-hidden="true">×</span>
      </button>
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
        // None here so the stack never blocks the page beneath it; each toast
        // re-enables them, which is what makes the close button clickable.
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
