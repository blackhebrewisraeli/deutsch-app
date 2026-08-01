// Structural colour token values per mode.
// Light mode reproduces the pre-architecture palette in theme.js exactly
// so the refactor is screenshot-verifiable. Dark mode is Nocturne.
//
// Keys are the CSS custom-property suffixes: `--c-<key>`.

/** @typedef {'light' | 'dark'} ThemeMode */

// Several tokens are the same colour at a different opacity. Writing them out by
// hand meant 22 near-identical literals across the palettes — `#EDEBE810` sitting
// next to `#EDEBE812`, where a one-character typo is invisible to review and to
// every test. They are derived instead: change `fg` and its whole alpha family
// follows. Each entry is [derived key, source key, 8-bit alpha as hex].
const ALPHA_DERIVATIONS = [
  ['fg-a10', 'fg', '10'],
  ['fg-a12', 'fg', '12'],
  ['fg-a20', 'fg', '20'],
  ['fg-a30', 'fg', '30'],
  ['fg-aa', 'fg', 'aa'],
  ['fg-subtle-a08', 'fg-subtle', '08'],
  ['ground-a50', 'ground', '50'],
  ['ground-a60', 'ground', '60'],
  ['ground-a80', 'ground', '80'],
  ['error-a80', 'error', '80'],
  ['error-a00', 'error', '00'],
];

// The stats heatmap ramp is one gold at two opacities and is identical in both
// modes, so it is defined once rather than repeated per palette.
const HEAT_RAMP = { 'heat-1': '#FFCE0040', 'heat-2': '#FFCE0090' };

/**
 * Expand a base palette with its derived alpha variants and the shared heat ramp.
 * @param {Record<string,string>} base
 * @returns {Record<string,string>}
 */
function withDerived(base) {
  const out = { ...base, ...HEAT_RAMP };
  for (const [key, from, alpha] of ALPHA_DERIVATIONS) {
    out[key] = `${base[from]}${alpha}`;
  }
  return out;
}

/**
 * Per-mode structural colour values.
 * Light = current production palette. Dark = Nocturne.
 */
export const MODE_COLORS = {
  light: withDerived({
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
    track: '#e7dcae',
  }),
  dark: withDerived({
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
    track: '#2A2A34',
  }),
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
