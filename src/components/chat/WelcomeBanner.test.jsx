import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WelcomeBanner from './WelcomeBanner';

describe('WelcomeBanner', () => {
  it('explains the exercise model with a dismiss button', () => {
    render(<WelcomeBanner mobile={false} onDismiss={() => {}} />);
    expect(screen.getByText('WILLKOMMEN')).toBeInTheDocument();
    expect(screen.getByText(/Anna gives you a task each round/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'GOT IT →' })).toBeInTheDocument();
  });

  it('calls onDismiss when the button is clicked', async () => {
    const onDismiss = vi.fn();
    render(<WelcomeBanner mobile onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole('button', { name: 'GOT IT →' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
