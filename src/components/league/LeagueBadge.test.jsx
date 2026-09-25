import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LeagueBadge from './LeagueBadge.jsx';
import { TIER_NAMES } from '../../lib/leagues.js';

describe('LeagueBadge — the one league display', () => {
  it('names every tier it is given', () => {
    TIER_NAMES.forEach((name, tier) => {
      const { unmount } = render(<LeagueBadge tier={tier} />);
      expect(screen.getByTestId('league-badge-tier')).toHaveTextContent(name);
      unmount();
    });
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an out-of-range index', 9],
    ['a negative index', -1],
    ['a non-numeric value', 'gold'],
  ])('reads Bronze for %s', (_label, tier) => {
    // Bronze is the floor every player starts on. Indexing TIER_NAMES raw
    // yields undefined for all five of these, and React renders undefined as
    // NOTHING — a league card with a blank where its tier goes.
    render(<LeagueBadge tier={tier} />);
    expect(screen.getByTestId('league-badge-tier')).toHaveTextContent('Bronze');
  });

  it('shows only the league name even when callers have standing data', () => {
    const { rerender } = render(<LeagueBadge tier={1} rank={4} cohortSize={25} />);
    expect(screen.getByTestId('profile-league')).toHaveTextContent('Silver');
    expect(screen.getByTestId('profile-league')).not.toHaveTextContent(/4|25|Platz/);

    rerender(<LeagueBadge variant="compact" tier={1} rank={4} cohortSize={25} />);
    expect(screen.getByTestId('league-badge-compact')).toHaveTextContent('Silver');
    expect(screen.getByTestId('league-badge-compact')).not.toHaveTextContent(/4|25|#/);
  });

  it('names only the league in the compact variant’s accessible name', () => {
    render(<LeagueBadge variant="compact" tier={2} rank={4} cohortSize={25} />);
    expect(screen.getByLabelText('Gold League')).toBeInTheDocument();
  });

  it('names the league alone when the compact badge has no standing', () => {
    render(<LeagueBadge variant="compact" tier={0} />);
    expect(screen.getByLabelText('Bronze League')).toBeInTheDocument();
  });

  it('gives the compact variant no card chrome of its own', () => {
    // It sits INSIDE the Home identity card, inline with XP and the streak. A
    // Surface here would be a card inside a card.
    render(<LeagueBadge variant="compact" tier={0} />);
    expect(screen.queryByTestId('profile-league')).toBeNull();
  });
});
