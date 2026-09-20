import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  // At 320px the avatar owns half the identity band, so the greeting has a
  // measured 77px of track — 36px display type broke "Guten Tag" into three
  // lines and split the word mid-syllable. The display face steps down with
  // the space it has, the same way Heading size="display" does.
  it.each([
    [1280, FONT_SIZE['4xl']],
    [375, FONT_SIZE['2xl']],
    [320, FONT_SIZE['2xl']],
  ])('sizes the greeting for the track it gets at %spx', (width, expected) => {
    setViewportWidth(width);
    render(<PersonalHub user={user} profile={profile} cefrLevel="a2" score={score} />);
    expect(screen.getByRole('heading', { name: /guten tag, semion/i })).toHaveStyle({
      fontSize: `${expected}px`,
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
    expect(screen.getByText('today-slot').parentElement).toHaveStyle({
      marginTop: `${SPACE[3]}px`,
    });
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

  it('keeps the identity band and recommended well on the compact SPACE stops', () => {
    render(
      <PersonalHub
        user={user}
        profile={profile}
        cefrLevel="a2"
        score={score}
        recommended={<div>recommended-slot</div>}
      />
    );
    expect(screen.getByTestId('home-identity-row')).toHaveStyle({ gap: `${SPACE[4]}px` });
    expect(screen.getByTestId('home-recommended-well')).toHaveStyle({
      marginTop: `${SPACE[4]}px`,
      paddingTop: `${SPACE[3]}px`,
    });
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
  //
  // It no longer carries the one control it used to own either: the "Settings →"
  // link is gone, and the header account bubble is the single door to Profile and
  // Settings. The hub is fully read-only now, which is what the zero-button
  // assertion below pins.
  it('carries no account management, and no controls at all', () => {
    render(<PersonalHub user={user} profile={profile} cefrLevel="a2" score={score} />);
    expect(screen.queryByText(/semion@example\.com/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();

    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /settings/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/settings/i)).not.toBeInTheDocument();
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

// The hub used to gate its Settings link on isAuthConfigured(), because when the
// demo's Supabase project stopped resolving it kept advertising an affordance
// pointing at a backend that no longer existed. The link is gone, so the hub no
// longer reads auth config at all and there is nothing left for it to gate — the
// check now lives only where an account control still does (AccountChip,
// AccountSection). This asserts the hub is INDIFFERENT to a dead backend rather
// than that it reacts to one.
describe('PersonalHub when auth is not configured', () => {
  it('greets identically, having no account affordance to withdraw', async () => {
    vi.resetModules();
    vi.doMock('../lib/auth.js', () => ({ isAuthConfigured: () => false }));
    const { default: Hub } = await import('./PersonalHub');
    render(<Hub user={user} profile={profile} cefrLevel="a2" score={score} />);
    expect(screen.getByRole('heading', { name: /guten tag, semion/i })).toBeInTheDocument();
    expect(screen.getByText(/member since/i)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    vi.doUnmock('../lib/auth.js');
  });
});
