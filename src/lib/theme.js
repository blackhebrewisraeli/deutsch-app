// ═══════════════════════════════════════════════════════════════
//  DESIGN SYSTEM — Deutsch App
//
//  All visual decisions live here.
//  Change a token → it propagates to every component that uses it.
//  Never hardcode colours, font sizes, or spacing in components.
//
//  Usage in components:
//    import { COLORS, FONTS, FONT_SIZE, BUTTON, CARD, TEXT } from '../lib/theme';
//    style={{ ...BUTTON.primary, width: '100%' }}
//
//  Structure:
//    1. Primitives  — raw values (colour, type, space, motion)
//    2. Composites  — component-level style objects (BUTTON, CARD, TEXT)
// ═══════════════════════════════════════════════════════════════


// ─────────────────────────────────────────────────────────────
//  1. PRIMITIVES
// ─────────────────────────────────────────────────────────────

// ── Colours ──────────────────────────────────────────────────
export const COLORS = {
  // Backgrounds
  paper:     '#FDF3C0',   // gold-tint parchment — main page background
  paperDeep: '#FFF8DC',   // cornsilk  — sidebars, inset panels
  card:      '#FFFFFF',   // white     — flashcards, chat bubbles

  // Text
  ink:       '#16110b',   // near-black — primary text + borders
  inkSoft:   '#2a2218',   // softer black — body copy
  mute:      '#7a6e5c',   // warm grey   — secondary labels, placeholders

  // Accents (German flag palette)
  red:       '#D62828',   // flag red  — CTAs, errors, corrections
  rust:      '#a82020',   // deep red  — hover / pressed state
  gold:      '#F5C518',   // flag gold — streak, rewards, Anna bubble
};


// ── Typography ───────────────────────────────────────────────
export const FONTS = {
  display: "'Fraunces', 'Playfair Display', Georgia, serif",
  mono:    "'JetBrains Mono', 'Courier New', monospace",
  body:    "'Fraunces', Georgia, serif",
};

// Backward-compat aliases — existing components import these directly
export const FONT_DISPLAY = FONTS.display;
export const FONT_MONO    = FONTS.mono;
export const FONT_BODY    = FONTS.body;

export const FONT_SIZE = {
  label:  9,    // tiny mono labels (e.g. "STREAK", number indices)
  tag:    10,   // small-caps tags, section numbers, captions
  ipa:    11,   // IPA / phonetic notation
  sm:     12,   // small mono text, keyboard hints
  base:   13,   // body paragraph, tip text
  md:     15,   // input fields, read-mode text
  lg:     16,   // nav labels, deck names
  xl:     18,   // card sub-headings, translation output
  '2xl':  20,   // nav tab labels, scenario names
  '3xl':  24,   // section titles (translation output panel)
  '4xl':  36,   // hero / header logo
  '5xl':  48,   // flashcard detail panel words
  '6xl':  64,   // flashcard main word, chat bubbles
  hero:   120,  // alphabet letter detail overlay
};

export const FONT_WEIGHT = {
  normal:   400,
  medium:   500,
  semibold: 600,
  bold:     700,
  black:    900,
};

export const LETTER_SPACING = {
  tight:   '-0.04em',  // display headings
  normal:  '0em',
  wide:    '0.05em',   // grammar notes
  wider:   '0.1em',    // scenario subtitles
  widest:  '0.15em',   // button labels, stat labels
  caps:    '0.2em',    // all-caps mono labels
  ultra:   '0.25em',   // section label text
  hero:    '0.3em',    // kicker text above hero
};


// ── Spacing ──────────────────────────────────────────────────
// Base unit: 4px. Use SPACE[n] to get n × 4px.
export const SPACE = {
  1:  4,
  2:  8,
  3:  12,
  4:  16,
  5:  20,
  6:  24,
  8:  32,
  12: 48,
  16: 64,
};


// ── Borders ──────────────────────────────────────────────────
export const BORDER = {
  standard: `2px solid ${COLORS.ink}`,     // used on almost every panel
  subtle:   `1px solid ${COLORS.ink}`,     // dividers within panels
  dashed:   `1px dashed ${COLORS.ink}`,    // separator in correction panel
  ghost:    `1px solid ${COLORS.paper}50`, // on dark backgrounds
};


// ── Motion ───────────────────────────────────────────────────
export const TRANSITION = {
  fast:    'all 0.15s ease',
  default: 'all 0.20s ease',
  slow:    'all 0.30s ease',
};


// ── Z-index ──────────────────────────────────────────────────
export const Z = {
  base:   0,
  raised: 10,
  nav:    49,   // sticky nav bar
  header: 50,   // sticky header (above nav)
  modal:  100,
};


// ─────────────────────────────────────────────────────────────
//  2. COMPONENT TOKENS  (composite style objects)
//
//  These are plain JS objects — spread them into inline styles:
//    <button style={{ ...BUTTON.primary, width: '100%' }}>
//
//  Override individual properties after the spread as needed.
// ─────────────────────────────────────────────────────────────

// ── Buttons ──────────────────────────────────────────────────
export const BUTTON = {
  // Solid black — primary action (send, submit, navigate)
  primary: {
    background:    COLORS.ink,
    color:         COLORS.paper,
    border:        'none',
    fontFamily:    FONTS.mono,
    fontWeight:    FONT_WEIGHT.bold,
    fontSize:      FONT_SIZE.sm,
    letterSpacing: LETTER_SPACING.widest,
    padding:       `${SPACE[4]}px ${SPACE[6]}px`,
    cursor:        'pointer',
    transition:    TRANSITION.fast,
    display:       'flex',
    alignItems:    'center',
    justifyContent:'center',
    gap:           SPACE[2],
  },

  // Solid red — CTA, generate, translate
  danger: {
    background:    COLORS.red,
    color:         COLORS.paper,
    border:        'none',
    fontFamily:    FONTS.mono,
    fontWeight:    FONT_WEIGHT.bold,
    fontSize:      FONT_SIZE.sm,
    letterSpacing: LETTER_SPACING.widest,
    padding:       `${SPACE[4]}px ${SPACE[6]}px`,
    cursor:        'pointer',
    transition:    TRANSITION.fast,
    display:       'flex',
    alignItems:    'center',
    justifyContent:'center',
    gap:           SPACE[2],
  },

  // Outlined — secondary / nav actions (PREV, NEXT, DISMISS)
  secondary: {
    flex:          1,
    background:    COLORS.paper,
    color:         COLORS.ink,
    border:        BORDER.standard,
    fontFamily:    FONTS.mono,
    fontWeight:    FONT_WEIGHT.bold,
    fontSize:      FONT_SIZE.sm,
    letterSpacing: LETTER_SPACING.widest,
    padding:       SPACE[4],
    cursor:        'pointer',
    transition:    TRANSITION.fast,
    display:       'flex',
    alignItems:    'center',
    justifyContent:'center',
    gap:           SPACE[2],
  },

  // Transparent with border — on dark backgrounds (HEAR IT, correction panel)
  ghost: {
    background:    'transparent',
    color:         COLORS.paper,
    border:        BORDER.ghost,
    fontFamily:    FONTS.mono,
    fontWeight:    FONT_WEIGHT.bold,
    fontSize:      FONT_SIZE.tag,
    letterSpacing: LETTER_SPACING.wider,
    padding:       `${SPACE[1]}px ${SPACE[3]}px`,
    cursor:        'pointer',
    transition:    TRANSITION.fast,
    display:       'inline-flex',
    alignItems:    'center',
    gap:           SPACE[2] - 2,
  },
};

// Backward-compat alias — VocabTab imports this from UI.jsx which re-exports it
export const btnSecondary = BUTTON.secondary;


// ── Cards / panels ───────────────────────────────────────────
export const CARD = {
  // Default light card — flashcards, info blocks
  base: {
    background: COLORS.card,
    border:     BORDER.standard,
    color:      COLORS.ink,
  },

  // Inverted dark panel — chat output, translation result
  dark: {
    background: COLORS.ink,
    border:     BORDER.standard,
    color:      COLORS.paper,
  },

  // Soft/warm panel — sidebars, inset areas, tip boxes
  soft: {
    background: COLORS.paperDeep,
    border:     BORDER.standard,
    color:      COLORS.ink,
  },

  // Alert / correction state
  alert: {
    background: COLORS.red,
    border:     BORDER.standard,
    color:      COLORS.paper,
  },
};


// ── Text styles ──────────────────────────────────────────────
export const TEXT = {
  // Small uppercase mono label (e.g. "STREAK", "01", "SCENARIO")
  label: {
    fontFamily:    FONTS.mono,
    fontSize:      FONT_SIZE.tag,
    letterSpacing: LETTER_SPACING.caps,
    textTransform: 'uppercase',
    color:         COLORS.mute,
  },

  // Larger mono tag with ink background (section numbers like "A", "B")
  tag: {
    fontFamily:    FONTS.mono,
    fontSize:      FONT_SIZE.ipa,
    letterSpacing: LETTER_SPACING.wider,
    background:    COLORS.ink,
    color:         COLORS.paper,
    padding:       `2px ${SPACE[2]}px`,
  },

  // Large editorial heading
  display: {
    fontFamily:    FONTS.display,
    fontWeight:    FONT_WEIGHT.black,
    letterSpacing: LETTER_SPACING.tight,
    lineHeight:    1,
  },

  // IPA / phonetic notation
  ipa: {
    fontFamily: FONTS.mono,
    fontSize:   FONT_SIZE.ipa,
    opacity:    0.65,
  },

  // Italic translation / English subtitle
  translation: {
    fontFamily: FONTS.body,
    fontStyle:  'italic',
    fontSize:   FONT_SIZE.base,
    opacity:    0.75,
  },

  // Kicker text above a hero heading (e.g. "Section 03")
  kicker: {
    fontFamily:    FONTS.mono,
    fontSize:      FONT_SIZE.tag,
    letterSpacing: LETTER_SPACING.hero,
    color:         COLORS.red,
    textTransform: 'uppercase',
  },
};
