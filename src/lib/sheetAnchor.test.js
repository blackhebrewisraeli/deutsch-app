import { describe, it, expect } from 'vitest';
import { placeSheet, SHEET_GUTTER } from './sheetAnchor';

const VIEWPORT_320 = { width: 320, height: 640 };
const VIEWPORT_DESKTOP = { width: 1440, height: 900 };
const SHEET = { width: 288, height: 240 };

// jsdom reports every getBoundingClientRect as 0x0, so a clamp asserted through
// a rendered component is asserted against zeros and would pass with the
// arithmetic deleted. These call it with measured numbers instead.
const rect = (left, top, height = 32) => ({ left, top, bottom: top + height });

describe('placeSheet', () => {
  it('left-aligns to the trigger and opens below it when there is room', () => {
    expect(placeSheet(rect(240, 100), VIEWPORT_DESKTOP, SHEET)).toEqual({
      left: 240,
      top: 140,
      width: 288,
    });
  });

  it('never lets the sheet start left of the gutter', () => {
    expect(placeSheet(rect(2, 100), VIEWPORT_DESKTOP, SHEET).left).toBe(SHEET_GUTTER);
    expect(placeSheet(rect(-40, 100), VIEWPORT_DESKTOP, SHEET).left).toBe(SHEET_GUTTER);
  });

  it('pulls a right-edge trigger back so the sheet stays on screen', () => {
    // A trigger at x=1300 would put a 288px sheet at 1588 — 148px past a
    // 1440px viewport. Right overflow DOES widen the page, so this one is the
    // horizontal-scroll bug; the left clamp above is the invisible one.
    const { left, width } = placeSheet(rect(1300, 100), VIEWPORT_DESKTOP, SHEET);
    expect(left + width).toBeLessThanOrEqual(VIEWPORT_DESKTOP.width - SHEET_GUTTER);
  });

  it('still fits inside a 320px viewport at full width', () => {
    const { left, width } = placeSheet(rect(16, 100), VIEWPORT_320, SHEET);
    expect(width).toBe(SHEET.width);
    expect(left + width).toBeLessThanOrEqual(VIEWPORT_320.width);
  });

  it('shrinks below its desired width when the viewport is narrower still', () => {
    const narrow = { width: 280, height: 640 };
    const { left, width } = placeSheet(rect(16, 100), narrow, SHEET);
    expect(width).toBe(280 - SHEET_GUTTER * 2);
    expect(left).toBe(SHEET_GUTTER);
    expect(left + width).toBeLessThanOrEqual(narrow.width);
  });

  it('flips above the trigger when the sheet would run off the bottom', () => {
    // 640px tall viewport, trigger at 560: below is 600 and the sheet needs
    // 240, so it would end at 840. Above starts at 560 - 8 - 240 = 312.
    expect(placeSheet(rect(20, 560), VIEWPORT_320, SHEET).top).toBe(312);
  });

  it('stays below when flipping would run off the top instead', () => {
    // Nothing fits either way in a 240px-tall viewport. Below wins: the sheet
    // scrolls (maxHeight) rather than starting above the fold.
    expect(placeSheet(rect(20, 40), { width: 320, height: 240 }, SHEET).top).toBe(80);
  });
});
