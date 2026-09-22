import {
  BORDER,
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  RADIUS,
  SHADOW,
  SPACE,
} from '../../lib/theme';

// Style recipes shared by the admin panels.
//
// A separate module, not a block of exports beside the components that use
// them: a file exporting both components and constants breaks Fast Refresh
// (react-refresh/only-export-components), which is the same reason
// src/components/ui/tone.js exists.
//
// These are token COMPOSITIONS, never new values. Every number below resolves
// to a SPACE / RADIUS / FONT_SIZE entry, so the admin lane inherits a theme
// change instead of drifting away from one.

/**
 * The admin lane's navigation recipe: quiet mono text on a hairline rule, with
 * a 2px underline marking the active item.
 *
 * It replaces the row of chunky pill Buttons this panel used to wear. Those
 * pills are the app's PRIMARY ACTION affordance — they are what "Start deck"
 * and "Sign in" look like — so using them for navigation gave four or five
 * equally-loud lozenges to a screen whose actual destructive controls (block,
 * delete, adjust XP) then had nothing left to out-shout.
 */
const RAIL_ITEM = {
  appearance: 'none',
  background: 'none',
  border: 'none',
  // The underline is a BORDER on the button, not a box-shadow or a positioned
  // pseudo-element: an inactive item carries the same 2px border in
  // `transparent`, so activating one moves nothing. The negative bottom margin
  // is what lets that border sit ON the rail's hairline rather than 1px below.
  borderBottom: '2px solid transparent',
  marginBottom: -1,
  padding: `0 0 ${SPACE[3]}px`,
  cursor: 'pointer',
  fontFamily: FONTS.mono,
  fontSize: FONT_SIZE.tag,
  fontWeight: FONT_WEIGHT.bold,
  letterSpacing: LETTER_SPACING.caps,
  textTransform: 'uppercase',
  color: COLORS.mute,
  whiteSpace: 'nowrap',
};

const RAIL_ITEM_ACTIVE = { color: COLORS.ink, borderBottomColor: COLORS.ink };

export const RAIL = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: SPACE[5],
  borderBottom: BORDER.panel,
  // The rail is the one place in this panel allowed to scroll sideways. Three
  // uppercase mono labels plus their tracking do not fit 320px, and wrapping
  // them would break the single continuous rule the underline is measured
  // against.
  overflowX: 'auto',
  // Explicit, and NOT redundant: CSS computes `overflow-y: visible` to `auto`
  // the moment the other axis is not visible, so `overflowX: auto` alone gave
  // the rail a vertical scrollbar — a stray dark bar at its right end in both
  // rails. Nothing here ever needs to scroll vertically.
  overflowY: 'hidden',
  // Nothing here truncates, so the rail must be able to shrink to its container
  // before it starts scrolling — see the minWidth note in Layout.jsx.
  minWidth: 0,
};

export function railItemStyle(active) {
  return active ? { ...RAIL_ITEM, ...RAIL_ITEM_ACTIVE } : RAIL_ITEM;
}

/**
 * Button padding for the admin lane's row actions.
 *
 * BUTTON's resting padding (16/24) is sized for a page's primary call to
 * action. Two or three of those under every row of a forty-row list is most of
 * the panel's height spent on chrome. Only the box shrinks — the type size, the
 * lip, and the press behaviour are Button's and stay untouched, so these still
 * read as the same control family.
 */
export const COMPACT_BUTTON = { padding: `${SPACE[2]}px ${SPACE[4]}px` };

/** The recessed well every admin text input and select wears. */
export const FIELD = {
  display: 'block',
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  padding: `${SPACE[2]}px ${SPACE[3]}px`,
  background: COLORS.surface,
  color: COLORS.ink,
  border: `1px solid ${COLORS.border}`,
  borderRadius: RADIUS.md,
  boxShadow: SHADOW.inset,
  fontFamily: FONTS.body,
  fontSize: FONT_SIZE.sm,
};
