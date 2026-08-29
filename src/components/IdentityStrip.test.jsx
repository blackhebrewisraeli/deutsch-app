import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IdentityStrip from './IdentityStrip';

// isAuthConfigured() reads import.meta.env.VITE_SUPABASE_*, which Vitest loads
// from .env — true on a developer's machine and false in CI. Unmocked, this
// file would assert a different branch depending on where it ran.
vi.mock('../lib/auth.js', () => ({ isAuthConfigured: () => true }));

const user = { id: 'u1', email: 'semion@example.com' };
const profile = {
  display_name: 'Semion',
  handle: 'semion',
  avatar_emoji: '🦊',
  created_at: '2026-06-14T10:00:00.000Z',
};

describe('IdentityStrip', () => {
  it('greets a signed-in learner by display name, with handle and join month', () => {
    render(<IdentityStrip user={user} profile={profile} lvl="a2" />);
    expect(screen.getByRole('heading', { name: /guten tag, semion/i })).toBeInTheDocument();
    expect(screen.getByText(/@semion/)).toBeInTheDocument();
    expect(screen.getByText(/member since jun 2026/i)).toBeInTheDocument();
  });

  it('falls back handle → email local-part when there is no display name', () => {
    const { unmount } = render(
      <IdentityStrip user={user} profile={{ ...profile, display_name: null }} lvl="a2" />
    );
    expect(screen.getByRole('heading', { name: /guten tag, semion/i })).toBeInTheDocument();
    unmount();

    render(<IdentityStrip user={user} profile={{}} lvl="a2" />);
    expect(screen.getByRole('heading', { name: /guten tag, semion/i })).toBeInTheDocument();
  });

  it('shows the CEFR level, uppercased and named for a screen reader', () => {
    render(<IdentityStrip user={user} profile={profile} lvl="a2" />);
    expect(screen.getByLabelText(/level a2/i)).toHaveTextContent('A2');
  });

  // Decision E5 keeps account MANAGEMENT off Home. The strip is identity only,
  // so it must never grow an email, a sign-out or a delete control.
  it('carries no account management, only a link into Settings', () => {
    render(<IdentityStrip user={user} profile={profile} lvl="a2" />);
    expect(screen.queryByText(/semion@example\.com/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();

    const controls = screen.getAllByRole('button');
    expect(controls).toHaveLength(1);
    expect(controls[0]).toHaveTextContent(/settings/i);
  });

  it('opens Settings from that link', async () => {
    const onOpenSettings = vi.fn();
    render(
      <IdentityStrip user={user} profile={profile} lvl="a2" onOpenSettings={onOpenSettings} />
    );
    await userEvent.click(screen.getByRole('button', { name: /settings/i }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  // A guest is not a Supabase user at all, so nothing here may imply an account.
  it('greets a guest without implying an account exists', () => {
    render(<IdentityStrip user={null} profile={null} lvl="a1" />);
    expect(screen.getByRole('heading', { name: /guten tag$/i })).toBeInTheDocument();
    expect(screen.queryByText(/member since/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('omits the join line when the profile has no created_at yet', () => {
    render(<IdentityStrip user={user} profile={{ handle: 'semion' }} lvl="a2" />);
    expect(screen.getByText('@semion')).toBeInTheDocument();
    expect(screen.queryByText(/member since/i)).not.toBeInTheDocument();
  });
});

// Same production failure as AccountChip: when the demo's Supabase project
// stopped resolving, surfaces that did not check kept advertising account
// affordances pointing at a backend that no longer existed.
describe('IdentityStrip when auth is not configured', () => {
  it('greets, but offers no Settings link to a dead backend', async () => {
    vi.resetModules();
    vi.doMock('../lib/auth.js', () => ({ isAuthConfigured: () => false }));
    const { default: Strip } = await import('./IdentityStrip');
    render(<Strip user={user} profile={profile} lvl="a2" />);
    expect(screen.getByRole('heading', { name: /guten tag, semion/i })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    vi.doUnmock('../lib/auth.js');
  });
});
