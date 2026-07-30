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
  // Smallest phones still in use (original iPhone SE is 320px). At this width
  // the header cannot hold the wordmark and every functional widget at once.
  tiny: 360,
  mobile: 640,
  tablet: 900,
};

/** true on the narrowest phones, where decoration has to give way */
export const isTiny = (w) => w < bp.tiny;

/** true when the viewport is phone-sized */
export const isMobile = (w) => w < bp.mobile;

/** true when the viewport is tablet or smaller */
export const isTablet = (w) => w < bp.tablet;
