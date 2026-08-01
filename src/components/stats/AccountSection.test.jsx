import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AccountSection from './AccountSection';

vi.mock('../../lib/leagues', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, LEAGUES_ENABLED: true, updateHandle: vi.fn().mockResolvedValue({}) };
});

// See AccountChip.test.jsx: pin the auth-configured state instead of inheriting it
// from whatever .env happens to exist, which differs between a dev box and CI.
vi.mock('../../lib/auth.js', () => ({ isAuthConfigured: () => true }));

const signedIn = { email: 'sam@example.com' };

describe('AccountSection', () => {
  it('prompts guests to sign in', async () => {
    const onSignIn = vi.fn();
    render(
      <AccountSection user={null} onSignIn={onSignIn} onSignOut={() => {}} onDelete={() => {}} />
    );
    await userEvent.click(screen.getByRole('button', { name: /sign in to sync/i }));
    expect(onSignIn).toHaveBeenCalled();
  });

  it('shows the email and a sign-out for signed-in users', async () => {
    const onSignOut = vi.fn();
    render(
      <AccountSection
        user={signedIn}
        onSignIn={() => {}}
        onSignOut={onSignOut}
        onDelete={() => {}}
      />
    );
    expect(screen.getByText('sam@example.com')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(onSignOut).toHaveBeenCalled();
  });

  it('shows last synced when a timestamp is provided', () => {
    render(
      <AccountSection
        user={signedIn}
        onSignIn={() => {}}
        onSignOut={() => {}}
        onDelete={() => {}}
        lastSyncedAt={Date.now() - 120_000}
      />
    );
    expect(screen.getByText(/last synced · 2m ago/i)).toBeInTheDocument();
  });

  it('shows Export and Danger Zone for signed-in users', () => {
    render(
      <AccountSection
        user={signedIn}
        onSignIn={() => {}}
        onSignOut={() => {}}
        onDelete={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: /export my data/i })).toBeInTheDocument();
    expect(screen.getByText(/danger zone/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete account/i })).toBeInTheDocument();
  });

  it('does not show Export or Danger Zone for guests', () => {
    render(
      <AccountSection user={null} onSignIn={() => {}} onSignOut={() => {}} onDelete={() => {}} />
    );
    expect(screen.queryByRole('button', { name: /export my data/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/danger zone/i)).not.toBeInTheDocument();
  });

  it('reveals inline confirmation when Delete account is clicked', async () => {
    render(
      <AccountSection
        user={signedIn}
        onSignIn={() => {}}
        onSignOut={() => {}}
        onDelete={() => {}}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /delete account/i }));
    expect(screen.getByRole('button', { name: /yes, delete everything/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('hides confirmation when Cancel is clicked', async () => {
    render(
      <AccountSection
        user={signedIn}
        onSignIn={() => {}}
        onSignOut={() => {}}
        onDelete={() => {}}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /delete account/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(
      screen.queryByRole('button', { name: /yes, delete everything/i })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete account/i })).toBeInTheDocument();
  });

  it('calls updateHandle with the typed handle when Save is clicked', async () => {
    const { updateHandle } = await import('../../lib/leagues');
    render(
      <AccountSection
        user={signedIn}
        onSignIn={() => {}}
        onSignOut={() => {}}
        onDelete={() => {}}
      />
    );
    await userEvent.type(screen.getByRole('textbox', { name: /handle/i }), 'MyHandle42');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(updateHandle).toHaveBeenCalledWith(expect.objectContaining({ handle: 'MyHandle42' }));
  });

  it('calls onDelete when Yes delete everything is clicked', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <AccountSection
        user={signedIn}
        onSignIn={() => {}}
        onSignOut={() => {}}
        onDelete={onDelete}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /delete account/i }));
    await userEvent.click(screen.getByRole('button', { name: /yes, delete everything/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

// See AccountChip.test.jsx — same production failure. A guest was still shown
// "Sign in to sync →" pointing at a backend that no longer existed.
describe('AccountSection when auth is not configured', () => {
  it('renders nothing for a guest', async () => {
    vi.resetModules();
    vi.doMock('../../lib/auth.js', () => ({ isAuthConfigured: () => false }));
    const { default: Section } = await import('./AccountSection');
    const { container } = render(<Section user={null} onSignIn={() => {}} onSignOut={() => {}} />);
    expect(container).toBeEmptyDOMElement();
    vi.doUnmock('../../lib/auth.js');
  });
});
