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

  it('asks for a typed confirmation, not just a second click', async () => {
    render(
      <AccountSection
        user={signedIn}
        onSignIn={() => {}}
        onSignOut={() => {}}
        onDelete={() => {}}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /delete account/i }));
    expect(screen.getByRole('textbox', { name: /type delete to confirm/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    // The old two-step button was a mis-click guard, never an intent guard.
    expect(
      screen.queryByRole('button', { name: /yes, delete everything/i })
    ).not.toBeInTheDocument();
  });

  it('keeps the destructive button disabled until the phrase matches exactly', async () => {
    render(
      <AccountSection
        user={signedIn}
        onSignIn={() => {}}
        onSignOut={() => {}}
        onDelete={() => {}}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /delete account/i }));
    const field = screen.getByRole('textbox', { name: /type delete to confirm/i });
    const confirm = screen.getByRole('button', { name: /permanently delete/i });

    expect(confirm).toBeDisabled();
    await userEvent.type(field, 'delete');
    expect(confirm).toBeDisabled(); // case matters
    await userEvent.clear(field);
    await userEvent.type(field, 'DELETE ME');
    expect(confirm).toBeDisabled();
    await userEvent.clear(field);
    await userEvent.type(field, 'DELETE');
    expect(confirm).toBeEnabled();
  });

  it('tolerates stray whitespace, which phone keyboards add', async () => {
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
    await userEvent.type(
      screen.getByRole('textbox', { name: /type delete to confirm/i }),
      ' DELETE '
    );
    await userEvent.click(screen.getByRole('button', { name: /permanently delete/i }));
    // Trimmed before it leaves the client, so the server sees the exact phrase.
    expect(onDelete).toHaveBeenCalledWith('DELETE');
  });

  it('hides confirmation and forgets the typed phrase when Cancel is clicked', async () => {
    render(
      <AccountSection
        user={signedIn}
        onSignIn={() => {}}
        onSignOut={() => {}}
        onDelete={() => {}}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /delete account/i }));
    await userEvent.type(
      screen.getByRole('textbox', { name: /type delete to confirm/i }),
      'DELETE'
    );
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(
      screen.queryByRole('textbox', { name: /type delete to confirm/i })
    ).not.toBeInTheDocument();

    // Re-opening must not resurrect an armed confirmation.
    await userEvent.click(screen.getByRole('button', { name: /delete account/i }));
    expect(screen.getByRole('textbox', { name: /type delete to confirm/i })).toHaveValue('');
    expect(screen.getByRole('button', { name: /permanently delete/i })).toBeDisabled();
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

  it('calls onDelete with the confirmation phrase', async () => {
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
    await userEvent.type(
      screen.getByRole('textbox', { name: /type delete to confirm/i }),
      'DELETE'
    );
    await userEvent.click(screen.getByRole('button', { name: /permanently delete/i }));
    expect(onDelete).toHaveBeenCalledWith('DELETE');
  });

  // A failed delete (most often reauth_required) must leave the typed phrase in
  // place, so retrying after re-authenticating is one click, not a re-type.
  it('keeps the confirmation armed when onDelete rejects', async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error('reauth_required'));
    render(
      <AccountSection
        user={signedIn}
        onSignIn={() => {}}
        onSignOut={() => {}}
        onDelete={onDelete}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /delete account/i }));
    await userEvent.type(
      screen.getByRole('textbox', { name: /type delete to confirm/i }),
      'DELETE'
    );
    await userEvent.click(screen.getByRole('button', { name: /permanently delete/i }));

    expect(screen.getByRole('textbox', { name: /type delete to confirm/i })).toHaveValue('DELETE');
    expect(screen.getByRole('button', { name: /permanently delete/i })).toBeEnabled();
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
