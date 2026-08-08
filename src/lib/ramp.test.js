import { describe, it, expect } from 'vitest';
import {
  mixHex,
  deriveSurfaceRamp,
  deriveAccentRamp,
  deriveSemanticRamp,
  deriveThemeRamps,
  MIN_SURFACE_STEP,
} from './ramp';
import { contrastRatio } from './contrast';
import { MODE_COLORS, DEFAULT_ACCENTS } from './themeTokens';

describe('mixHex', () => {
  it('returns the first colour at t=0 and the second at t=1', () => {
    expect(mixHex('#000000', '#FFFFFF', 0)).toBe('#000000');
    expect(mixHex('#000000', '#FFFFFF', 1)).toBe('#FFFFFF');
  });

  it('midpoint of black and white is mid grey', () => {
    expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });
});

describe('deriveSurfaceRamp', () => {
  it('keeps legacy surface / surface-alt values for light.day', () => {
    const p = MODE_COLORS.light.day;
    const ramp = deriveSurfaceRamp(p, 'light');
    expect(ramp.surface).toBe(p.surface);
    expect(ramp['surface-alt']).toBe(p['surface-alt']);
    expect(ramp['surface-1']).toBe(p['surface-alt']);
    expect(ramp['surface-2']).toBe(p.surface);
    expect(ramp['surface-3']).toBeTruthy();
    expect(ramp['surface-3']).not.toBe(ramp['surface-2']);
  });

  it('keeps legacy surface / surface-alt values for dark.day', () => {
    const p = MODE_COLORS.dark.day;
    const ramp = deriveSurfaceRamp(p, 'dark');
    expect(ramp.surface).toBe(p.surface);
    expect(ramp['surface-alt']).toBe(p['surface-alt']);
    expect(ramp['surface-1']).toBe(p.surface);
    expect(ramp['surface-2']).toBe(p['surface-alt']);
    expect(ramp['surface-3']).toBeTruthy();
    expect(ramp['surface-3']).not.toBe(ramp['surface-2']);
  });

  // Regression: light.day shipped surface-2 #FFFFFF → surface-3 #FEFEFE, one
  // unit per channel — a step in the token values and nothing on screen. The
  // cause was structural, not a typo: light mode elevates by brightening and
  // that palette's `surface` is already pure white, so there was nowhere to go.
  // Pinned for every palette, not just the one we noticed.
  it('gives every palette a top elevation step that is actually visible', () => {
    for (const mode of ['light', 'dark']) {
      for (const tone of ['day', 'night']) {
        const ramp = deriveSurfaceRamp(MODE_COLORS[mode][tone], mode);
        expect(
          contrastRatio(ramp['surface-2'], ramp['surface-3']),
          `${mode}.${tone} surface-2 → surface-3`
        ).toBeGreaterThanOrEqual(MIN_SURFACE_STEP);
      }
    }
  });

  // A weaker floor across the whole ladder, so no step can collapse the way
  // the top one did. Dark.night's surface-1 → surface-2 is the tightest
  // legitimate pair at ~1.036, so this bar sits just under it.
  it('keeps every consecutive elevation pair distinguishable', () => {
    for (const mode of ['light', 'dark']) {
      for (const tone of ['day', 'night']) {
        const r = deriveSurfaceRamp(MODE_COLORS[mode][tone], mode);
        const ladder = [r.ground, r['surface-1'], r['surface-2'], r['surface-3']];
        for (let i = 0; i < ladder.length - 1; i += 1) {
          expect(
            contrastRatio(ladder[i], ladder[i + 1]),
            `${mode}.${tone} step ${i} → ${i + 1}`
          ).toBeGreaterThan(1.03);
        }
      }
    }
  });

  // Light mode shades the top step toward the palette's own ink rather than a
  // fixed grey, so a warm palette keeps a warm panel.
  it('shades light-mode surface-3 within the palette rather than to a cool grey', () => {
    const r = deriveSurfaceRamp(MODE_COLORS.light.night, 'light');
    const [red, , blue] = [1, 3, 5].map((i) => parseInt(r['surface-3'].slice(i, i + 2), 16));
    expect(red, 'warm palette keeps red above blue in surface-3').toBeGreaterThan(blue);
  });

  it('lifts surface-3 only as far as every body ink stays at AA', () => {
    // A flat 8% lift put dark surface-3 at 4.01:1 against fg-subtle. The lift is
    // capped by the weakest ink, so elevation can never outrun legibility.
    for (const mode of ['light', 'dark']) {
      for (const tone of ['day', 'night']) {
        const p = MODE_COLORS[mode][tone];
        const s3 = deriveSurfaceRamp(p, mode)['surface-3'];
        for (const ink of ['fg', 'fg-muted', 'fg-subtle']) {
          expect(
            contrastRatio(p[ink], s3),
            `${mode}.${tone} ${ink} on surface-3`
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });
});

describe('deriveAccentRamp', () => {
  it('keeps the seed as the solid fill and derives soft + deep', () => {
    const seed = '#FFCE00';
    const ramp = deriveAccentRamp(seed, '#FFFFFF', 'light', 'accent', '#0D0D0F');
    expect(ramp.accent).toBe(seed);
    expect(ramp['accent-soft']).toMatch(/^#[0-9A-F]{6}$/);
    expect(ramp['accent-deep']).toMatch(/^#[0-9A-F]{6}$/);
    expect(ramp['accent-soft']).not.toBe(seed);
    expect(ramp['accent-deep']).not.toBe(seed);
  });
});

describe('deriveSemanticRamp', () => {
  it('aliases success-soft to the existing success-fill', () => {
    const p = MODE_COLORS.light.day;
    const ramp = deriveSemanticRamp(p, 'success');
    expect(ramp['success-soft']).toBe(p['success-fill']);
    expect(ramp['success-fill']).toBe(p['success-fill']);
    expect(ramp.success).toBe(p.success);
    expect(ramp['success-deep']).toBe(p['success-deep']);
  });
});

describe('deriveThemeRamps', () => {
  it('includes surface, accent, and semantic steps for every palette', () => {
    for (const mode of ['light', 'dark']) {
      for (const tone of ['day', 'night']) {
        const structural = MODE_COLORS[mode][tone];
        const d = DEFAULT_ACCENTS[mode];
        const accents = {
          accent: d.accent,
          accentOn: d.accentOn,
          accentAlt: d.accentAlt,
          accentAltOn: d.accentAltOn,
        };
        const tokens = deriveThemeRamps(structural, mode, accents);
        for (const key of [
          'surface-1',
          'surface-2',
          'surface-3',
          'accent-soft',
          'accent',
          'accent-deep',
          'accent-alt-soft',
          'accent-alt',
          'accent-alt-deep',
          'success-soft',
          'success',
          'success-deep',
          'error-soft',
          'error',
          'error-deep',
        ]) {
          expect(tokens[key], `${mode}.${tone} ${key}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
        }
      }
    }
  });
});
