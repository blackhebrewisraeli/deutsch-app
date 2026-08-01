import { DEFAULT_ACCENTS, tokenToCssVar, resolvePalette } from './themeTokens';

/**
 * Resolve pack accent fields that may be a plain string or `{ light, dark }`.
 * @param {string | { light: string, dark: string }} value
 * @param {'light' | 'dark'} mode
 */
function resolveModeValue(value, mode) {
  if (value == null) return undefined;
  if (typeof value === 'string') return value;
  return value[mode];
}

/**
 * Write the resolved token set onto `document.documentElement` as CSS
 * custom properties. Safe to call before React mounts (and in tests).
 *
 * @param {'light' | 'dark'} mode
 * @param {object} [packTheme] — `activePack.theme` when available
 * @param {'day' | 'night'} [tone='day'] — Day-light / Night-light alternate
 */
export function applyTheme(mode = 'light', packTheme, tone = 'day') {
  if (typeof document === 'undefined') return;

  const resolved = mode === 'dark' ? 'dark' : 'light';
  const resolvedTone = tone === 'night' ? 'night' : 'day';
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.tone = resolvedTone;

  const structural = resolvePalette(resolved, resolvedTone);
  for (const [key, value] of Object.entries(structural)) {
    root.style.setProperty(tokenToCssVar(key), value);
  }

  const defaults = DEFAULT_ACCENTS[resolved];
  const accent = packTheme?.accent;
  const accentAlt = packTheme?.accentAlt;

  root.style.setProperty('--c-accent', resolveModeValue(accent?.fill, resolved) ?? defaults.accent);
  root.style.setProperty(
    '--c-accent-on',
    resolveModeValue(accent?.onFill, resolved) ?? defaults.accentOn
  );
  root.style.setProperty(
    '--c-accent-fg',
    resolveModeValue(accent?.fg, resolved) ?? defaults.accentFg
  );
  root.style.setProperty(
    '--c-accent-alt',
    resolveModeValue(accentAlt?.fill, resolved) ?? defaults.accentAlt
  );
  root.style.setProperty(
    '--c-accent-alt-on',
    resolveModeValue(accentAlt?.onFill, resolved) ?? defaults.accentAltOn
  );

  // Legacy lip shades used by chat/alphabet gold press shadows
  root.style.setProperty('--c-gold-lip', defaults.goldLip);
  root.style.setProperty('--c-gold-lip-soft', defaults.goldLipSoft);
  root.style.setProperty('--c-gold-bright', defaults.goldBright);

  // Fonts from pack; fall back to current house faces
  const font = packTheme?.font;
  root.style.setProperty(
    '--f-display',
    font?.display ?? "'Fraunces', 'Playfair Display', Georgia, serif"
  );
  root.style.setProperty('--f-body', font?.body ?? "'Fraunces', Georgia, serif");
  root.style.setProperty('--f-mono', font?.mono ?? "'JetBrains Mono', 'Courier New', monospace");
}
