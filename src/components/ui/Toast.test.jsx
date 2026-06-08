import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
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
});
