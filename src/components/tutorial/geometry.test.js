import { describe, it, expect } from 'vitest';
import { GUTTER, BUBBLE_MAX_WIDTH, bubbleBox, scrimRects } from './geometry';

// A DOMRect-alike; jsdom gives every element a zero rect, so the real ones are
// stubbed in the component test and constructed literally here.
const rect = ({ left, top, width, height }) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

describe('bubbleBox', () => {
  it('centres the bubble under an anchor that has room on both sides', () => {
    const box = bubbleBox(rect({ left: 500, top: 100, width: 100, height: 40 }), 1280, 800);
    expect(box.left + box.width / 2).toBe(550);
    expect(box.placement).toBe('below');
  });

  it('places the bubble below the anchor when the space below fits it', () => {
    const box = bubbleBox(rect({ left: 100, top: 10, width: 40, height: 40 }), 1280, 800);
    expect(box.placement).toBe('below');
    expect(box.top).toBeGreaterThan(50);
  });

  it('flips above the anchor when there is no room below', () => {
    const box = bubbleBox(rect({ left: 100, top: 740, width: 40, height: 40 }), 1280, 800);
    expect(box.placement).toBe('above');
    expect(box.top).toBeLessThan(740);
  });

  // ── The 320px contract ────────────────────────────────────────
  // Every anchor the tour points at, at the narrowest supported viewport.
  // Asserted on the computed numbers rather than scrollWidth: an overflowing
  // fixed element grows window.innerWidth in jsdom, so a width-based probe
  // reads back its own bug as success.
  describe('at a 320px viewport', () => {
    const VW = 320;

    // Nav is icon-only below bp.tiny: six ~45px buttons across 320px, so the
    // first and last are hard against the edges. Plus the header status chip.
    const anchors = {
      'status chip (right edge of the header)': rect({ left: 262, top: 8, width: 42, height: 42 }),
      'chat nav button (second of six)': rect({ left: 55, top: 60, width: 45, height: 44 }),
      'stats nav button (last, flush right)': rect({ left: 265, top: 60, width: 45, height: 44 }),
      'anchor hard against the left edge': rect({ left: 0, top: 60, width: 45, height: 44 }),
      'anchor wider than the viewport': rect({ left: -20, top: 60, width: 360, height: 44 }),
    };

    for (const [name, anchorRect] of Object.entries(anchors)) {
      it(`keeps the bubble inside the viewport for the ${name}`, () => {
        const box = bubbleBox(anchorRect, VW, 568);
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.left + box.width).toBeLessThanOrEqual(VW);
      });
    }

    it('still uses the full preferred width, which 320px has room for', () => {
      // Documents where the 320px budget actually sits: 280 + 2×8 = 296 < 320,
      // so nothing is squeezed here and the clamp alone does the work. An
      // assertion that the bubble "shrinks to fit" at this width would be
      // vacuously true and would not notice the shrink branch breaking.
      const box = bubbleBox(anchors['chat nav button (second of six)'], VW, 568);
      expect(box.width).toBe(BUBBLE_MAX_WIDTH);
    });
  });

  describe('below the preferred width', () => {
    it('shrinks the bubble so it cannot outgrow the viewport', () => {
      // 264 = 280 preferred, capped at 280 - 2×8. This is the branch that makes
      // the component's `maxWidth: calc(100vw - 16px)` guarantee real.
      const box = bubbleBox(rect({ left: 10, top: 40, width: 40, height: 40 }), 280, 568);
      expect(box.width).toBe(280 - GUTTER * 2);
      expect(box.left).toBe(GUTTER);
      expect(box.left + box.width).toBeLessThanOrEqual(280);
    });

    it('keeps a readable width rather than collapsing to the anchor', () => {
      const box = bubbleBox(rect({ left: 10, top: 40, width: 20, height: 20 }), 280, 568);
      expect(box.width).toBeGreaterThan(200);
    });
  });
});

describe('scrimRects', () => {
  it('leaves the anchor uncovered and covers everything else', () => {
    const anchor = rect({ left: 100, top: 100, width: 50, height: 50 });
    const rects = scrimRects(anchor, 1000, 800);

    const covers = (x, y) =>
      rects.some((r) => x >= r.left && x < r.left + r.width && y >= r.top && y < r.top + r.height);

    expect(covers(125, 125)).toBe(false); // centre of the anchor — the spotlight
    expect(covers(10, 10)).toBe(true); // above-left
    expect(covers(500, 400)).toBe(true); // far side
    expect(covers(125, 400)).toBe(true); // directly below the anchor
    expect(covers(125, 10)).toBe(true); // directly above the anchor
  });

  it('never emits a rect with a negative dimension for an off-screen anchor', () => {
    const rects = scrimRects(rect({ left: -50, top: -50, width: 40, height: 40 }), 320, 568);
    // Without this the loop below is vacuously true on an empty array.
    expect(rects).toHaveLength(4);
    for (const r of rects) {
      expect(r.width).toBeGreaterThanOrEqual(0);
      expect(r.height).toBeGreaterThanOrEqual(0);
    }
  });
});
