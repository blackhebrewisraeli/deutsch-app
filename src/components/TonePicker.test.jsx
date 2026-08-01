import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TonePicker from './TonePicker';

describe('TonePicker', () => {
  it('renders Day-light and Night-light', () => {
    render(<TonePicker tone="day" onPick={() => {}} />);
    expect(screen.getByRole('button', { name: /day-light/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /night-light/i })).toBeInTheDocument();
  });

  it('marks the active tone with aria-pressed', () => {
    render(<TonePicker tone="night" onPick={() => {}} />);
    expect(screen.getByRole('button', { name: /night-light/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: /day-light/i })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('calls onPick with the chosen tone key', async () => {
    const onPick = vi.fn();
    render(<TonePicker tone="day" onPick={onPick} />);
    await userEvent.click(screen.getByRole('button', { name: /night-light/i }));
    expect(onPick).toHaveBeenCalledWith('night');
  });
});
