// German pack theme — flag gold/red accents + house typefaces.
// Structural colours (ground, success/error, …) live in src/lib/themeTokens.js.

export const accent = {
  fill: '#FFCE00', // mode-independent — always ink on top
  onFill: '#0D0D0F',
  // Text / border / icon — the one place the accent is a foreground rather than
  // a fill, so it must clear AA against every ground and surface in its mode.
  // `#8A6A00` cleared light.day (4.53) but only reached 3.59 on light.night's
  // dimmer parchment; `#6E5400` clears all four light palettes (5.07 worst case)
  // and lets the contrast test hold every palette to the same 4.5:1 floor.
  // Worth revisiting in the redesign, when light mode leaves parchment entirely.
  fg: { light: '#6E5400', dark: '#FFCE00' },
};

export const accentAlt = {
  fill: { light: '#C92A2A', dark: '#FF6B6B' },
  onFill: { light: '#FFFFFF', dark: '#0D0D0F' },
};

/** Flag sweep for progress affordances: ground → red → gold. */
export const progress = ['ground', 'accentAlt', 'accent'];

// The families are vendored into public/fonts/ by `npm run vendor:fonts` and
// served same-origin; nothing here is fetched from a CDN at runtime.
//
// `axes` asks for continuous ranges, not the discrete instances this used to
// request. Google honours the difference literally: pinning six weights returns
// six static files per subset, and the precache pulls all of them eagerly even
// though a browser would have lazily fetched two or three. Measured over
// latin+latin-ext that is 869.5 KB against 165.9 KB for the ranges below, which
// cover every weight in between and keep `opsz` continuous as well.
//
// `subsets` sits on the family, not the pack, because the two faces render
// different alphabets. Prose needs latin (ä ö ü ß and the „quotes" are all
// inside it) plus latin-ext for the odd foreign proper noun. The mono face
// additionally renders IPA — VocabTab shows every card's pronunciation in it —
// and IPA borrows θ and χ from Greek, so dropping that subset would silently
// fall those two glyphs back to a system font. It costs 6.6 KB.
//
// src/lib/fontCoverage.test.js fails if a subset that is carrying real content
// gets dropped from either list.
/**
 * Body sans, vendored and ready but not yet adopted.
 *
 * Body copy currently renders in Fraunces — AGENTS.md fixes the typography as
 * Fraunces for display and JetBrains Mono for uppercase labels, and switching
 * body copy to a sans is a brand decision, not a refactor. The family is
 * vendored so that decision costs one line here (`body: BODY_SANS`) instead of
 * a fetch, a licence check and a manifest regeneration.
 *
 * Weights stop at 700: body copy uses regular through bold, and asking for the
 * full 200..800 range widens each subset file for two weights nothing renders.
 */
export const BODY_SANS = "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif";

export const font = {
  display: "'Fraunces', Georgia, serif",
  body: "'Fraunces', Georgia, serif",
  mono: "'JetBrains Mono', 'Courier New', monospace",
  families: [
    { name: 'Fraunces', axes: 'opsz,wght@9..144,300..900', subsets: ['latin', 'latin-ext'] },
    {
      name: 'JetBrains Mono',
      axes: 'wght@400..700',
      subsets: ['latin', 'latin-ext', 'greek', 'vietnamese'],
    },
    // Prose subsets only — the sans never renders IPA, so it needs neither the
    // greek nor the vietnamese subset the mono face carries.
    { name: 'Plus Jakarta Sans', axes: 'wght@400..700', subsets: ['latin', 'latin-ext'] },
  ],
};

export const theme = { accent, accentAlt, progress, font };
