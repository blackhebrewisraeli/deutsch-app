import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ToastStack, { Toast } from './Toast';

afterEach(() => vi.useRealTimers());

describe('Toast', () => {
  it('renders title + sub', () => {
    render(<Toast icon="⭐" title="Level 7" sub="Fortgeschritten" onDone={() => {}} />);
    expect(screen.getByText('Level 7')).toBeInTheDocument();
    expect(screen.getByText('Fortgeschritten')).toBeInTheDocument();
  });
  it('calls onDone after its ttl', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<Toast icon="⭐" title="X" onDone={onDone} ttl={1000} />);
    expect(onDone).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1000));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  // Auto-dismiss alone means the only way to clear a toast is to wait it out.
  // Anyone who reads slower than 3.2s, or who wants the screen back now, had no
  // control at all.
  //
  // NOTE: no fake timers in the click tests below. userEvent.click() hangs for
  // 30s under vi.useFakeTimers() and then skips the timer restore, leaking fake
  // timers into every later test in the file. Real timers + a short assertion
  // is safe because the 3200ms ttl cannot elapse mid-test.
  it('offers a close button with an accessible name', () => {
    render(<Toast icon="⭐" title="Level 7" onDone={() => {}} />);
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
  });

  it('names the specific toast, so stacked toasts are distinguishable', () => {
    render(<Toast icon="⭐" title="Level 7" onDone={() => {}} />);
    expect(screen.getByRole('button', { name: 'Dismiss Level 7' })).toBeInTheDocument();
  });

  it('dismisses immediately when the close button is clicked', async () => {
    const onDone = vi.fn();
    render(<Toast icon="⭐" title="Level 7" onDone={onDone} />);
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('is reachable and operable by keyboard', async () => {
    const onDone = vi.fn();
    render(<Toast icon="⭐" title="Level 7" onDone={onDone} />);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /dismiss/i }));
    await userEvent.keyboard('{Enter}');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  // The emoji is decoration beside a text title; announcing it would read the
  // title twice over.
  it('hides the decorative icon from assistive tech', () => {
    render(<Toast icon="⭐" title="Level 7" onDone={() => {}} />);
    expect(screen.getByText('⭐')).toHaveAttribute('aria-hidden', 'true');
  });

  // The toast plane is COLORS.ink, and the app's focus ring is also ink
  // (var(--c-fg)) — in BOTH modes the plane IS the ring colour, so an ink ring
  // is invisible here. The paired ink for this plane is COLORS.paper.
  it('rings in the ink paired with the toast plane, not the page ink', () => {
    const { container } = render(<Toast icon="⭐" title="Level 7" onDone={() => {}} />);
    const rule = container.querySelector('style')?.textContent ?? '';
    expect(rule).toContain(':focus-visible');
    expect(rule).toContain('var(--c-ground)');
    expect(rule).not.toContain('var(--c-fg)');
  });
});

describe('ToastStack', () => {
  it('renders one toast per item', () => {
    const toasts = [
      { id: 1, icon: '⭐', title: 'A' },
      { id: 2, icon: '🏆', title: 'B' },
    ];
    render(<ToastStack toasts={toasts} onDismiss={() => {}} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('dismisses only the toast whose close button was clicked', async () => {
    const onDismiss = vi.fn();
    const toasts = [
      { id: 1, icon: '⭐', title: 'A' },
      { id: 2, icon: '🏆', title: 'B' },
    ];
    render(<ToastStack toasts={toasts} onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss B' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith(2);
  });

  // The stack sets pointerEvents:'none' so it never blocks the page beneath.
  // Each toast re-enables them — without that the close button is unclickable.
  it('keeps pointer events enabled on the toast itself', () => {
    render(<ToastStack toasts={[{ id: 1, icon: '⭐', title: 'A' }]} onDismiss={() => {}} />);
    const btn = screen.getByRole('button', { name: 'Dismiss A' });
    expect(btn.closest('[style*="pointer-events: auto"]')).not.toBeNull();
  });
});
