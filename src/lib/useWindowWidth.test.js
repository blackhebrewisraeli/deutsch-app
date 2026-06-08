import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWindowWidth, bp, isMobile, isTablet } from './useWindowWidth';

describe('useWindowWidth', () => {
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: originalInnerWidth,
    });
  });

  it('returns the current innerWidth on mount', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 768,
    });
    const { result } = renderHook(() => useWindowWidth());
    expect(result.current).toBe(768);
  });

  it('updates when the window fires resize', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 400,
    });
    const { result } = renderHook(() => useWindowWidth());
    expect(result.current).toBe(400);

    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: 1024,
      });
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(1024);
  });

  it('removes resize listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useWindowWidth());
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    removeSpy.mockRestore();
  });
});

describe('breakpoint helpers', () => {
  it('isMobile treats widths under bp.mobile as mobile', () => {
    expect(isMobile(bp.mobile - 1)).toBe(true);
    expect(isMobile(bp.mobile)).toBe(false);
  });

  it('isTablet treats widths under bp.tablet as tablet-or-smaller', () => {
    expect(isTablet(bp.tablet - 1)).toBe(true);
    expect(isTablet(bp.tablet)).toBe(false);
  });
});
