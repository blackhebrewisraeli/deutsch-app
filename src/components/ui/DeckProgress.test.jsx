import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DeckProgress from './DeckProgress';

const deck = (n) => Array.from({ length: n }, (_, i) => ({ id: `c${i}` }));

describe('DeckProgress', () => {
  it('renders nothing for an empty deck', () => {
    const { container } = render(<DeckProgress cards={[]} learnedWords={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders one dot per card at or below the threshold', () => {
    render(<DeckProgress cards={deck(12)} learnedWords={{}} />);
    expect(screen.getAllByTestId('deck-progress-dot')).toHaveLength(12);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('marks learned cards green in the dot strip', () => {
    render(<DeckProgress cards={deck(3)} learnedWords={{ c1: true }} />);
    const dots = screen.getAllByTestId('deck-progress-dot');
    expect(dots[1]).toHaveStyle({ background: 'var(--c-success)' });
    expect(dots[0]).toHaveStyle({ background: 'var(--c-track)' });
  });

  it('switches to a progress bar above the threshold', () => {
    render(<DeckProgress cards={deck(13)} learnedWords={{}} />);
    expect(screen.queryAllByTestId('deck-progress-dot')).toHaveLength(0);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('reports learned count and deck size on the bar', () => {
    render(<DeckProgress cards={deck(100)} learnedWords={{ c0: true, c5: true, c9: true }} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(screen.getByText('3 / 100 LEARNED')).toBeInTheDocument();
  });

  it('ignores learned ids that are not in this deck', () => {
    render(<DeckProgress cards={deck(20)} learnedWords={{ c1: true, 'not-in-deck': true }} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  });
});
