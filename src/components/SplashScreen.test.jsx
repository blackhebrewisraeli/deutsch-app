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

  it('paints the three stripes as the German flag, not the themed ground', () => {
    const { container } = render(<SplashScreen onComplete={() => {}} />);
    const [black, red, gold] = container.firstChild.children;
    expect(black.style.background).toBe('var(--c-flag-black)');
    expect(black.style.background).not.toBe('var(--c-ground)');
    expect(red.style.background).toBe('var(--c-flag-red)');
    expect(gold.style.background).toBe('var(--c-flag-gold)');
  });

  it('puts gold text on the black stripe and charcoal on the gold stripe', () => {
    const { container } = render(<SplashScreen onComplete={() => {}} />);
    const wordmark = screen.getByText('Sprachschule').previousSibling;
    expect(wordmark.style.color).toBe('var(--c-flag-on-black)');
    const motto = screen.getByText(/Lernen/);
    expect(motto.style.color).toBe('var(--c-flag-on-gold)');
    const redStripe = container.firstChild.children[1];
    expect(redStripe.firstChild.style.color).toBe('var(--c-flag-on-red)');
  });

  it('opts into dynamic-viewport sizing', () => {
    const { container } = render(<SplashScreen onComplete={() => {}} />);
    expect(container.firstChild).toHaveClass('entry-screen');
  });

  // The gold stripe is the one that was actually clipped on a real iPhone —
  // it is last, so it is the one the URL bar and home indicator eat first.
  it('pads the last stripe clear of the home indicator', () => {
    const { container } = render(<SplashScreen onComplete={() => {}} />);
    expect(container.firstChild.lastChild).toHaveClass('entry-screen-foot');
  });
});
