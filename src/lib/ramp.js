/**
 * Derive tonal ramps from seed colours before they become CSS variables.
 * Packs supply seeds (accent.fill, accentAlt.fill); the system owns the steps.
 */

import { parseHex, contrastRatio } from './contrast';

const AA_NORMAL = 4.5;

/** @param {number} n */
function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/** @param {{ r: number, g: number, b: number }} rgb */
function toHex({ r, g, b }) {
  return (
    '#' +
    [r, g, b]
      .map((c) => clampByte(c).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/**
 * Linear mix in sRGB. t=0 → a, t=1 → b.
 * @param {string} a
 * @param {string} b
 * @param {number} t
 */
export function mixHex(a, b, t) {
  const A = parseHex(a);
  const B = parseHex(b);
  return toHex({
    r: A.r + (B.r - A.r) * t,
    g: A.g + (B.g - A.g) * t,
    b: A.b + (B.b - A.b) * t,
  });
}

/**
 * Darken a fill for lip/pressed use while keeping onFill ≥ AA on the result.
 * @param {string} fill
 * @param {string} onFill
 * @param {number} [prefer=0.22]
 */
export function deriveDeepFill(fill, onFill, prefer = 0.22) {
  for (let t = prefer; t >= 0.04; t -= 0.02) {
    const candidate = mixHex(fill, '#000000', t);
    if (contrastRatio(onFill, candidate) >= AA_NORMAL) return candidate;
  }
  // Softest usable deep — still distinct from the seed when possible
  return mixHex(fill, '#000000', 0.06);
}

/**
 * Surface elevation: ground → surface-1 → surface-2 → surface-3.
 * Existing `surface` / `surface-alt` keep their exact palette values.
 *
 * @param {Record<string, string>} palette — structural palette (mode×tone)
 * @param {'light' | 'dark'} mode
 */
export function deriveSurfaceRamp(palette, mode) {
  const ground = palette.ground;
  const surface = palette.surface;
  const surfaceAlt = palette['surface-alt'];

  let surface1;
  let surface2;
  let surface3;

  if (mode === 'light') {
    // Brightness climbs: ground (parchment) → cream → white → lifted panel
    surface1 = surfaceAlt;
    surface2 = surface;
    surface3 = mixHex(surface, '#FFFFFF', 0.55);
    if (surface3.toUpperCase() === surface2.toUpperCase()) {
      // Already pure white — nudge a hair cooler so elevation is visible
      surface3 = mixHex(surface, '#F5F7FA', 0.12);
    }
  } else {
    // Dark: elevate by lightening — ground → surface → alt → one step further
    surface1 = surface;
    surface2 = surfaceAlt;
    surface3 = mixHex(surfaceAlt, '#FFFFFF', 0.08);
  }

  return {
    ground,
    'surface-1': surface1,
    'surface-2': surface2,
    'surface-3': surface3,
    // Legacy names keep their exact palette values (not remapped by elevation index —
    // light maps alt→1 / surface→2, dark maps surface→1 / alt→2).
    surface,
    'surface-alt': surfaceAlt,
  };
}

/**
 * Accent ramp from a pack seed fill: soft tint → solid → deep lip/press.
 * @param {string} fill
 * @param {string} surface — mix target for the soft tint
 * @param {'light' | 'dark'} mode
 * @param {'accent' | 'accent-alt'} prefix
 * @param {string} onFill — ink that sits on the solid/deep fills
 */
export function deriveAccentRamp(fill, surface, mode, prefix, onFill) {
  const softAmount = mode === 'light' ? 0.16 : 0.28;
  const preferDeep = mode === 'light' ? 0.22 : 0.2;
  return {
    [`${prefix}-soft`]: mixHex(surface, fill, softAmount),
    [prefix]: fill,
    [`${prefix}-deep`]: deriveDeepFill(fill, onFill, preferDeep),
  };
}

/**
 * Normalise semantic soft / base / deep.
 * Existing `*-fill` / `*-deep` stay; `*-soft` is the normalised soft name.
 * @param {Record<string, string>} palette
 * @param {'success' | 'error'} name
 */
export function deriveSemanticRamp(palette, name) {
  const base = palette[name];
  const soft = palette[`${name}-fill`];
  const deep = palette[`${name}-deep`];
  return {
    [`${name}-soft`]: soft,
    [`${name}-fill`]: soft,
    [name]: base,
    [`${name}-deep`]: deep,
  };
}

/**
 * Full derived token set for a resolved structural palette + accent seeds.
 *
 * @param {Record<string, string>} structural — from resolvePalette
 * @param {'light' | 'dark'} mode
 * @param {{ accent: string, accentOn: string, accentAlt: string, accentAltOn: string }} accents
 */
export function deriveThemeRamps(structural, mode, accents) {
  const surfaces = deriveSurfaceRamp(structural, mode);
  const mixSurface = surfaces['surface-2'];

  const accent = deriveAccentRamp(accents.accent, mixSurface, mode, 'accent', accents.accentOn);
  const accentAlt = deriveAccentRamp(
    accents.accentAlt,
    mixSurface,
    mode,
    'accent-alt',
    accents.accentAltOn
  );
  const success = deriveSemanticRamp(structural, 'success');
  const error = deriveSemanticRamp(structural, 'error');

  return {
    ...structural,
    ...surfaces,
    ...accent,
    ...accentAlt,
    ...success,
    ...error,
  };
}
