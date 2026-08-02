import { describe, it, expect } from 'vitest';
import {
  mixHex,
  deriveSurfaceRamp,
  deriveAccentRamp,
  deriveSemanticRamp,
  deriveThemeRamps,
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
