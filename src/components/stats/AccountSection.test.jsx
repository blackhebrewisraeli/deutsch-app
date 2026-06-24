import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AccountSection from './AccountSection';

describe('AccountSection', () => {
  it('prompts guests to sign in', async () => {
    const onSignIn = vi.fn();
    render(<AccountSection user={null} onSignIn={onSignIn} onSignOut={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /sign in to sync/i }));
    expect(onSignIn).toHaveBeenCalled();
  });

  it('shows the email and a sign-out for signed-in users', async () => {
    const onSignOut = vi.fn();
    render(
      <AccountSection
        user={{ email: 'sam@example.com' }}
        onSignIn={() => {}}
        onSignOut={onSignOut}
      />
    );
    expect(screen.getByText('sam@example.com')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(onSignOut).toHaveBeenCalled();
  });

  it('shows last synced when a timestamp is provided', () => {
    render(
      <AccountSection
        user={{ email: 'sam@example.com' }}
        onSignIn={() => {}}
        onSignOut={() => {}}
        lastSyncedAt={Date.now() - 120_000}
      />
    );
    expect(screen.getByText(/last synced · 2m ago/i)).toBeInTheDocument();
  });
});
