import { describe, it, expect } from 'vitest';
import { contrastRatio, relativeLuminance } from './contrast';
import { MODE_COLORS, DEFAULT_ACCENTS } from './themeTokens';
import { accent, accentAlt } from '../packs/de/theme';

const AA_NORMAL = 4.5;
const AA_LARGE = 3;

/**
 * Pairings the token model is designed to support at WCAG AA.
 *
 * Light parchment (`#FDF3C0`) leaves a few legacy pairs (mute/error/success
 * as text *on the page ground*) a hair under the floor — those colours are
 * used as fills or on `surface` in the UI. The architecture's hard guarantees
 * are: primary text, accent-as-fill, per-mode accent.fg, and dark-mode error.
 */
function pairsForMode(mode) {
  const c = MODE_COLORS[mode];
  const packAccent = accent.fill;
  const packAccentOn = accent.onFill;
  const packAccentFg = accent.fg[mode];
  const packAltFill = accentAlt.fill[mode];
  const packAltOn = accentAlt.onFill[mode];

  const pairs = [
    { fg: c.fg, bg: c.ground, min: AA_NORMAL, name: `${mode} fg on ground` },
    { fg: c.fg, bg: c.surface, min: AA_NORMAL, name: `${mode} fg on surface` },
    { fg: c.fg, bg: c['surface-alt'], min: AA_NORMAL, name: `${mode} fg on surface-alt` },
    { fg: c['fg-muted'], bg: c.surface, min: AA_NORMAL, name: `${mode} fg-muted on surface` },
    { fg: c.ground, bg: c.fg, min: AA_NORMAL, name: `${mode} ground on fg (inverted)` },
    { fg: c.error, bg: c.surface, min: AA_NORMAL, name: `${mode} error on surface` },
    { fg: c.success, bg: c.surface, min: AA_LARGE, name: `${mode} success on surface (large)` },
    {
      fg: packAccentOn,
      bg: packAccent,
      min: AA_NORMAL,
      name: `${mode} accent.onFill on accent.fill`,
    },
    {
      fg: packAccentFg,
      bg: c.ground,
      min: AA_NORMAL,
      name: `${mode} accent.fg on ground`,
    },
    {
      fg: packAccentFg,
      bg: c.surface,
      min: AA_NORMAL,
      name: `${mode} accent.fg on surface`,
    },
    {
      fg: packAltOn,
      bg: packAltFill,
      min: AA_NORMAL,
      name: `${mode} accentAlt.onFill on accentAlt.fill`,
    },
  ];

  // Dark mode: error must work as body text on the page ground (the 4.30 bug).
  if (mode === 'dark') {
    pairs.push({
      fg: c.error,
      bg: c.ground,
      min: AA_NORMAL,
      name: 'dark error on ground',
    });
    pairs.push({
      fg: c['fg-muted'],
      bg: c.ground,
      min: AA_NORMAL,
      name: 'dark fg-muted on ground',
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

describe('token model contrast (both modes)', () => {
  for (const mode of ['light', 'dark']) {
    describe(mode, () => {
      for (const pair of pairsForMode(mode)) {
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

  it('fails with the offending pair named when a foreground is darkened', () => {
    const name = 'dark fg on ground';
    const fg = '#3a3a3a';
    const bg = MODE_COLORS.dark.ground;
    const ratio = contrastRatio(fg, bg);
    expect(ratio).toBeLessThan(AA_NORMAL);
    expect(`${name}: ${fg} on ${bg} = ${ratio.toFixed(2)}:1`).toMatch(/dark fg on ground/);
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
