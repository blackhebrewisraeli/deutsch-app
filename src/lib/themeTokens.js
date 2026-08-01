// Structural colour token values per mode × tone.
// Day-light = brighter of the pair; Night-light = darker of the pair.
// light.day / dark.day match T1 defaults so existing users see no change.
//
// Keys are the CSS custom-property suffixes: `--c-<key>`.

/** @typedef {'light' | 'dark'} ThemeMode */
/** @typedef {'day' | 'night'} ThemeTone */

// Several tokens are the same colour at a different opacity. Written out by hand
// that was 52 near-identical literals across four palettes — `#EDEBE810` sitting
// beside `#EDEBE812` — where a one-character typo is invisible to review and to
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

// The stats heatmap ramp is one gold at two opacities, identical in every
// palette, so it is defined once rather than repeated four times.
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

const LIGHT_DAY = withDerived({
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
});

/** Dimmer warm parchment — Night-light alternate for Light mode.
 *  Surface stays near-white so body/error/success text clear AA; ground is
 *  the visibly darker plane. The pack's light accent.fg is chosen to clear
 *  body AA against this dimmer ground too — see packs/de/theme.js. */
const LIGHT_NIGHT = withDerived({
  ground: '#E8D9A0',
  surface: '#FFFBF2',
  'surface-alt': '#F3E9C4',
  border: '#16110b',
  'border-strong': '#16110b',
  fg: '#16110b',
  'fg-muted': '#6E6354',
  'fg-subtle': '#2a2218',
  success: '#3FA34D',
  'success-fill': '#DCEDE0',
  error: '#D62828',
  'error-fill': '#F5E0E0',
  warning: '#F5C518',
  'success-deep': '#2F7D3A',
  'error-deep': '#a82020',
  lip: '#C9BA8A',
  press: '#000000',
  'mute-deep': '#5C5548',
  track: '#D4C48A',
});

/** Current Nocturne — Day-light (default) for Dark mode. */
const DARK_DAY = withDerived({
  ground: '#0D0D0F',
  surface: '#16161C',
  'surface-alt': '#1B1B22',
  border: '#26262E',
  'border-strong': '#3A3A46',
  fg: '#EDEBE8',
  'fg-muted': '#9A9AA4',
  'fg-subtle': '#8A8A96',
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
});

/** Deeper Nocturne — Night-light alternate for Dark mode. */
const DARK_NIGHT = withDerived({
  ground: '#08080A',
  surface: '#121218',
  'surface-alt': '#16161C',
  border: '#1E1E26',
  'border-strong': '#2E2E38',
  fg: '#EDEBE8',
  'fg-muted': '#9A9AA4',
  'fg-subtle': '#8A8A96',
  success: '#3FA34D',
  'success-fill': '#142418',
  error: '#FF6B6B',
  'error-fill': '#221010',
  warning: '#FFCE00',
  'success-deep': '#2F7D3A',
  'error-deep': '#C92A2A',
  lip: '#22222C',
  press: '#000000',
  'mute-deep': '#6E6E78',
  track: '#22222C',
});

/**
 * Per-mode × per-tone structural colour values.
 * @type {Record<ThemeMode, Record<ThemeTone, Record<string, string>>>}
 */
export const MODE_COLORS = {
  light: { day: LIGHT_DAY, night: LIGHT_NIGHT },
  dark: { day: DARK_DAY, night: DARK_NIGHT },
};

/** Legacy accent defaults (pre-pack). Pack theme overlays these in applyTheme. */
export const DEFAULT_ACCENTS = {
  light: {
    accent: '#F5C518',
    accentOn: '#16110b',
    accentFg: '#6E5400', // clears AA on both light grounds — see packs/de/theme.js
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

/**
 * Resolve a structural palette for mode × tone.
 * @param {ThemeMode} mode
 * @param {ThemeTone} [tone]
 */
export function resolvePalette(mode, tone = 'day') {
  const family = mode === 'dark' ? 'dark' : 'light';
  const t = tone === 'night' ? 'night' : 'day';
  return MODE_COLORS[family][t];
}
