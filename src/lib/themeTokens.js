// Structural colour token values per mode.
//
// Light mode is warm ivory. It was saturated parchment (#FDF3C0) through T1/T2;
// the ivory re-skin kept `fg` and the semantic success/error inks untouched, so
// every audited text pairing carried over and only the planes moved.
//
// Keys are the CSS custom-property suffixes: `--c-<key>`.

/** @typedef {'light' | 'dark'} ThemeMode */

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
  // Modal backdrop. Derived from `press` (black in every palette) rather than
  // `fg`, because an fg-based scrim inverts in dark mode — `fg` is #EDEBE8 there,
  // so the "dimming" layer would brighten the backdrop instead.
  ['scrim', 'press', '80'],
];

// The stats heatmap ramp is one gold at two opacities, identical in every
// palette, so it is defined once rather than repeated four times.
const HEAT_RAMP = { 'heat-1': '#FFCE0040', 'heat-2': '#FFCE0090' };

// German-flag accent tiers for the app's own voice. Distinct from FLAG_STRIPES:
// those are the splash's literal flag and never vary, while these are theme
// tokens the chrome uses, so red takes a deeper value in light and a brighter
// one in dark.
//
// **There is deliberately no gold tier.** One shipped in #131 and was retired
// without ever gaining a consumer: `COLORS.gold` (the pack accent) already
// carries reward, streak, XP and level-up, and a second gold had no rule to
// tell it from the first. `COLORS.accentAlt` has sat unused since the theme arc
// began — one unused accent in the palette is enough.
//
// Each tier is a FILL and ships the ink that sits on it (`-on`). The pairing is
// the contract: `accent-black-on` is near-white and is invisible on a light
// ground, so an ink used away from its own tier disappears. contrast.test.js
// asserts that trap directly.
//
// `accent-black` holds the same charcoal in both modes rather than inverting to
// white in dark: a token named "black" that renders white is exactly the bug
// that made the splash's black stripe flip in PR #116. It is also the only
// stable dark plane in the system — `COLORS.ink` used as a fill is #16110b in
// light and #EDEBE8 in dark, so every chip built on it flips to white.
const ACCENT_TIERS_LIGHT = {
  'accent-black': '#1A1816',
  'accent-black-on': '#FBF8F1',
  // Quiet ink for the charcoal plane. `fg-muted` is a dark brown in light mode
  // and unreadable here, so the masthead tagline had nothing to use. Opaque
  // rather than `accent-black-on` at alpha, so contrast.test.js can assert it —
  // an alpha token is excluded from that sweep and would go unchecked.
  'accent-black-on-muted': '#9A948C',
  'accent-red': '#C92A2A',
  'accent-red-on': '#FFFFFF',
};

const ACCENT_TIERS_DARK = {
  'accent-black': '#1A1816',
  'accent-black-on': '#FBF8F1',
  // Quiet ink for the charcoal plane. `fg-muted` is a dark brown in light mode
  // and unreadable here, so the masthead tagline had nothing to use. Opaque
  // rather than `accent-black-on` at alpha, so contrast.test.js can assert it —
  // an alpha token is excluded from that sweep and would go unchecked.
  'accent-black-on-muted': '#9A948C',
  'accent-red': '#EF4444',
  'accent-red-on': '#0F0F11',
};

// The informational plane. One surface in the app is neither a card the user
// can act on nor a piece of chrome: the first-visit banner that explains how
// the exercise model works. It was painted with `COLORS.ink` as a fill, which
// is the same token the user's chat bubble, the active nav tab, toasts and
// every primary button use — so the one panel that is purely explanatory
// looked exactly like the things that do something when pressed.
//
// Indigo carries no other meaning in this palette. Gold is reward, red is
// wrong, green is correct, charcoal is identity chrome; none of them were free
// to mean "read this". Note the standing rule three comments up — a tier that
// ships without a consumer gets retired, as the gold one did. This one has
// exactly one consumer (`chat/WelcomeBanner.jsx`) and should keep having one.
//
// It is the only accent here that ADAPTS by mode rather than holding a single
// value, and that is deliberate rather than an oversight: the point of the
// plane is separation from the page, and separation is a relationship, not a
// colour. Light mode grounds on ivory, where a deep indigo reads as a rich
// panel; dark mode grounds on near-black, where that same indigo sinks into
// the background at 1.7:1. The dark value is lifted until the panel clears 3:1
// against its ground, which is the non-text threshold for a boundary the eye
// has to find. The ink is shared, because near-white sits on both.
const INFO_PLANE_LIGHT = { info: '#312E81', 'info-on': '#EEF0FF' };
const INFO_PLANE_DARK = { info: '#4F46E5', 'info-on': '#EEF0FF' };

// Entry-splash flag stripes. These are brand colours, not theme colours: a
// light-mode machine still gets black / red / gold. Pairing them with
// COLORS.ink / COLORS.paper made the "black" stripe invert with the theme
// (PR #116); keeping the values identical in every palette is what makes
// the three bands read as the German flag in both modes.
//
// Gold matches the pack accent fill (`#FFCE00`); charcoal matches dark.day
// ground. Red is federal flag `#DD0000`, which clears AA with white.
export const FLAG_STRIPES = {
  'flag-black': '#0D0D0F',
  'flag-red': '#DD0000',
  'flag-gold': '#FFCE00',
  'flag-on-black': '#FFCE00',
  'flag-on-red': '#FFFFFF',
  'flag-on-gold': '#0D0D0F',
};

/**
 * Expand a base palette with its derived alpha variants and the shared heat ramp.
 * @param {Record<string,string>} base
 * @returns {Record<string,string>}
 */
function withDerived(base) {
  const out = { ...base, ...HEAT_RAMP, ...FLAG_STRIPES };
  for (const [key, from, alpha] of ALPHA_DERIVATIONS) {
    out[key] = `${base[from]}${alpha}`;
  }
  return out;
}

const LIGHT = withDerived({
  ...ACCENT_TIERS_LIGHT,
  ...INFO_PLANE_LIGHT,
  ground: '#FBF8F1',
  surface: '#FFFFFF',
  'surface-alt': '#F0ECE1',
  // Light mode used a near-black hairline (#16110b) on parchment. Ivory is a
  // quieter canvas, so separation moves to a two-step neutral pair; `fg` stays
  // the same ink, so no text pairing changes.
  //
  // A third `border-subtle` step shipped in #131 and was retired without a
  // consumer: in-card dividers use `COLORS.inkA10`/`inkA12`, ink at 10-12%
  // alpha, which composites correctly on every surface including the derived
  // elevation steps. An opaque token cannot, so adopting it would have been a
  // regression dressed as a cleanup.
  border: '#E2DDD2',
  'border-strong': '#CFC7B5',
  fg: '#16110b',
  'fg-muted': '#5C5142',
  'fg-subtle': '#2a2218',
  success: '#2F7D3A',
  'success-fill': '#E7F3E9',
  error: '#C41E1E',
  'error-fill': '#FCE8E8',
  warning: '#F5C518',
  'success-deep': '#246330',
  'error-deep': '#a82020',
  lip: '#E5DFD0',
  press: '#000000',
  'mute-deep': '#6b6354',
  track: '#EAE4D6',
});

/** Nocturne — Dark mode. */
const DARK = withDerived({
  ...ACCENT_TIERS_DARK,
  ...INFO_PLANE_DARK,
  ground: '#0F0F11',
  surface: '#1A1A1E',
  // The elevated card plane the palette aims at is #24242A, but that is
  // `surface-3` (COLORS.surfaceElevated), which deriveSurfaceRamp lifts from
  // here — setting it directly on `surface-alt` left `fg-subtle` at 4.52:1 and
  // liftSurface, which refuses any lift that breaks ink AA, returned the input
  // unchanged: surface-3 silently collapsed onto surface-2. At #1E1E24 the lift
  // clears AA and lands on #242429.
  'surface-alt': '#1E1E24',
  border: '#2E2E36',
  'border-strong': '#3A3A44',
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

/**
 * Per-mode structural colour values.
 * @type {Record<ThemeMode, Record<string, string>>}
 */
export const MODE_COLORS = {
  light: LIGHT,
  dark: DARK,
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
 * Resolve a structural palette for a mode.
 * @param {ThemeMode} mode
 */
export function resolvePalette(mode) {
  return mode === 'dark' ? MODE_COLORS.dark : MODE_COLORS.light;
}
