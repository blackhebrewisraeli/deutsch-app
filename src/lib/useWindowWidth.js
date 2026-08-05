import { useState, useEffect } from 'react';

/**
 * Returns the current window inner width, updating on resize.
 * Use with the breakpoint helpers below to swap inline styles at each breakpoint.
 *
 * Breakpoints (match common device widths):
 *   mobile  < 640px
 *   tablet  640px – 900px
 *   desktop > 900px
 */
export function useWindowWidth() {
  const [width, setWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return width;
}

export const bp = {
  // Below this the header cannot hold the wordmark AND every functional widget.
  // Was 360 until the ThemeChip joined the cluster and consumed the margin:
  // measured with a populated account (freeze chip present), the header ran
  // 26px over at 360, 15px over at 375 and 4px over at 390, and the page
  // scrolled sideways. The functional cluster is a constant 287px, so hiding
  // the wordmark clears every width from 320 up. Decoration gives way — each
  // widget in the cluster is the only surface for its signal (the freeze count
  // appears nowhere else in the app), while the app name is also in the tab
  // title and on the splash.
  tiny: 414,
  mobile: 640,
  // `mobile` flips at 640, but two pieces of desktop chrome want more room than
  // that: the header with the goal ring measures ~700px, and the chat's
  // 280 + 320 side columns need 712 once gaps and page padding are counted.
  // Both waited on this instead, so 640–719 stops scrolling sideways.
  wide: 720,
  tablet: 900,
};

/** true on the narrowest phones, where decoration has to give way */
export const isTiny = (w) => w < bp.tiny;

/** true when the viewport is phone-sized */
export const isMobile = (w) => w < bp.mobile;

/** true when the viewport is tablet or smaller */
export const isTablet = (w) => w < bp.tablet;
