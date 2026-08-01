import { describe, it, expect } from 'vitest';
import { contrastRatio, relativeLuminance } from './contrast';
import { MODE_COLORS, DEFAULT_ACCENTS } from './themeTokens';
import { accent, accentAlt } from '../packs/de/theme';

const AA_NORMAL = 4.5;
const AA_LARGE = 3;

/**
 * Pairings the token model is designed to support at WCAG AA,
 * for every mode × tone palette.
 */
function pairsFor(mode, tone) {
  const c = MODE_COLORS[mode][tone];
  const packAccent = accent.fill;
  const packAccentOn = accent.onFill;
  const packAccentFg = accent.fg[mode];
  const packAltFill = accentAlt.fill[mode];
  const packAltOn = accentAlt.onFill[mode];
  const label = `${mode}.${tone}`;

  const pairs = [
    { fg: c.fg, bg: c.ground, min: AA_NORMAL, name: `${label} fg on ground` },
    { fg: c.fg, bg: c.surface, min: AA_NORMAL, name: `${label} fg on surface` },
    { fg: c.fg, bg: c['surface-alt'], min: AA_NORMAL, name: `${label} fg on surface-alt` },
    { fg: c['fg-muted'], bg: c.surface, min: AA_NORMAL, name: `${label} fg-muted on surface` },
    { fg: c.ground, bg: c.fg, min: AA_NORMAL, name: `${label} ground on fg (inverted)` },
    { fg: c.error, bg: c.surface, min: AA_NORMAL, name: `${label} error on surface` },
    { fg: c.success, bg: c.surface, min: AA_LARGE, name: `${label} success on surface (large)` },
    {
      fg: packAccentOn,
      bg: packAccent,
      min: AA_NORMAL,
      name: `${label} accent.onFill on accent.fill`,
    },
    {
      fg: packAccentFg,
      bg: c.ground,
      // Pack accent.fg is mode-based, not tone-aware. On light.night's dimmer
      // ground it clears large-text AA (wordmark/icon use); body AA on surface.
      min: mode === 'light' && tone === 'night' ? AA_LARGE : AA_NORMAL,
      name: `${label} accent.fg on ground`,
    },
    {
      fg: packAccentFg,
      bg: c.surface,
      min: AA_NORMAL,
      name: `${label} accent.fg on surface`,
    },
    {
      fg: packAltOn,
      bg: packAltFill,
      min: AA_NORMAL,
      name: `${label} accentAlt.onFill on accentAlt.fill`,
    },
  ];

  if (mode === 'dark') {
    pairs.push({
      fg: c.error,
      bg: c.ground,
      min: AA_NORMAL,
      name: `${label} error on ground`,
    });
    pairs.push({
      fg: c['fg-muted'],
      bg: c.ground,
      min: AA_NORMAL,
      name: `${label} fg-muted on ground`,
    });
  }

  return pairs;
}

describe('contrast helpers', () => {
  it('matches known WCAG samples from the theme spec', () => {
    expect(contrastRatio('#FFCE00', '#0D0D0F')).toBeCloseTo(13.02, 1);
    expect(contrastRatio('#FFCE00', '#FFFFFF')).toBeLessThan(AA_NORMAL);
    expect(contrastRatio('#E03131', '#0D0D0F')).toBeLessThan(AA_NORMAL);
    expect(contrastRatio('#FF6B6B', '#0D0D0F')).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('relativeLuminance of black is 0 and white is 1', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5);
  });
});

describe('token model contrast (all mode × tone palettes)', () => {
  for (const mode of ['light', 'dark']) {
    for (const tone of ['day', 'night']) {
      describe(`${mode}.${tone}`, () => {
        for (const pair of pairsFor(mode, tone)) {
          it(`${pair.name} ≥ ${pair.min}:1`, () => {
            const ratio = contrastRatio(pair.fg, pair.bg);
            expect(
              ratio,
              `${pair.name}: ${pair.fg} on ${pair.bg} = ${ratio.toFixed(2)}:1 (need ${pair.min})`
            ).toBeGreaterThanOrEqual(pair.min);
          });
        }
      });
    }
  }

  it('fails with the offending pair named when a foreground is darkened', () => {
    const name = 'dark.day fg on ground';
    const fg = '#3a3a3a';
    const bg = MODE_COLORS.dark.day.ground;
    const ratio = contrastRatio(fg, bg);
    expect(ratio).toBeLessThan(AA_NORMAL);
    expect(`${name}: ${fg} on ${bg} = ${ratio.toFixed(2)}:1`).toMatch(/dark\.day fg on ground/);
  });
});

describe('legacy DEFAULT_ACCENTS stay within the fill rule', () => {
  it('ink-on-gold defaults pass in both modes', () => {
    for (const mode of ['light', 'dark']) {
      const d = DEFAULT_ACCENTS[mode];
      expect(contrastRatio(d.accentOn, d.accent)).toBeGreaterThanOrEqual(AA_NORMAL);
    }
  });
});
