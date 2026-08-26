// Pure placement maths for the first-run walkthrough.
//
// Kept out of the component and free of the DOM because the 320px contract is
// the whole point of this file: at bp.tiny the nav is six icon-only buttons
// across 320px, so a bubble anchored to the last of them starts 265px from the
// left and would run 200px past the viewport if it were simply centred. The
// assertions that guarantee it does not are arithmetic, so the code they guard
// is arithmetic too — a jsdom `scrollWidth` probe cannot do this job, because
// an overflowing fixed element grows `window.innerWidth` and the probe then
// reads its own bug back as a pass.

/** Minimum breathing room between the bubble and any viewport edge, px. */
export const GUTTER = 8;

/** Preferred bubble width; shrinks on narrow viewports, never grows past this. */
export const BUBBLE_MAX_WIDTH = 280;

/** Space left between the anchor and the bubble, px. */
export const ANCHOR_GAP = 12;

/**
 * Height budget used only to choose above-vs-below. A wrong guess costs a
 * slightly tighter fit, never an overflow — the horizontal clamp is exact and
 * the vertical `top` is floored at GUTTER.
 */
export const BUBBLE_HEIGHT_ESTIMATE = 190;

/** How far the un-dimmed spotlight extends past the anchor, px. */
export const SPOTLIGHT_PAD = 6;

/**
 * Where to put the bubble for a given anchor.
 *
 * @param {{left:number,top:number,right:number,bottom:number,width:number,height:number}} anchor
 * @param {number} viewportWidth
 * @param {number} viewportHeight
 * @returns {{left:number,top:number,width:number,placement:'above'|'below'}}
 */
export function bubbleBox(anchor, viewportWidth, viewportHeight) {
  const width = Math.min(BUBBLE_MAX_WIDTH, viewportWidth - GUTTER * 2);

  // Centre on the anchor, then clamp both edges. `maxLeft` can fall below
  // GUTTER only when the bubble already fills the viewport, in which case both
  // bounds collapse to GUTTER and the clamp still lands inside.
  const centred = anchor.left + anchor.width / 2 - width / 2;
  const maxLeft = Math.max(GUTTER, viewportWidth - width - GUTTER);
  const left = Math.min(Math.max(centred, GUTTER), maxLeft);

  const belowTop = anchor.bottom + ANCHOR_GAP;
  const placement = belowTop + BUBBLE_HEIGHT_ESTIMATE <= viewportHeight ? 'below' : 'above';
  const top =
    placement === 'below'
      ? belowTop
      : Math.max(GUTTER, anchor.top - ANCHOR_GAP - BUBBLE_HEIGHT_ESTIMATE);

  return { left, top, width, placement };
}

/**
 * Four rects that together cover the viewport except for the anchor.
 *
 * Four boxes rather than one scrim with a `clip-path` cut-out: jsdom can assert
 * the position of four elements, and cannot assert a mask at all. The cheaper
 * implementation would be the untestable one.
 *
 * @returns {Array<{top:number,left:number,width:number,height:number}>}
 */
export function scrimRects(anchor, viewportWidth, viewportHeight) {
  const top = Math.max(0, anchor.top - SPOTLIGHT_PAD);
  const bottom = Math.min(viewportHeight, anchor.bottom + SPOTLIGHT_PAD);
  const left = Math.max(0, anchor.left - SPOTLIGHT_PAD);
  const right = Math.min(viewportWidth, anchor.right + SPOTLIGHT_PAD);
  const bandHeight = Math.max(0, bottom - top);

  return [
    { top: 0, left: 0, width: viewportWidth, height: top },
    { top: bottom, left: 0, width: viewportWidth, height: Math.max(0, viewportHeight - bottom) },
    { top, left: 0, width: left, height: bandHeight },
    { top, left: right, width: Math.max(0, viewportWidth - right), height: bandHeight },
  ];
}
