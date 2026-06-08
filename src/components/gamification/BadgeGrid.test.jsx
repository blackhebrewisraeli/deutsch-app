import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BadgeGrid from './BadgeGrid';

describe('BadgeGrid', () => {
  it('marks earned vs locked badges', () => {
    render(<BadgeGrid achievements={{ streak3: 123 }} />);
    expect(screen.getByText('Drei am Stück')).toBeInTheDocument();
    // 1 earned, the rest (10) locked
    expect(screen.getAllByText('FREIGESCHALTET')).toHaveLength(1);
    expect(screen.getAllByText('GESPERRT')).toHaveLength(10);
  });
});
