import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import PassportBody from './PassportBody';
import { ACHIEVEMENTS } from '../../lib/gamification';
import { COLORS } from '../../lib/theme.js';

const profile = (over = {}) => ({
  handle: 'Rival',
  avatar_emoji: '🦊',
  avatar_path: null,
  join_year: 2026,
  tier: 1,
  total_xp: 420,
  longest_streak: 9,
  league_wins: 3,
  achievements: [],
  ...over,
});

const show = (over = {}, props = {}) =>
  render(<PassportBody profile={profile(over)} userId="u1" {...props} />);

describe('PassportBody — identity', () => {
  it('names the player and their tier', () => {
    show();
    expect(screen.getByRole('heading', { name: 'Rival' })).toBeInTheDocument();
    expect(screen.getByText(/Silver/)).toBeInTheDocument();
  });

  it('shows the join YEAR, never a full date', () => {
    show();
    expect(screen.getByText(/seit 2026/)).toBeInTheDocument();
    // A precise join date is a fact about a stranger a leaderboard need not publish.
    expect(document.body.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('omits the join line entirely when the year is unknown', () => {
    show({ join_year: null });
    expect(screen.queryByText(/seit/)).not.toBeInTheDocument();
  });

  it('falls back to a name rather than rendering a blank heading', () => {
    show({ handle: null });
    expect(screen.getByRole('heading', { name: /Anonym/ })).toBeInTheDocument();
  });

  it('draws the avatar through the shared resolver', () => {
    show();
    expect(document.querySelector('[data-avatar="emoji"]')).toHaveTextContent('🦊');
  });

  it('prefers an uploaded picture over the emoji', () => {
    show({ avatar_path: 'u1/a.webp', avatar_emoji: '🦊' });
    // Only asserts which TIER won; the URL itself is avatar.js's contract.
    expect(document.querySelector('[data-avatar="emoji"]')).toBeNull();
  });
});

describe('PassportBody — self vs competitor', () => {
  it('marks your own passport', () => {
    show({}, { isSelf: true });
    expect(screen.getByText(/this is you/i)).toBeInTheDocument();
  });

  // Caught in a real browser, not in jsdom: accentBlack is documented as
  // "identity chrome that must not invert with the theme" and is #1A1816 in
  // BOTH modes, so a pill using it vanished against the dark card. This guards
  // the token choice, because the symptom is only visible to an eye in dark
  // mode and no unit test renders a theme.
  it('marks you with a token that INVERTS, not the fixed identity black', () => {
    show({}, { isSelf: true });
    const pill = [...document.querySelectorAll('div')].find((d) => d.textContent === 'This is you');
    expect(pill).toBeTruthy();
    expect(pill.style.background).not.toBe(COLORS.accentBlack);
    expect(pill.style.background).toBe(COLORS.surface2);
  });

  it('does not mark someone else’s', () => {
    show();
    expect(screen.queryByText(/this is you/i)).not.toBeInTheDocument();
  });

  // The numbers must not depend on who is reading. A passport that showed
  // different FACTS to different viewers would be two components in one.
  it('shows the SAME figures either way', () => {
    const { unmount } = show({}, { isSelf: true });
    const mine = screen.getByText('420').textContent;
    unmount();
    show();
    expect(screen.getByText('420').textContent).toBe(mine);
  });
});

describe('PassportBody — stats', () => {
  it('shows lifetime XP, longest streak and league wins', () => {
    show();
    expect(screen.getByText('420')).toBeInTheDocument();
    expect(screen.getByText('9d')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders zeros rather than blanks for a brand-new player', () => {
    show({ total_xp: 0, longest_streak: 0, league_wins: 0, join_year: null });
    expect(screen.getByText('0d')).toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(2);
  });

  it('survives a row with the fields missing entirely', () => {
    render(<PassportBody profile={{ tier: 0 }} userId="u1" />);
    expect(screen.getByText('0d')).toBeInTheDocument();
  });
});

describe('PassportBody — badges', () => {
  const first = ACHIEVEMENTS[0];
  const second = ACHIEVEMENTS[1];

  it('renders an earned badge with its name', () => {
    show({ achievements: [first.id] });
    const badge = document.querySelector(`[data-badge="${first.id}"]`);
    expect(badge).toBeTruthy();
    expect(badge).toHaveTextContent(first.name);
  });

  it('counts them', () => {
    show({ achievements: [first.id, second.id] });
    expect(screen.getByText(/Abzeichen · 2/)).toBeInTheDocument();
  });

  it('keeps the order the endpoint sent — oldest earned first', () => {
    show({ achievements: [second.id, first.id] });
    const ids = [...document.querySelectorAll('[data-badge]')].map((n) =>
      n.getAttribute('data-badge')
    );
    expect(ids).toEqual([second.id, first.id]);
  });

  // An older client meeting a badge added after it shipped must not render a
  // blank chip with an empty name.
  it('skips an id it does not recognise', () => {
    show({ achievements: [first.id, 'badge-from-the-future'] });
    expect(document.querySelectorAll('[data-badge]')).toHaveLength(1);
    expect(screen.getByText(/Abzeichen · 1/)).toBeInTheDocument();
  });

  it('says so when there are none, and differently for yourself', () => {
    show({ achievements: [] });
    expect(screen.getByText(/noch keine abzeichen/i)).toBeInTheDocument();
  });

  it('encourages you on your own empty passport', () => {
    show({ achievements: [] }, { isSelf: true });
    expect(screen.getByText(/üben lohnt sich/i)).toBeInTheDocument();
  });

  it('tolerates a missing achievements array', () => {
    render(<PassportBody profile={{ tier: 0, handle: 'x' }} userId="u1" />);
    expect(screen.getByText(/noch keine abzeichen/i)).toBeInTheDocument();
  });

  // The emoji sits beside the name; announcing both would read as
  // "fire fire streak" to a screen reader.
  it('hides the badge emoji from assistive tech', () => {
    show({ achievements: [first.id] });
    const badge = document.querySelector(`[data-badge="${first.id}"]`);
    expect(within(badge).getByText(first.icon)).toHaveAttribute('aria-hidden', 'true');
  });
});
