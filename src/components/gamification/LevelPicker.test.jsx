import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LevelPicker from './LevelPicker';

describe('LevelPicker', () => {
  it('renders the three levels with their CEFR codes', () => {
    render(<LevelPicker level="a1" onPick={() => {}} />);
    for (const name of [/BEGINNER/, /ELEMENTARY/, /INTERMEDIATE/]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('group', { name: 'Practice level' })).toBeInTheDocument();
  });

  it('marks only the active level as pressed', () => {
    render(<LevelPicker level="a2" onPick={() => {}} />);
    expect(screen.getByRole('button', { name: /ELEMENTARY/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: /BEGINNER/ })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('reports the level key, not the option object', async () => {
    const onPick = vi.fn();
    render(<LevelPicker level="a1" onPick={onPick} />);
    await userEvent.click(screen.getByRole('button', { name: /INTERMEDIATE/ }));
    expect(onPick).toHaveBeenCalledWith('b1');
  });
});
