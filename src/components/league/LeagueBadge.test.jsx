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

  it('states the standing when there is one, in both variants', () => {
    const { rerender } = render(<LeagueBadge tier={1} rank={4} cohortSize={25} />);
    expect(screen.getByTestId('profile-league')).toHaveTextContent('Platz 4 / 25');

    rerender(<LeagueBadge variant="compact" tier={1} rank={4} cohortSize={25} />);
    expect(screen.getByTestId('league-badge-compact')).toHaveTextContent('#4/25');
  });

  it('omits the standing rather than printing a zeroth place', () => {
    // rank is DERIVED from a findIndex, so "not in the list" arrives as 0 —
    // not as a missing prop. "Platz 0 / 25" is worse than no standing at all.
    const { rerender } = render(<LeagueBadge tier={1} rank={0} cohortSize={25} />);
    expect(screen.getByTestId('profile-league')).not.toHaveTextContent(/Platz/);

    rerender(<LeagueBadge tier={1} rank={null} cohortSize={null} />);
    expect(screen.getByTestId('profile-league')).not.toHaveTextContent(/Platz/);
  });

  it('carries the standing in the compact variant’s accessible name', () => {
    // The pill's own text is aria-hidden: "#4/25" beside a shield is legible
    // as a position on screen and meaningless read aloud. A screen reader
    // announcing only the tier would be told the league and not the standing,
    // which is the half that changes during the week.
    render(<LeagueBadge variant="compact" tier={2} rank={4} cohortSize={25} />);
    expect(screen.getByLabelText('Gold League, Platz 4 von 25')).toBeInTheDocument();
  });

  it('names the league alone when the compact badge has no standing', () => {
    render(<LeagueBadge variant="compact" tier={0} />);
    expect(screen.getByLabelText('Bronze League')).toBeInTheDocument();
  });

  it('phrases the win line for zero wins without printing a zero', () => {
    const { rerender } = render(<LeagueBadge tier={0} wins={0} />);
    expect(screen.getByTestId('profile-league')).toHaveTextContent('Noch kein Ligasieg');

    rerender(<LeagueBadge tier={0} wins={3} />);
    expect(screen.getByTestId('profile-league')).toHaveTextContent('3 Ligasiege');
  });

  it('gives the compact variant no card chrome of its own', () => {
    // It sits INSIDE the Home identity card, inline with XP and the streak. A
    // Surface here would be a card inside a card.
    render(<LeagueBadge variant="compact" tier={0} />);
    expect(screen.queryByTestId('profile-league')).toBeNull();
  });
});
