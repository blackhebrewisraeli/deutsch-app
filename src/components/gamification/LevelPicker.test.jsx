import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LevelPicker from './LevelPicker';

describe('LevelPicker', () => {
  it('renders the three levels as CEFR codes', () => {
    render(<LevelPicker level="a1" onPick={() => {}} />);
    for (const name of ['A1', 'A2', 'B1']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('group', { name: 'Practice level' })).toBeInTheDocument();
  });

  it('marks only the active level as pressed', () => {
    render(<LevelPicker level="a2" onPick={() => {}} />);
    expect(screen.getByRole('button', { name: 'A2' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'A1' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports the level key, not the option object', async () => {
    const onPick = vi.fn();
    render(<LevelPicker level="a1" onPick={onPick} />);
    await userEvent.click(screen.getByRole('button', { name: 'B1' }));
    expect(onPick).toHaveBeenCalledWith('b1');
  });
});
