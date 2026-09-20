// Geometry for a popover sheet anchored to a trigger, clamped to the viewport.
//
// Pure, and in its own module for two reasons. jsdom reports every
// getBoundingClientRect as 0×0, so the only way to prove a clamp is to call the
// arithmetic directly with real numbers; and a component file that also exports
// a helper breaks Fast Refresh (react-refresh/only-export-components), which is
// why ui/tone.js lives apart from the components that read it.
//
// The three header chips (ThemeChip, StatusChip, AccountChip) still carry their
// own right-anchored copy of this. They are not migrated here as part of the
// Chat work — they are shipping, tested, and anchor to the opposite edge — but
// this is where that arithmetic belongs when someone does.

export const SHEET_GUTTER = 12;
const SHEET_OFFSET = 8;

/**
 * Left-align a sheet under (or over) its trigger without leaving the viewport.
 *
 * Left-aligned rather than right-aligned like the header chips: this is for a
 * control in the page body, usually near the LEFT edge, where a right-anchored
 * sheet would hang off the opposite side. Left overflow never shows up in
 * scrollWidth, so no overflow assertion would catch it either way — the clamp
 * is the guard.
 *
 * Flips above the trigger when the sheet would not fit below AND there is room
 * above; the caller caps the rendered height, so an underestimated `height`
 * scrolls rather than clipping.
 *
 * @param {{top: number, bottom: number, left: number}} rect trigger rect
 * @param {{width: number, height: number}} viewport in CSS pixels
 * @param {{width: number, height: number}} sheet desired size
 * @returns {{top: number, left: number, width: number}}
 */
export function placeSheet(rect, viewport, sheet) {
  const width = Math.min(sheet.width, viewport.width - SHEET_GUTTER * 2);
  const maxLeft = Math.max(SHEET_GUTTER, viewport.width - width - SHEET_GUTTER);
  const below = rect.bottom + SHEET_OFFSET;
  const above = rect.top - SHEET_OFFSET - sheet.height;
  const flip = below + sheet.height > viewport.height && above >= SHEET_GUTTER;
  return {
    left: Math.min(Math.max(rect.left, SHEET_GUTTER), maxLeft),
    top: flip ? above : below,
    width,
  };
}
