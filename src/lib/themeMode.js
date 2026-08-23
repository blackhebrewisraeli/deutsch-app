import { applyTheme } from './applyTheme';
import { injectFonts } from './injectFonts';
import { injectGlobalStyles } from './injectGlobalStyles';
import { activePack } from '../packs';

/** Per-device preference — NOT part of synced `deutsch-app-state-v1`. */
export const THEME_MODE_KEY = 'deutsch-theme-mode';

export const THEME_MODES = ['light', 'dark'];

/**
 * Read the stored preference. Returns null when unset or corrupt so resolution
 * can fall through to prefers-color-scheme / dark default.
 * @returns {'light' | 'dark' | null}
 */
export function readThemePreference() {
  try {
    const v = localStorage.getItem(THEME_MODE_KEY);
    if (v == null) return null;
    if (THEME_MODES.includes(v)) return v;
  } catch {
    // private mode / blocked storage
  }
  return null;
}

/**
 * @returns {'light' | 'dark' | null} null when matchMedia is unavailable
 */
export function getSystemMode() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return null;
  }
}

/**
 * Resolution order: explicit light/dark → system (prefers-color-scheme) → dark.
 * This is the automatic fallback for a user who has never picked — it is not a
 * selectable option, so it stays internal rather than a "System" UI toggle.
 * @param {'light' | 'dark' | null} preference
 * @param {'light' | 'dark' | null} systemMode
 * @returns {'light' | 'dark'}
 */
export function resolveThemeMode(preference, systemMode) {
  if (preference === 'light' || preference === 'dark') return preference;
  if (systemMode === 'light' || systemMode === 'dark') return systemMode;
  return 'dark';
}

/** Resolved mode shown as active in the UI — unset falls through to system/dark. */
export function getThemeModeForUI() {
  return resolveThemeMode(readThemePreference(), getSystemMode());
}

/** Apply the currently resolved mode to :root. */
export function applyCurrentTheme() {
  const mode = resolveThemeMode(readThemePreference(), getSystemMode());
  applyTheme(mode, activePack.theme);
  return mode;
}

/**
 * Persist a preference and re-apply. Unknown values are ignored (no throw).
 * @param {string} preference
 * @returns {'light' | 'dark' | null}
 */
export function setThemePreference(preference) {
  if (!THEME_MODES.includes(preference)) {
    return applyCurrentTheme();
  }
  try {
    localStorage.setItem(THEME_MODE_KEY, preference);
  } catch {
    // still apply in-memory for this session
  }
  const mode = resolveThemeMode(preference, getSystemMode());
  applyTheme(mode, activePack.theme);
  return mode;
}

/**
 * Watch OS colour-scheme changes while no explicit preference is stored.
 * @param {(mode: 'light' | 'dark') => void} [onChange]
 * @returns {() => void} unsubscribe
 */
export function watchSystemTheme(onChange) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    const pref = readThemePreference();
    if (pref === 'light' || pref === 'dark') return;
    const mode = applyCurrentTheme();
    onChange?.(mode);
  };
  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }
  // Safari < 14
  mq.addListener(handler);
  return () => mq.removeListener(handler);
}

/** Boot: apply once before React mounts, then watch the OS. */
export function bootTheme() {
  injectGlobalStyles();
  injectFonts(activePack.theme?.font?.families);
  applyCurrentTheme();
  return watchSystemTheme();
}
