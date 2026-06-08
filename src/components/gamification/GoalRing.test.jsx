import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import GoalRing from './GoalRing';

describe('GoalRing', () => {
  it('shows the target emoji while in progress', () => {
    render(<GoalRing pct={0.4} met={false} />);
    expect(screen.getByText('🎯')).toBeInTheDocument();
    expect(screen.getByTitle('Daily goal · 40%')).toBeInTheDocument();
  });
  it('shows a check when met', () => {
    render(<GoalRing pct={1} met />);
    expect(screen.getByText('✓')).toBeInTheDocument();
    expect(screen.getByTitle('Daily goal reached!')).toBeInTheDocument();
  });
});
