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
