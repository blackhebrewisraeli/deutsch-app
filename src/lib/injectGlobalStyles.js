import { FOCUS } from './theme';

/**
 * App-wide base styles + keyframes formerly injected by App.jsx <style>.
 * Uses CSS custom properties so scrollbar / pulse colours follow the theme.
 */
export function injectGlobalStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('deutsch-global-styles')) return;

  const style = document.createElement('style');
  style.id = 'deutsch-global-styles';
  style.textContent = `
    * { box-sizing: border-box; }
    body { margin: 0; }
    button { font-family: inherit; cursor: pointer; }
    /* One focus ring for the whole app. Any element with a [data-ui] attribute
       gets it — that is how a primitive opts in. :focus-visible, not :focus, so
       a mouse click does not ring. This replaced three hand-rolled recipes that
       had drifted to three different spellings, and gave the ~78 raw <button>
       elements a ring they never had. */
    [data-ui]:focus-visible {
      outline: ${FOCUS.ring};
      outline-offset: ${FOCUS.offset}px;
    }
    /* Full-bleed rows and cards: an outset ring is clipped by the container. */
    [data-ui][data-focus-inset]:focus-visible { outline-offset: ${FOCUS.inset}px; }
    /* Hover is gated on a fine pointer: a touch device latches the hover style
       on tap and keeps it until the next tap elsewhere. brightness() rather than
       a hover token per variant — seven variants x two modes is fourteen palette
       entries to keep in contrast, to express "slightly lighter". A relative
       filter cannot drift out of contrast, because it moves plane and ink
       together. */
    @media (hover: hover) and (pointer: fine) {
      [data-ui="button"]:not([disabled]):not([aria-busy="true"]):hover { filter: brightness(1.04); }
    }
    /* Full-height entry screens (welcome gate, level splash). 100vh on iOS
       Safari means the viewport WITHOUT the URL bar, so a 100vh element is
       taller than what you can actually see and its bottom sits behind the
       browser chrome — verified on a real iPhone, where the splash's gold
       stripe was cut off. 100dvh is the visible height and tracks the bar as
       it hides and shows. The 100vh line stays first as the fallback for
       engines without dvh; both declarations are needed, which is why this is
       a class and not an inline style. */
    .entry-screen { min-height: 100vh; min-height: 100dvh; }
    /* Keep the last stripe's content clear of the home indicator. */
    .entry-screen-foot { padding-bottom: env(safe-area-inset-bottom, 0px); }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: var(--c-surface-alt); }
    ::-webkit-scrollbar-thumb { background: var(--c-fg); border: 2px solid var(--c-surface-alt); }
    @keyframes blink      { 0%, 60% { opacity: 1; } 61%, 100% { opacity: 0; } }
    @keyframes pulse-red  { 0%, 100% { box-shadow: 0 0 0 0 var(--c-error-a80); } 50% { box-shadow: 0 0 0 12px var(--c-error-a00); } }
    @keyframes slide-up   { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes bounce     { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.18); } }
    @keyframes pulse-gold { 0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--c-accent) 70%, transparent); } 50% { box-shadow: 0 0 0 10px transparent; } }
    @keyframes shimmer    { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
    .slide-up { animation: slide-up 0.3s ease-out; }
    @keyframes pop      { 0% { transform: scale(0.9); } 60% { transform: scale(1.06); } 100% { transform: scale(1); } }
    @keyframes wiggle   { 0%, 100% { transform: translateX(0) rotate(0); } 25% { transform: translateX(-4px) rotate(-1.5deg); } 75% { transform: translateX(4px) rotate(1.5deg); } }
    @keyframes confetti { 0% { transform: translate(0,0) rotate(0); opacity: 1; } 100% { transform: translate(var(--dx), 120px) rotate(var(--rot)); opacity: 0; } }
    .pop    { animation: pop 0.28s ease-out; }
    .wiggle { animation: wiggle 0.30s ease-in-out; }
    @media (prefers-reduced-motion: reduce) {
      .pop, .wiggle, .slide-up { animation: none !important; }
      .confetti-layer { display: none !important; }
    }
  `;
  document.head.appendChild(style);
}
