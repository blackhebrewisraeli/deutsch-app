import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

vi.mock('@vercel/analytics/react', () => ({ Analytics: () => null }));

const TAB_NAMES = ['Chat', 'Alphabet', 'Vocab', 'Translate', 'Stats'];

const setViewportWidth = (width) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
};

describe('App navigation a11y', () => {
  beforeEach(() => {
    // jsdom has no scrollIntoView (ChatTab auto-scrolls on mount)
    Element.prototype.scrollIntoView = vi.fn();
    // Skip the onboarding splash so the main shell renders
    localStorage.setItem('deutsch-onboarded', '1');
  });

  it('desktop nav exposes an accessible name for every tab', () => {
    setViewportWidth(1280);
    render(<App />);
    const nav = within(screen.getByRole('navigation'));
    for (const name of TAB_NAMES) {
      expect(nav.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('mobile icon-only nav buttons keep their accessible names', () => {
    setViewportWidth(375);
    render(<App />);
    const nav = within(screen.getByRole('navigation'));
    for (const name of TAB_NAMES) {
      const button = nav.getByRole('button', { name });
      expect(button).toBeInTheDocument();
      // Icon-only on mobile: the name must come from aria-label, not text
      expect(button).toHaveAttribute('aria-label', name);
    }
  });

  it('marks only the active tab with aria-current', () => {
    setViewportWidth(1280);
    render(<App />);
    const nav = within(screen.getByRole('navigation'));
    expect(nav.getByRole('button', { name: 'Chat' })).toHaveAttribute('aria-current', 'page');
    expect(nav.getByRole('button', { name: 'Stats' })).not.toHaveAttribute('aria-current');
  });
});

// The header held logo + level badge + streak + goal ring + account chip,
// which measured 389px on a 375px phone — a horizontal scroll on every tab.
// The ring duplicates the goal strip rendered under the nav, so it is the one
// element that can go without losing information.
describe('header at mobile width', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    localStorage.setItem('deutsch-onboarded', '1');
  });

  it('drops the goal ring from the header on mobile', () => {
    setViewportWidth(375);
    render(<App />);
    const header = within(screen.getByRole('banner'));
    expect(header.queryByTitle(/Daily goal/)).not.toBeInTheDocument();
  });

  it('keeps the goal ring in the header on desktop', () => {
    setViewportWidth(1280);
    render(<App />);
    const header = within(screen.getByRole('banner'));
    expect(header.getByTitle(/Daily goal/)).toBeInTheDocument();
  });

  // GoalStrip only renders on the vocab and translate tabs, so this is where
  // the dropped ring is genuinely redundant rather than merely absent.
  it('still shows daily-goal progress outside the header on the vocab tab', async () => {
    setViewportWidth(375);
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Vocab' }));
    // GoalStrip renders "{current} / {target} XP" across several text nodes
    expect(
      screen.getByText((_, el) => /^\d+ \/ \d+ XP$/.test((el?.textContent ?? '').trim()), {
        selector: 'div',
      })
    ).toBeInTheDocument();
  });
});
