import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PersonalHub from './PersonalHub';
import { FONT_SIZE, SPACE } from '../lib/theme';

const AVATAR_DESKTOP = SPACE[16] * 4;

// isAuthConfigured() reads import.meta.env.VITE_SUPABASE_*, which Vitest loads
// from .env — true on a developer's machine and false in CI. Unmocked, this
// file would assert a different branch depending on where it ran.
vi.mock('../lib/auth.js', () => ({ isAuthConfigured: () => true }));

const setViewportWidth = (width) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
};

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
  beforeEach(() => {
    setViewportWidth(1024);
  });

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

  it('keeps a quiet level and rank, without XP totals or a learned counter', () => {
    render(<PersonalHub user={user} profile={profile} cefrLevel="a2" score={score} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Anfänger')).toBeInTheDocument();
    expect(screen.queryByText(/300 XP total/)).not.toBeInTheDocument();
    expect(screen.queryByText(/XP to next/)).not.toBeInTheDocument();
    expect(screen.queryByText('Learned')).not.toBeInTheDocument();
    expect(screen.queryByText('12')).not.toBeInTheDocument();
  });

  it('keeps daily goal and streak in the same panel as identity', () => {
    render(
      <PersonalHub
        user={user}
        profile={profile}
        cefrLevel="a2"
        score={score}
        streak={4}
        goalPct={0.5}
        goalMet={false}
      />
    );
    expect(screen.getByTitle('Daily goal · 50%')).toBeInTheDocument();
    expect(screen.getByLabelText('Streak 4')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /guten tag, semion/i })).toBeInTheDocument();
  });

  it('paints the avatar as a square that fills its column', () => {
    render(<PersonalHub user={user} profile={profile} cefrLevel="a2" score={score} />);
    const img = document.querySelector('[data-avatar]');
    expect(img).toHaveAttribute('width', String(AVATAR_DESKTOP));
    expect(img).toHaveAttribute('height', String(AVATAR_DESKTOP));
    expect(img).toHaveStyle({ width: '100%', height: '100%' });
    expect(screen.getByTestId('home-identity-avatar')).toHaveStyle({
      width: '100%',
      aspectRatio: '1 / 1',
      minWidth: '0',
    });
  });

  it('lays a large avatar beside identity on a wide viewport', () => {
    setViewportWidth(1280);
    render(<PersonalHub user={user} profile={profile} cefrLevel="a2" score={score} />);
    expect(screen.getByTestId('home-identity-row')).toHaveStyle({
      gridTemplateColumns: `${AVATAR_DESKTOP}px minmax(0, 1fr)`,
    });
  });

  it('gives the avatar half the identity band on a 375px viewport', () => {
    setViewportWidth(375);
    render(<PersonalHub user={user} profile={profile} cefrLevel="a2" score={score} />);
    expect(screen.getByTestId('home-identity-row')).toHaveStyle({
      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    });
  });

  it('keeps the half-band avatar on a 320px viewport', () => {
    setViewportWidth(320);
    render(<PersonalHub user={user} profile={profile} cefrLevel="a2" score={score} />);
    expect(screen.getByTestId('home-identity-row')).toHaveStyle({
      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    });
  });

  it('sizes the greeting and standing numbers as the card display scale', () => {
    render(<PersonalHub user={user} profile={profile} cefrLevel="a2" score={score} streak={4} />);
    expect(screen.getByRole('heading', { name: /guten tag, semion/i })).toHaveStyle({
      fontSize: `${FONT_SIZE['4xl']}px`,
    });
    expect(screen.getByTestId('home-identity-streak')).toHaveStyle({
      fontSize: `${FONT_SIZE['3xl']}px`,
    });
    expect(screen.getByTestId('home-identity-level')).toHaveStyle({
      fontSize: `${FONT_SIZE['3xl']}px`,
    });
    expect(screen.getByTestId('home-identity-level')).toHaveTextContent('3');
  });

  it('drops today under the identity band on a narrow viewport so missions are not half-width', () => {
    setViewportWidth(320);
    render(
      <PersonalHub
        user={user}
        profile={profile}
        cefrLevel="a2"
        score={score}
        today={<div>today-slot</div>}
      />
    );
    expect(screen.getByTestId('home-identity-row')).not.toHaveTextContent('today-slot');
    expect(screen.getByRole('region', { name: /guten tag/i })).toHaveTextContent('today-slot');
  });

  it('keeps today beside the avatar on a wide viewport', () => {
    setViewportWidth(1280);
    render(
      <PersonalHub
        user={user}
        profile={profile}
        cefrLevel="a2"
        score={score}
        today={<div>today-slot</div>}
      />
    );
    expect(screen.getByTestId('home-identity-row')).toHaveTextContent('today-slot');
  });

  it('renders today and recommended slots inside the same surface', () => {
    render(
      <PersonalHub
        user={user}
        profile={profile}
        cefrLevel="a2"
        score={score}
        today={<div>today-slot</div>}
        recommended={<div>recommended-slot</div>}
      />
    );
    const hub = screen.getByRole('region', { name: /guten tag/i });
    expect(hub).toHaveTextContent('today-slot');
    expect(hub).toHaveTextContent('recommended-slot');
    expect(screen.getByTestId('home-recommended-well')).toHaveTextContent('recommended-slot');
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
    expect(greeting).toHaveStyle({ overflowWrap: 'break-word', maxWidth: '100%' });

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
