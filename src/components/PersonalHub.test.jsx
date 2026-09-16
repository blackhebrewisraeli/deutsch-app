import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PersonalHub from './PersonalHub';

// isAuthConfigured() reads import.meta.env.VITE_SUPABASE_*, which Vitest loads
// from .env — true on a developer's machine and false in CI. Unmocked, this
// file would assert a different branch depending on where it ran.
vi.mock('../lib/auth.js', () => ({ isAuthConfigured: () => true }));

const user = { id: 'u1', email: 'semion@example.com' };
const profile = {
  display_name: 'Semion',
  handle: 'semion',
  created_at: '2026-06-14T10:00:00.000Z',
};
const score = {
  level: 3,
  rankName: 'Anfänger',
  progress: 0.4,
  xpIntoLevel: 60,
  xpToNext: 150,
  totalXp: 300,
};

describe('PersonalHub', () => {
  it('greets a signed-in learner by handle, with handle and join month', () => {
    render(<PersonalHub user={user} profile={profile} cefrLevel="a2" score={score} />);
    expect(screen.getByRole('heading', { name: /guten tag, semion/i })).toBeInTheDocument();
    expect(screen.getByText(/@semion/)).toBeInTheDocument();
    expect(screen.getByText(/member since jun 2026/i)).toBeInTheDocument();
  });

  it('falls back handle → email local-part when there is no display name', () => {
    const { unmount } = render(
      <PersonalHub
        user={user}
        profile={{ ...profile, display_name: null }}
        cefrLevel="a2"
        score={score}
      />
    );
    expect(screen.getByRole('heading', { name: /guten tag, semion/i })).toBeInTheDocument();
    unmount();

    render(<PersonalHub user={user} profile={{}} cefrLevel="a2" score={score} />);
    expect(screen.getByRole('heading', { name: /guten tag, semion/i })).toBeInTheDocument();
  });

  it('shows the CEFR level, uppercased and named for a screen reader', () => {
    render(<PersonalHub user={user} profile={profile} cefrLevel="a2" score={score} />);
    expect(screen.getByLabelText(/level a2/i)).toHaveTextContent('A2');
  });

  it('renders the score as one picture: level, rank, progress and total', () => {
    render(
      <PersonalHub user={user} profile={profile} cefrLevel="a2" score={score} learnedCount={12} />
    );
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Anfänger')).toBeInTheDocument();
    expect(screen.getByText(/300 XP total/)).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('keeps daily goal and streak in the same panel as identity', () => {
    render(
      <PersonalHub
        user={user}
        profile={profile}
        cefrLevel="a2"
        score={score}
        learnedCount={12}
        streak={4}
        goalPct={0.5}
        goalMet={false}
      />
    );
    expect(screen.getByTitle('Daily goal · 50%')).toBeInTheDocument();
    expect(screen.getByLabelText('Streak 4')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /guten tag, semion/i })).toBeInTheDocument();
  });

  // jsdom has no layout, so overflow is asserted as the styles that let a
  // long token give way: wrap the greeting/rank, ellipsize the @handle line.
  it('constrains a long handle and rank so they cannot push the panel wide', () => {
    const longHandle = 'Maximiliane_Schwarzenberger';
    const longRank = 'Muttersprachler';
    render(
      <PersonalHub
        user={user}
        profile={{ ...profile, handle: longHandle }}
        cefrLevel="a2"
        score={{ ...score, rankName: longRank }}
      />
    );
    const greeting = screen.getByRole('heading', {
      name: new RegExp(`guten tag, ${longHandle}`, 'i'),
    });
    expect(greeting).toHaveStyle({ overflowWrap: 'anywhere', maxWidth: '100%' });

    const rank = screen.getByText(longRank);
    expect(rank).toHaveStyle({ overflowWrap: 'anywhere' });
    expect(rank.style.minWidth).toBe('0');

    const handleLine = screen.getByText(new RegExp(`@${longHandle}`));
    expect(handleLine).toHaveStyle({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    });
  });

  // Decision E5 keeps account MANAGEMENT off Home. The hub is identity +
  // standing, so it must never grow an email, a sign-out or a delete control.
  it('carries no account management, only a link into Settings', () => {
    render(<PersonalHub user={user} profile={profile} cefrLevel="a2" score={score} />);
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
      <PersonalHub
        user={user}
        profile={profile}
        cefrLevel="a2"
        score={score}
        onOpenSettings={onOpenSettings}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /settings/i }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  // A guest is not a Supabase user at all, so nothing here may imply an account.
  it('greets a guest without implying an account exists', () => {
    render(<PersonalHub user={null} profile={null} cefrLevel="a1" score={score} />);
    expect(screen.getByRole('heading', { name: /guten tag$/i })).toBeInTheDocument();
    expect(screen.queryByText(/member since/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('omits the join line when the profile has no created_at yet', () => {
    render(<PersonalHub user={user} profile={{ handle: 'semion' }} cefrLevel="a2" score={score} />);
    expect(screen.getByText('@semion')).toBeInTheDocument();
    expect(screen.queryByText(/member since/i)).not.toBeInTheDocument();
  });
});

// Same production failure as AccountChip: when the demo's Supabase project
// stopped resolving, surfaces that did not check kept advertising account
// affordances pointing at a backend that no longer existed.
describe('PersonalHub when auth is not configured', () => {
  it('greets, but offers no Settings link to a dead backend', async () => {
    vi.resetModules();
    vi.doMock('../lib/auth.js', () => ({ isAuthConfigured: () => false }));
    const { default: Hub } = await import('./PersonalHub');
    render(<Hub user={user} profile={profile} cefrLevel="a2" score={score} />);
    expect(screen.getByRole('heading', { name: /guten tag, semion/i })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    vi.doUnmock('../lib/auth.js');
  });
});
