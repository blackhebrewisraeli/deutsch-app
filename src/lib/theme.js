// ═══════════════════════════════════════════════════════════════
//  DESIGN SYSTEM — Deutsch App
//
//  Colour values are CSS custom properties written by applyTheme().
//  The export shape is stable — components keep using COLORS.ink etc.
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
//  1. PRIMITIVES
// ─────────────────────────────────────────────────────────────

// ── Colours (var(--…) — resolved on :root by applyTheme) ─────
export const COLORS = {
  // Backgrounds — elevation ramp: ground → surface1 → surface2 → surface3
  paper: 'var(--c-ground)',
  paperDeep: 'var(--c-surface-alt)', // alias of surface-1 in light, surface-2 in dark
  card: 'var(--c-surface)', // alias of surface-2 in light, surface-1 in dark
  surface: 'var(--c-surface)', // same var as card — the name the token model uses
  surfaceElevated: 'var(--c-surface-3)',
  surface1: 'var(--c-surface-1)',
  surface2: 'var(--c-surface-2)',
  surface3: 'var(--c-surface-3)',
  border: 'var(--c-border)',
  borderStrong: 'var(--c-border-strong)',

  // German-flag accent tiers. FILLS only — each pairs with its own `On` ink,
  // and the ink is invisible anywhere but on its own tier.
  //   accentBlack — identity chrome that must not invert with the theme
  //   accentRed   — "the app is asking you for something", NOT error
  // `COLORS.red` stays `--c-error` and now means only *wrong*.
  // See ACCENT_TIERS_* in themeTokens.js for why there is no gold tier.
  accentBlack: 'var(--c-accent-black)',
  accentBlackOn: 'var(--c-accent-black-on)',
  accentBlackOnMuted: 'var(--c-accent-black-on-muted)',
  accentRed: 'var(--c-accent-red)',
  accentRedOn: 'var(--c-accent-red-on)',

  // Mode-independent German-flag stripes (entry splash). Same hex in every
  // palette — see FLAG_STRIPES in themeTokens.js.
  flagBlack: 'var(--c-flag-black)',
  flagRed: 'var(--c-flag-red)',
  flagGold: 'var(--c-flag-gold)',
  flagOnBlack: 'var(--c-flag-on-black)',
  flagOnRed: 'var(--c-flag-on-red)',
  flagOnGold: 'var(--c-flag-on-gold)',

  // Text
  ink: 'var(--c-fg)',
  inkSoft: 'var(--c-fg-subtle)',
  mute: 'var(--c-fg-muted)',

  // Accents (pack seed → soft / fill / deep via applyTheme; structural aliases kept)
  red: 'var(--c-error)',
  redSoft: 'var(--c-error-soft)',
  rust: 'var(--c-error-deep)',
  gold: 'var(--c-accent)',
  goldSoft: 'var(--c-accent-soft)',
  goldDeep: 'var(--c-accent-deep)',
  accentAlt: 'var(--c-accent-alt)',
  accentAltSoft: 'var(--c-accent-alt-soft)',
  accentAltDeep: 'var(--c-accent-alt-deep)',

  // Success / go — soft / base / deep (success-fill kept as soft alias)
  green: 'var(--c-success)',
  greenDeep: 'var(--c-success-deep)',
  greenSoft: 'var(--c-success-soft)',
  lip: 'var(--c-lip)',

  // Alpha / companion tokens (hex-suffix concat is invalid with var(--…))
  inkA10: 'var(--c-fg-a10)',
  inkA12: 'var(--c-fg-a12)',
  inkA20: 'var(--c-fg-a20)',
  inkA30: 'var(--c-fg-a30)',
  inkAa: 'var(--c-fg-aa)',
  inkSoftA08: 'var(--c-fg-subtle-a08)',
  paperA50: 'var(--c-ground-a50)',
  paperA60: 'var(--c-ground-a60)',
  paperA80: 'var(--c-ground-a80)',
  redA80: 'var(--c-error-a80)',
  redA00: 'var(--c-error-a00)',
  heat1: 'var(--c-heat-1)',
  heat2: 'var(--c-heat-2)',
  track: 'var(--c-track)',
  press: 'var(--c-press)',
  scrim: 'var(--c-scrim)',
  muteDeep: 'var(--c-mute-deep)',
  goldLip: 'var(--c-gold-lip)',
  goldLipSoft: 'var(--c-gold-lip-soft)',
  goldBright: 'var(--c-gold-bright)',
  accentFg: 'var(--c-accent-fg)',
  accentOn: 'var(--c-accent-on)',
  accentAltOn: 'var(--c-accent-alt-on)',
};

// ── Typography ───────────────────────────────────────────────
export const FONTS = {
  display: 'var(--f-display)',
  mono: 'var(--f-mono)',
  body: 'var(--f-body)',
};

// Backward-compat aliases — existing components import these directly
export const FONT_DISPLAY = FONTS.display;
export const FONT_MONO = FONTS.mono;
export const FONT_BODY = FONTS.body;

export const FONT_SIZE = {
  label: 9,
  tag: 10,
  ipa: 11,
  sm: 12,
  base: 13,
  md: 15,
  lg: 16,
  xl: 18,
  '2xl': 20,
  '3xl': 24,
  '4xl': 36,
  '5xl': 48,
  '6xl': 64,
  hero: 120,
};

export const FONT_WEIGHT = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  black: 900,
};

export const LETTER_SPACING = {
  tight: '-0.04em',
  normal: '0em',
  wide: '0.05em',
  wider: '0.1em',
  widest: '0.15em',
  caps: '0.2em',
  ultra: '0.25em',
  hero: '0.3em',
};

// ── Spacing ──────────────────────────────────────────────────
export const SPACE = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  12: 48,
  16: 64,
};

// ── Borders ──────────────────────────────────────────────────
export const BORDER = {
  standard: `2px solid ${COLORS.ink}`,
  subtle: `1px solid ${COLORS.ink}`,
  dashed: `1px dashed ${COLORS.ink}`,
  ghost: `1px solid ${COLORS.paperA50}`,
  // Hairline from the structural border token — visible on dark surfaces
  // where SHADOW.card's light-mode rgba is nearly invisible.
  panel: `1px solid ${COLORS.border}`,
};

// ── Radius ───────────────────────────────────────────────────
export const RADIUS = {
  sm: 10,
  md: 14,
  lg: 16,
  xl: 22,
  pill: 999,
};

// ── Elevation ────────────────────────────────────────────────
export const SHADOW = {
  press: (lipColor) => `0 4px 0 ${lipColor}`,
  card: '0 6px 16px rgba(22,17,11,0.08)',
  cardChunk: '0 8px 0 rgba(22,17,11,0.10)',
  bar: '0 6px 18px rgba(22,17,11,0.08)',
  // Recessed wells — text inputs and the deck-picker search field. Four
  // components had this literal inline; it lives here so "inputs look sunken"
  // is one decision rather than four copies drifting apart.
  inset: 'inset 0 2px 5px rgba(22,17,11,0.06)',
};

// ── Motion ───────────────────────────────────────────────────
export const TRANSITION = {
  fast: 'all 0.15s ease',
  default: 'all 0.20s ease',
  slow: 'all 0.30s ease',
};

// ── Z-index ──────────────────────────────────────────────────
export const Z = {
  base: 0,
  raised: 10,
  nav: 49,
  header: 50,
  modal: 100,
};

// ─────────────────────────────────────────────────────────────
//  2. COMPONENT TOKENS
// ─────────────────────────────────────────────────────────────

const btnBase = {
  border: 'none',
  borderRadius: RADIUS.md,
  fontFamily: FONTS.mono,
  fontWeight: FONT_WEIGHT.bold,
  fontSize: FONT_SIZE.sm,
  letterSpacing: LETTER_SPACING.widest,
  textTransform: 'uppercase',
  padding: `${SPACE[4]}px ${SPACE[6]}px`,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: SPACE[2],
  transition: 'transform .08s ease, box-shadow .08s ease',
};

export const BUTTON = {
  go: {
    ...btnBase,
    background: COLORS.green,
    color: COLORS.paper,
    boxShadow: SHADOW.press(COLORS.greenDeep),
  },
  primary: {
    ...btnBase,
    background: COLORS.ink,
    color: COLORS.paper,
    boxShadow: SHADOW.press(COLORS.press),
  },
  danger: {
    ...btnBase,
    background: COLORS.red,
    color: COLORS.paper,
    boxShadow: SHADOW.press(COLORS.rust),
  },
  tile: {
    ...btnBase,
    background: COLORS.card,
    color: COLORS.ink,
    boxShadow: SHADOW.press(COLORS.lip),
  },
  secondary: {
    ...btnBase,
    background: COLORS.card,
    color: COLORS.ink,
    boxShadow: SHADOW.press(COLORS.lip),
    flex: 1,
  },
  ghost: {
    ...btnBase,
    background: 'transparent',
    color: COLORS.paper,
    border: BORDER.ghost,
    boxShadow: 'none',
    textTransform: 'none',
    fontSize: FONT_SIZE.tag,
    letterSpacing: LETTER_SPACING.wider,
    padding: `${SPACE[1]}px ${SPACE[3]}px`,
  },
};

export const btnSecondary = BUTTON.secondary;

export const CARD = {
  base: {
    background: COLORS.surface,
    border: BORDER.panel,
    borderRadius: RADIUS.xl,
    boxShadow: SHADOW.card,
    color: COLORS.ink,
  },
  dark: { background: COLORS.ink, borderRadius: RADIUS.lg, color: COLORS.paper },
  soft: {
    background: COLORS.paperDeep,
    border: BORDER.panel,
    borderRadius: RADIUS.lg,
    boxShadow: SHADOW.card,
    color: COLORS.ink,
  },
  alert: { background: COLORS.red, borderRadius: RADIUS.lg, color: COLORS.paper },
};

export const TEXT = {
  label: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZE.tag,
    letterSpacing: LETTER_SPACING.caps,
    textTransform: 'uppercase',
    color: COLORS.mute,
  },
  tag: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZE.ipa,
    letterSpacing: LETTER_SPACING.wider,
    background: COLORS.ink,
    color: COLORS.paper,
    padding: `2px ${SPACE[2]}px`,
  },
  display: {
    fontFamily: FONTS.display,
    fontWeight: FONT_WEIGHT.black,
    letterSpacing: LETTER_SPACING.tight,
    lineHeight: 1,
  },
  ipa: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZE.ipa,
    opacity: 0.65,
  },
  translation: {
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: FONT_SIZE.base,
    opacity: 0.75,
  },
  kicker: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZE.tag,
    letterSpacing: LETTER_SPACING.hero,
    color: COLORS.red,
    textTransform: 'uppercase',
  },
};
