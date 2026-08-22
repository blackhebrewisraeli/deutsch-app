import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AccountChip from './AccountChip';

// Pin the auth-configured state rather than inheriting it from the ambient env.
// These tests previously passed locally only because a developer .env happened to
// set VITE_SUPABASE_URL; CI has no .env, so isAuthConfigured() was false there and
// the guest cases below broke. The state under test is now explicit either way.
vi.mock('../lib/auth.js', () => ({ isAuthConfigured: () => true }));

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

  // The sheet used to advertise `aria-haspopup="true"` (menu) over a panel with
  // no role, so a screen reader was told "menu", opened it, and found an
  // unlabelled div. It is a small panel with mixed content — email text plus
  // one action — which is a dialog, not a menu.
  it('advertises and renders a labelled dialog, not a menu', async () => {
    render(<AccountChip user={{ email: 'a@b.co' }} onSignOut={() => {}} />);
    const trigger = screen.getByRole('button', { name: 'Account' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Account' })).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    // A menu was never actually rendered; assert it is not one now either.
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    render(<AccountChip user={{ email: 'a@b.co' }} onSignOut={() => {}} />);
    const trigger = screen.getByRole('button', { name: 'Account' });
    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('closes on an outside click but not on a click inside', async () => {
    render(
      <div>
        <AccountChip user={{ email: 'a@b.co' }} onSignOut={() => {}} />
        <button type="button">elsewhere</button>
      </div>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Account' }));
    // Inside first — a sheet that closes on its own content is unusable.
    await userEvent.click(screen.getByText('a@b.co'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(screen.queryByRole('dialog')).toBeNull();
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

// The account surface must disappear when auth is not configured. Production hit
// this on 2026-08-01: the Supabase project behind the demo stopped resolving, and
// WelcomeGate hid its buttons (it checks isAuthConfigured) while this chip kept
// offering "Sign in" — a dead affordance on the live site.
describe('AccountChip when auth is not configured', () => {
  it('renders nothing for a guest', async () => {
    vi.resetModules();
    vi.doMock('../lib/auth.js', () => ({ isAuthConfigured: () => false }));
    const { default: Chip } = await import('./AccountChip');
    const { container } = render(<Chip user={null} onSignIn={() => {}} onSignOut={() => {}} />);
    expect(container).toBeEmptyDOMElement();
    vi.doUnmock('../lib/auth.js');
  });

  it('still renders for an already signed-in user so they can sign out', async () => {
    vi.resetModules();
    vi.doMock('../lib/auth.js', () => ({ isAuthConfigured: () => false }));
    const { default: Chip } = await import('./AccountChip');
    render(<Chip user={{ email: 'sam@example.com' }} onSignIn={() => {}} onSignOut={() => {}} />);
    expect(screen.getByRole('button', { name: /account/i })).toBeInTheDocument();
    vi.doUnmock('../lib/auth.js');
  });
});
