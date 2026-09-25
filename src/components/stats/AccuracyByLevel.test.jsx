import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AccuracyByLevel from './AccuracyByLevel';
import { FONT_SIZE, SPACE } from '../../lib/theme';

const empty = {
  a1: { correct: 0, almost: 0, wrong: 0 },
  a2: { correct: 0, almost: 0, wrong: 0 },
  b1: { correct: 0, almost: 0, wrong: 0 },
};

describe('AccuracyByLevel', () => {
  it('renders all three CEFR level labels', () => {
    render(<AccuracyByLevel byLevel={empty} />);
    expect(screen.getByText('A1')).toBeInTheDocument();
    expect(screen.getByText('A2')).toBeInTheDocument();
    expect(screen.getByText('B1')).toBeInTheDocument();
  });

  it('shows "no data" for every level with no attempts', () => {
    render(<AccuracyByLevel byLevel={empty} />);
    expect(screen.getAllByText('no data')).toHaveLength(3);
  });

  it('counts correct + almost as the success ratio for a level', () => {
    render(<AccuracyByLevel byLevel={{ ...empty, a1: { correct: 7, almost: 1, wrong: 2 } }} />);
    expect(screen.getByText(/8 of 10 \(80%\)/)).toBeInTheDocument();
  });

  it('uses dashboard-scale gaps, labels and progress tracks', () => {
    render(<AccuracyByLevel byLevel={empty} />);
    expect(screen.getByTestId('accuracy-by-level')).toHaveStyle({ gap: `${SPACE[2]}px` });
    expect(screen.getByText('A1').parentElement).toHaveStyle({
      fontSize: `${FONT_SIZE.tag}px`,
    });
    for (const track of screen.getAllByTestId('accuracy-track')) {
      expect(track).toHaveStyle({ height: '6px' });
    }
  });
});
