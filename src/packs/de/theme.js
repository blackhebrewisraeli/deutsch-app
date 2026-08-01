// German pack theme — flag gold/red accents + house typefaces.
// Structural colours (ground, success/error, …) live in src/lib/themeTokens.js.

export const accent = {
  fill: '#FFCE00', // mode-independent — always ink on top
  onFill: '#0D0D0F',
  fg: { light: '#8A6A00', dark: '#FFCE00' }, // text / border / icon
};

export const accentAlt = {
  fill: { light: '#C92A2A', dark: '#FF6B6B' },
  onFill: { light: '#FFFFFF', dark: '#0D0D0F' },
};

/** Flag sweep for progress affordances: ground → red → gold. */
export const progress = ['ground', 'accentAlt', 'accent'];

export const font = {
  display: "'Fraunces', Georgia, serif",
  body: "'Fraunces', Georgia, serif",
  mono: "'JetBrains Mono', 'Courier New', monospace",
  families: [
    {
      name: 'Fraunces',
      weights: [300, 400, 500, 600, 700, 900],
      axes: 'opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600;9..144,700;9..144,900',
    },
    {
      name: 'JetBrains Mono',
      weights: [400, 500, 700],
      axes: 'wght@400;500;700',
    },
  ],
};

export const theme = { accent, accentAlt, progress, font };
