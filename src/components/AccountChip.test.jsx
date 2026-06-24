import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AccountChip from './AccountChip';

describe('AccountChip', () => {
  it('shows a Sign in affordance for guests', async () => {
    const onSignIn = vi.fn();
    render(<AccountChip user={null} onSignIn={onSignIn} onSignOut={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(onSignIn).toHaveBeenCalled();
  });

  it('shows the email initial and opens a sheet with sign out for signed-in users', async () => {
    const onSignOut = vi.fn();
    render(
      <AccountChip user={{ email: 'sam@example.com' }} onSignIn={() => {}} onSignOut={onSignOut} />
    );
    const chip = screen.getByRole('button', { name: /account/i });
    expect(chip).toHaveTextContent('S'); // initial
    await userEvent.click(chip);
    expect(screen.getByText('sam@example.com')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(onSignOut).toHaveBeenCalled();
  });

  it('shows a pending-sync dot when sync is queued', () => {
    render(
      <AccountChip
        user={{ email: 'sam@example.com' }}
        onSignIn={() => {}}
        onSignOut={() => {}}
        pending
      />
    );
    expect(screen.getByLabelText(/sync pending/i)).toBeInTheDocument();
  });
});
