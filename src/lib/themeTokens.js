// Structural colour token values per mode.
// Light mode reproduces the pre-architecture palette in theme.js exactly
// so the refactor is screenshot-verifiable. Dark mode is Nocturne.
//
// Keys are the CSS custom-property suffixes: `--c-<key>`.

/** @typedef {'light' | 'dark'} ThemeMode */

/**
 * Per-mode structural colour values.
 * Light = current production palette. Dark = Nocturne.
 */
export const MODE_COLORS = {
  light: {
    ground: '#FDF3C0',
    surface: '#FFFFFF',
    'surface-alt': '#FFF8DC',
    border: '#16110b',
    'border-strong': '#16110b',
    fg: '#16110b',
    'fg-muted': '#7a6e5c',
    'fg-subtle': '#2a2218',
    success: '#3FA34D',
    'success-fill': '#E7F3E9',
    error: '#D62828',
    'error-fill': '#FCE8E8',
    warning: '#F5C518',
    'success-deep': '#2F7D3A',
    'error-deep': '#a82020',
    lip: '#D9CD9F',
    press: '#000000',
    'mute-deep': '#6b6354',
    'fg-a10': '#16110b10',
    'fg-a12': '#16110b12',
    'fg-a20': '#16110b20',
    'fg-a30': '#16110b30',
    'fg-aa': '#16110baa',
    'fg-subtle-a08': '#2a221808',
    'ground-a50': '#FDF3C050',
    'ground-a60': '#FDF3C060',
    'ground-a80': '#FDF3C080',
    'error-a80': '#D6282880',
    'error-a00': '#D6282800',
    'heat-1': '#FFCE0040',
    'heat-2': '#FFCE0090',
    track: '#e7dcae',
  },
  dark: {
    ground: '#0D0D0F',
    surface: '#16161C',
    'surface-alt': '#1B1B22',
    border: '#26262E',
    'border-strong': '#3A3A46',
    fg: '#EDEBE8',
    'fg-muted': '#9A9AA4',
    'fg-subtle': '#6E6E78',
    success: '#3FA34D',
    'success-fill': '#1A2E1C',
    error: '#FF6B6B',
    'error-fill': '#2A1515',
    warning: '#FFCE00',
    'success-deep': '#2F7D3A',
    'error-deep': '#C92A2A',
    lip: '#2A2A34',
    press: '#000000',
    'mute-deep': '#6E6E78',
    'fg-a10': '#EDEBE810',
    'fg-a12': '#EDEBE812',
    'fg-a20': '#EDEBE820',
    'fg-a30': '#EDEBE830',
    'fg-aa': '#EDEBE8aa',
    'fg-subtle-a08': '#6E6E7808',
    'ground-a50': '#0D0D0F50',
    'ground-a60': '#0D0D0F60',
    'ground-a80': '#0D0D0F80',
    'error-a80': '#FF6B6B80',
    'error-a00': '#FF6B6B00',
    'heat-1': '#FFCE0040',
    'heat-2': '#FFCE0090',
    track: '#2A2A34',
  },
};

/** Legacy accent defaults (pre-pack). Pack theme overlays these in applyTheme. */
export const DEFAULT_ACCENTS = {
  light: {
    accent: '#F5C518',
    accentOn: '#16110b',
    accentFg: '#8A6A00',
    accentAlt: '#D62828',
    accentAltOn: '#FFFFFF',
    goldLip: '#caa10f',
    goldLipSoft: '#d9ab10',
    goldBright: '#FFE44D',
  },
  dark: {
    accent: '#FFCE00',
    accentOn: '#0D0D0F',
    accentFg: '#FFCE00',
    accentAlt: '#FF6B6B',
    accentAltOn: '#0D0D0F',
    goldLip: '#c9a200',
    goldLipSoft: '#c9a200',
    goldBright: '#FFE44D',
  },
};

/** @param {string} key */
export function tokenToCssVar(key) {
  return `--c-${key}`;
}
