import { describe, it, expect } from 'vitest';
import { contrastRatio, relativeLuminance } from './contrast';
import { MODE_COLORS, DEFAULT_ACCENTS, FLAG_STRIPES } from './themeTokens';
import { deriveThemeRamps } from './ramp';
import { accent, accentAlt } from '../packs/de/theme';

const AA_NORMAL = 4.5;
const AA_LARGE = 3;

/**
 * Resolve a pack accent field that may be a plain string or `{ light, dark }`.
 * @param {string | { light: string, dark: string }} value
 * @param {'light' | 'dark'} mode
 */
function resolveModeValue(value, mode) {
  if (typeof value === 'string') return value;
  return value[mode];
}

/** Resolved ramp tokens for a mode using the German pack seeds. */
function rampFor(mode) {
  const structural = MODE_COLORS[mode];
  const packAccent = resolveModeValue(accent.fill, mode);
  const packAccentOn = resolveModeValue(accent.onFill, mode);
  const packAltFill = resolveModeValue(accentAlt.fill, mode);
  const packAltOn = resolveModeValue(accentAlt.onFill, mode);
  return {
    c: deriveThemeRamps(structural, mode, {
      accent: packAccent,
      accentOn: packAccentOn,
      accentAlt: packAltFill,
      accentAltOn: packAltOn,
    }),
    packAccent,
    packAccentOn,
    packAccentFg: accent.fg[mode],
    packAltFill,
    packAltOn,
  };
}

/**
 * Pairings the token model is designed to support at WCAG AA,
 * for every mode palette — including derived ramp steps.
 *
 * Roles:
 * - soft steps are backgrounds (body ink on top)
 * - accent / accent-deep are fills (onFill on top)
 * - success-deep / error-deep are lip/press fills, not body text
 */
function pairsFor(mode) {
  const { c, packAccent, packAccentOn, packAccentFg, packAltFill, packAltOn } = rampFor(mode);
  const label = mode;

  /** @type {{ fg: string, bg: string, min: number, name: string }[]} */
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
      // Held to body AA in every palette. This previously carved out
      // light.night at large-text-only because the accent failed there (3.59);
      // the pack's light accent.fg was darkened instead, so the floor is now
      // uniform. Relaxing a threshold for the one case that fails hides the
      // failure rather than fixing it.
      min: AA_NORMAL,
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

  // Elevation ramp — body ink on every surface step.
  // fg-muted and fg-subtle are body text too (COLORS.mute / COLORS.inkSoft), so
  // a step that only clears AA against `fg` is a trap for the first component
  // that adopts it: dark surface-3 sat at 4.0–4.2:1 against fg-subtle before
  // these assertions existed.
  for (const sn of ['surface-1', 'surface-2', 'surface-3']) {
    for (const [key, ink] of [
      ['fg', c.fg],
      ['fg-muted', c['fg-muted']],
      ['fg-subtle', c['fg-subtle']],
    ]) {
      pairs.push({
        fg: ink,
        bg: c[sn],
        min: AA_NORMAL,
        name: `${label} ${key} on ${sn}`,
      });
    }
    pairs.push({
      fg: packAccentFg,
      bg: c[sn],
      min: AA_NORMAL,
      name: `${label} accent.fg on ${sn}`,
    });
    pairs.push({
      fg: c.error,
      bg: c[sn],
      min: AA_NORMAL,
      name: `${label} error on ${sn}`,
    });
    pairs.push({
      fg: c.success,
      bg: c[sn],
      min: AA_LARGE,
      name: `${label} success on ${sn} (large)`,
    });
  }

  // Soft tint backgrounds — body ink must remain readable on them
  for (const soft of ['accent-soft', 'accent-alt-soft', 'success-soft', 'error-soft']) {
    pairs.push({
      fg: c.fg,
      bg: c[soft],
      min: AA_NORMAL,
      name: `${label} fg on ${soft}`,
    });
  }

  // German-flag accent tiers. Each is a fill carrying its own paired ink, so the
  // assertion is ink-on-tier, never tier-on-ground: `accent-gold` is 3.0:1 on
  // light ivory and would fail the moment someone used it as a text colour.
  for (const tier of ['black', 'red']) {
    pairs.push({
      fg: c[`accent-${tier}-on`],
      bg: c[`accent-${tier}`],
      min: AA_NORMAL,
      name: `${label} accent-${tier}-on on accent-${tier}`,
    });
  }

  // The masthead's quiet ink is body text (the tagline), so it is held to body
  // AA on its own plane rather than the 3:1 a decorative tone would get.
  pairs.push({
    fg: c['accent-black-on-muted'],
    bg: c['accent-black'],
    min: AA_NORMAL,
    name: `${label} accent-black-on-muted on accent-black`,
  });

  // Accent fills (solid + deep lip) carry onFill ink, not mode-flipping fg
  pairs.push({
    fg: packAccentOn,
    bg: c['accent-deep'],
    min: AA_NORMAL,
    name: `${label} accent.onFill on accent-deep`,
  });
  pairs.push({
    fg: packAltOn,
    bg: c['accent-alt-deep'],
    min: AA_NORMAL,
    name: `${label} accentAlt.onFill on accent-alt-deep`,
  });

  // These pairs were dark-only with no stated reason. Both error and fg-muted
  // inks are now used by the StatusNote primitive, which renders directly on
  // the page ground. All four combinations (light/dark × error/fg-muted) pass.
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

describe('token model contrast (all mode palettes)', () => {
  for (const mode of ['light', 'dark']) {
    describe(mode, () => {
      for (const pair of pairsFor(mode)) {
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

describe('accent tiers are fills, not foregrounds', () => {
  // The rule is easy to violate by accident and invisible once shipped, so it
  // is asserted rather than only documented: if a future palette ever made a
  // tier readable as text on its own ground, that would mean the tier had
  // drifted into a foreground role and the fill/ink pairing no longer holds.
  // The pairing is the contract, and the failure mode is silence: a tier's ink
  // is chosen to sit on that tier and nowhere else, so using it against the page
  // ground does not look wrong — it looks like nothing rendered at all.
  // `accent-red-on` is #FFFFFF in light (on ivory) and #0F0F11 in dark (on
  // obsidian): near-invisible in both.
  it("each tier's ink is invisible on the page ground it does not belong to", () => {
    for (const mode of ['light', 'dark']) {
      const c = MODE_COLORS[mode];
      expect(
        contrastRatio(c['accent-red-on'], c.ground),
        `${mode} accent-red-on must not be legible off its tier`
      ).toBeLessThan(AA_NORMAL);
    }
  });

  it('has no gold tier — COLORS.gold already owns reward', () => {
    for (const mode of ['light', 'dark']) {
      expect(MODE_COLORS[mode]['accent-gold']).toBeUndefined();
    }
  });

  it('every tier ships a paired ink in every palette', () => {
    for (const mode of ['light', 'dark']) {
      const c = MODE_COLORS[mode];
      for (const tier of ['black', 'red']) {
        expect(c[`accent-${tier}`], `${mode} accent-${tier}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(c[`accent-${tier}-on`], `${mode} accent-${tier}-on`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });
});

describe('flag stripe pairings (mode-independent)', () => {
  it.each([
    ['gold on charcoal', FLAG_STRIPES['flag-on-black'], FLAG_STRIPES['flag-black']],
    ['white on flag red', FLAG_STRIPES['flag-on-red'], FLAG_STRIPES['flag-red']],
    ['charcoal on gold', FLAG_STRIPES['flag-on-gold'], FLAG_STRIPES['flag-gold']],
  ])('%s ≥ 4.5:1', (_name, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});
