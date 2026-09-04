import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// lessons.js runs FOR REAL — only fetch is stubbed. Mocking the module would
// make "the hook falls back to the warm cache" an assertion about a stub
// rather than about the cache code that actually ships.
import { useLessons } from './useLessons';
import { lessonUnit, respondWith, warmLessonCache } from './lessonsTestHelpers';

const params = { courseCode: 'de', level: 'a1', tab: 'vocab' };

const unit = (id = 'u1') =>
  lessonUnit({ id, exercises: [{ id: 'greet-001', type: 'flashcard', payload: {} }] });

const warmCache = (p, lessons) => warmLessonCache(lessons, p);

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('useLessons', () => {
  it('starts loading on a cold cache, then reports ready', async () => {
    vi.stubGlobal('fetch', respondWith(200, { lessons: [unit()] }));
    const { result } = renderHook(() => useLessons(params));
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.lessons).toHaveLength(1);
  });

  it('an empty track is "empty", never "ready" with zero units', async () => {
    vi.stubGlobal('fetch', respondWith(200, { lessons: [] }));
    const { result } = renderHook(() => useLessons(params));
    await waitFor(() => expect(result.current.status).toBe('empty'));
    expect(result.current.lessons).toEqual([]);
  });

  it('paints the warm cache before the network settles', async () => {
    warmCache(params, [unit()]);
    // A fetch that never resolves: whatever renders is the cache alone.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {}))
    );
    const { result } = renderHook(() => useLessons(params));
    expect(result.current.status).toBe('ready');
    expect(result.current.lessons).toHaveLength(1);
  });

  it('keeps showing cached units when revalidation fails', async () => {
    warmCache(params, [unit()]);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    const { result } = renderHook(() => useLessons(params));
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.status).toBe('ready');
    expect(result.current.lessons).toHaveLength(1);
  });

  it('reports error — not empty — when a cold fetch fails', async () => {
    vi.stubGlobal('fetch', respondWith(500, { error: { code: 'server_error' } }));
    const { result } = renderHook(() => useLessons(params));
    await waitFor(() => expect(result.current.status).toBe('error'));
    // An outage must not be mistaken for "this track has no units yet".
    expect(result.current.lessons).toEqual([]);
  });

  it('refetches when the level changes, and does not show the old level’s units', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ lessons: [unit()] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ lessons: [] }) });
    vi.stubGlobal('fetch', f);

    const { result, rerender } = renderHook((p) => useLessons(p), { initialProps: params });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    rerender({ ...params, level: 'a2' });
    // The frame BEFORE a2's fetch settles: a1's units must already be gone.
    // Asserting only the final state passes with the re-seed deleted, because
    // the network produces the same end state either way.
    expect(result.current.lessons).toEqual([]);
    await waitFor(() => expect(result.current.status).toBe('empty'));
    expect(result.current.lessons).toEqual([]);
    expect(f.mock.calls[1][0]).toContain('level=a2');
  });

  it('a superseded fetch that lands late does not overwrite the current level', async () => {
    // The real hazard the cancelled flag exists for. NOT "setState after
    // unmount": React 18 dropped that warning, so a console.error assertion
    // passes with the guard deleted and proves nothing.
    let settleA1;
    const f = vi
      .fn()
      .mockImplementationOnce(() => new Promise((r) => (settleA1 = r)))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ lessons: [unit('u2')] }),
      });
    vi.stubGlobal('fetch', f);

    const { result, rerender } = renderHook((p) => useLessons(p), { initialProps: params });
    rerender({ ...params, level: 'a2' });
    await waitFor(() => expect(result.current.lessons.map((l) => l.id)).toEqual(['u2']));

    settleA1({ ok: true, status: 200, json: async () => ({ lessons: [unit('u1')] }) });
    await waitFor(() => {});
    expect(result.current.lessons.map((l) => l.id)).toEqual(['u2']);
  });
});
