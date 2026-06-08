import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GoalPicker from './GoalPicker';

describe('GoalPicker', () => {
  it('renders the three presets', () => {
    render(<GoalPicker goal={50} onPick={() => {}} />);
    expect(screen.getByText('20 XP')).toBeInTheDocument();
    expect(screen.getByText('50 XP')).toBeInTheDocument();
    expect(screen.getByText('100 XP')).toBeInTheDocument();
  });
  it('calls onPick with the chosen XP value', async () => {
    const onPick = vi.fn();
    render(<GoalPicker goal={50} onPick={onPick} />);
    await userEvent.click(screen.getByText('100 XP'));
    expect(onPick).toHaveBeenCalledWith(100);
  });
});
