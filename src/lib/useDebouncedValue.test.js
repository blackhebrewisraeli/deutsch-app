import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebouncedValue } from './useDebouncedValue';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useDebouncedValue', () => {
  it('starts at the initial value', () => {
    const { result } = renderHook(() => useDebouncedValue('sam', 300));
    expect(result.current).toBe('sam');
  });

  it('withholds a change until the delay has elapsed', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), {
      initialProps: { v: 'a' },
    });

    rerender({ v: 'ab' });
    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(299));
    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('ab');
  });

  // The whole point: an interrupted burst never emits its intermediate terms.
  it('emits only the last value of a burst', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), {
      initialProps: { v: 's' },
    });

    rerender({ v: 'sa' });
    act(() => vi.advanceTimersByTime(100));
    rerender({ v: 'sam' });
    act(() => vi.advanceTimersByTime(100));
    rerender({ v: 'sami' });
    act(() => vi.advanceTimersByTime(300));

    expect(result.current).toBe('sami');
  });

  it('clears its timer on unmount, so nothing is scheduled for a gone box', () => {
    const clear = vi.spyOn(globalThis, 'clearTimeout');
    const { unmount } = renderHook(() => useDebouncedValue('a', 300));
    unmount();
    expect(clear).toHaveBeenCalled();
  });
});
