import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TodaySnapshot from './TodaySnapshot';

const snap = (over) => ({
  exercises: 0,
  accuracy: { correct: 0, almost: 0, wrong: 0 },
  streak: 0,
  ...over,
});

describe('TodaySnapshot', () => {
  it('shows the exercise count and streak', () => {
    render(
      <TodaySnapshot
        snap={snap({ exercises: 12, streak: 5, accuracy: { correct: 8, almost: 2, wrong: 2 } })}
      />
    );
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText(/STREAK 5/)).toBeInTheDocument();
  });

  it('shows the empty state when nothing is graded yet', () => {
    render(<TodaySnapshot snap={snap({ exercises: 0 })} />);
    expect(screen.getByText('No exercises graded yet today.')).toBeInTheDocument();
    expect(document.querySelector('[data-ui="status-note"]')).not.toBeNull();
  });

  it('computes accuracy percentages out of the graded total', () => {
    render(
      <TodaySnapshot
        snap={snap({ exercises: 10, accuracy: { correct: 8, almost: 1, wrong: 1 } })}
      />
    );
    expect(screen.getByText(/✓ 8 \(80%\)/)).toBeInTheDocument();
    expect(screen.getByText(/≈ 1 \(10%\)/)).toBeInTheDocument();
    expect(screen.getByText(/✗ 1 \(10%\)/)).toBeInTheDocument();
  });

  it('uses the singular "exercise" when the count is 1', () => {
    render(<TodaySnapshot snap={snap({ exercises: 1 })} />);
    expect(screen.getByText('exercise')).toBeInTheDocument();
  });
});
