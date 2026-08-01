import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppearancePicker from './AppearancePicker';

describe('AppearancePicker', () => {
  it('renders System / Light / Dark', () => {
    render(<AppearancePicker mode="system" onPick={() => {}} />);
    expect(screen.getByRole('button', { name: /system/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /light/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dark/i })).toBeInTheDocument();
  });

  it('marks the active mode with aria-pressed', () => {
    render(<AppearancePicker mode="dark" onPick={() => {}} />);
    expect(screen.getByRole('button', { name: /dark/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /light/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onPick with the chosen preference key', async () => {
    const onPick = vi.fn();
    render(<AppearancePicker mode="system" onPick={onPick} />);
    await userEvent.click(screen.getByRole('button', { name: /light/i }));
    expect(onPick).toHaveBeenCalledWith('light');
  });
});
