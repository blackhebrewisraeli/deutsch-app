import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import GoalStrip from './GoalStrip';

describe('GoalStrip', () => {
  it('shows the streak and today XP toward the goal', () => {
    render(<GoalStrip streak={5} current={30} target={50} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('30 / 50 XP')).toBeInTheDocument();
  });
});
