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
  mobile: 640,
  tablet: 900,
};

/** true when the viewport is phone-sized */
export const isMobile = (w) => w < bp.mobile;

/** true when the viewport is tablet or smaller */
export const isTablet = (w) => w < bp.tablet;
