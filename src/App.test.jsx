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
// The ring is dropped on mobile, so the goal strip has to cover every tab
// there: otherwise Chat, Alphabet and Stats lose the daily-goal signal
// entirely rather than merely relocating it.
describe('header at mobile width', () => {
  const goalStrip = () =>
    // GoalStrip renders "{current} / {target} XP" across several text nodes
    screen.queryByText((_, el) => /^\d+ \/ \d+ XP$/.test((el?.textContent ?? '').trim()), {
      selector: 'div',
    });

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

  it.each(['Chat', 'Alphabet', 'Vocab', 'Translate', 'Stats'])(
    'shows daily-goal progress on the %s tab on mobile',
    async (tabName) => {
      setViewportWidth(375);
      const user = userEvent.setup();
      render(<App />);
      await user.click(
        within(screen.getByRole('navigation')).getByRole('button', { name: tabName })
      );
      expect(goalStrip()).toBeInTheDocument();
    }
  );

  // At 320px (original iPhone SE) the cluster still overflowed by 25px after the
  // ring came out. Nothing else in the header is expendable — the streak block
  // carries the "streak at risk" pulse, which GoalStrip has no equivalent for —
  // so the decorative wordmark scales with the viewport and the chrome tightens,
  // leaving every functional widget in place.
  it('scales the wordmark with the viewport on mobile and tightens the chrome', () => {
    setViewportWidth(375);
    render(<App />);
    const header = screen.getByRole('banner');
    expect(header.style.padding).toBe('12px 10px');
    const wordmark = within(header)
      .getByText(/Deutsch/)
      .closest('div');
    expect(wordmark.style.fontSize).toBe('min(26px, 6.5vw)');
  });

  // The streak block was 111px of the 230px cluster, most of it the caption.
  // Dropping just the caption keeps the flame, the count and the at-risk pulse
  // — the signal GoalStrip does not replicate — while freeing ~70px.
  it('omits the STREAK caption on mobile', () => {
    setViewportWidth(375);
    render(<App />);
    expect(within(screen.getByRole('banner')).queryByText('STREAK')).not.toBeInTheDocument();
  });

  it('keeps the STREAK caption on desktop', () => {
    setViewportWidth(1280);
    render(<App />);
    expect(within(screen.getByRole('banner')).getByText('STREAK')).toBeInTheDocument();
  });

  it('keeps the full-size wordmark and chrome on desktop', () => {
    setViewportWidth(1280);
    render(<App />);
    const header = screen.getByRole('banner');
    expect(header.style.padding).toBe('20px 32px');
    const wordmark = within(header)
      .getByText(/Deutsch/)
      .closest('div');
    expect(wordmark.style.fontSize).toBe('36px');
  });

  // On desktop the header ring carries the signal, so the strip stays scoped to
  // the two practice tabs it was built for.
  it('leaves the strip off the chat tab on desktop, where the ring covers it', () => {
    setViewportWidth(1280);
    render(<App />);
    expect(goalStrip()).not.toBeInTheDocument();
    expect(within(screen.getByRole('banner')).getByTitle(/Daily goal/)).toBeInTheDocument();
  });
});
