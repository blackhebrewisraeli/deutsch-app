import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BadgeGrid from './BadgeGrid';
import { ACHIEVEMENTS } from '../../lib/gamification';

describe('BadgeGrid', () => {
  it('marks earned vs locked badges', () => {
    render(<BadgeGrid achievements={{ streak3: 123 }} />);
    expect(screen.getByText('Drei am Stück')).toBeInTheDocument();
    // Derived from the catalogue, not hardcoded: a literal count goes stale
    // every time a badge is added, which is exactly what happened here.
    expect(ACHIEVEMENTS.length).toBeGreaterThan(1);
    expect(screen.getAllByText('FREIGESCHALTET')).toHaveLength(1);
    expect(screen.getAllByText('GESPERRT')).toHaveLength(ACHIEVEMENTS.length - 1);
  });
});
