import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LevelBadge from './LevelBadge';

describe('LevelBadge', () => {
  it('shows the level number', () => {
    render(<LevelBadge level={7} progress={0.5} rank="Fortgeschritten" />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });
  it('exposes the rank + level via title', () => {
    render(<LevelBadge level={7} progress={0.5} rank="Fortgeschritten" />);
    expect(screen.getByTitle('Fortgeschritten · Level 7')).toBeInTheDocument();
  });
});
