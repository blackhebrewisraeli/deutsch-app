import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SplashScreen from './SplashScreen';

describe('SplashScreen', () => {
  it('renders the brand and all three level options', () => {
    render(<SplashScreen onComplete={() => {}} />);
    expect(screen.getByText('Sprachschule')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Beginner \(A1\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Elementary \(A2\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Intermediate \(B1\)/ })).toBeInTheDocument();
  });

  it.each([
    ['Beginner (A1)', 'a1'],
    ['Elementary (A2)', 'a2'],
    ['Intermediate (B1)', 'b1'],
  ])('selecting %s persists the level and completes onboarding', async (label, level) => {
    const onComplete = vi.fn();
    render(<SplashScreen onComplete={onComplete} />);
    await userEvent.click(
      screen.getByRole('button', { name: new RegExp(`${level.toUpperCase()}`) })
    );
    expect(localStorage.getItem('deutsch-level')).toBe(level);
    expect(localStorage.getItem('deutsch-onboarded')).toBe('1');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(level);
  });

  it('paints the wordmark stripe with the ground token, not the foreground one', () => {
    const { container } = render(<SplashScreen onComplete={() => {}} />);
    const stripe = container.firstChild.firstChild;
    expect(stripe.style.background).toBe('var(--c-ground)');
    expect(stripe.style.background).not.toBe('var(--c-fg)');
  });

  it('renders the wordmark in the foreground token', () => {
    render(<SplashScreen onComplete={() => {}} />);
    const wordmark = screen.getByText('Sprachschule').previousSibling;
    expect(wordmark.style.color).toBe('var(--c-fg)');
  });
});
