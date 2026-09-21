import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// The standings table fetches on its own and is covered by its own suite; this
// page only has to PLACE it. Stubbing it keeps these assertions about layout
// rather than about Supabase.
vi.mock('../stats/LeaderboardSection', () => ({
  default: () => <div data-testid="standings">standings</div>,
}));

const leagues = vi.hoisted(() => ({ fetchProfile: vi.fn() }));
vi.mock('../../lib/leagues.js', async (orig) => ({
  ...(await orig()),
  LEAGUES_ENABLED: true,
  fetchProfile: leagues.fetchProfile,
}));

import UserProfile from './UserProfile';

const USER = { id: 'u1', email: 'sam@example.com' };
const ROW = {
  display_name: 'Sam Vimes',
  handle: 'sam',
  avatar_path: null,
  join_year: 2026,
  tier: 2,
  total_xp: 1240,
  longest_streak: 9,
  league_wins: 1,
  followers_count: 3,
  following_count: 5,
  achievements: [],
};

const local = { level: 'b1', streak: 9, xp: 1240 };

beforeEach(() => {
  leagues.fetchProfile.mockResolvedValue(ROW);
});
afterEach(() => vi.clearAllMocks());

describe('UserProfile — the consolidated profile page', () => {
  it('has no internal sub-tab navigation', async () => {
    // The whole point of the redesign: STATS / LEAGUES / SETTINGS were three
    // destinations pretending to be one page. Nothing here may reintroduce a
    // segmented control.
    render(<UserProfile user={USER} local={local} />);
    await screen.findByRole('heading', { name: 'Sam Vimes' });
    for (const label of ['STATS', 'LEAGUES', 'SETTINGS']) {
      expect(screen.queryByRole('button', { name: new RegExp(`^${label}$`, 'i') })).toBeNull();
    }
  });

  it('leads with the identity: name, handle and joined year', async () => {
    render(<UserProfile user={USER} local={local} />);
    expect(await screen.findByRole('heading', { name: 'Sam Vimes' })).toBeInTheDocument();
    expect(screen.getByText('@sam')).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  it('shows the social counts and the progress metrics together', async () => {
    render(<UserProfile user={USER} local={local} />);
    await screen.findByRole('heading', { name: 'Sam Vimes' });
    const metrics = screen.getByTestId('profile-metrics');
    expect(metrics).toHaveTextContent('3');
    expect(metrics).toHaveTextContent('5');
    expect(metrics).toHaveTextContent('1240');
    expect(metrics).toHaveTextContent('9');
    expect(metrics).toHaveTextContent(/B1/i);
  });

  it('places the full standings in the main column, under the league card', async () => {
    render(<UserProfile user={USER} local={local} />);
    await screen.findByTestId('standings');
    const league = screen.getByTestId('profile-league');
    const standings = screen.getByTestId('standings');
    // compareDocumentPosition: FOLLOWING means standings comes after the card.
    expect(
      league.compareDocumentPosition(standings) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('demotes the detailed charts to a secondary section at the bottom', async () => {
    render(
      <UserProfile user={USER} local={local}>
        <div data-testid="detailed">charts</div>
      </UserProfile>
    );
    const standings = await screen.findByTestId('standings');
    const detailed = screen.getByTestId('detailed');
    expect(
      standings.compareDocumentPosition(detailed) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('never fabricates profile data for a guest', async () => {
    // Spec §9. A signed-out visitor gets an explanation and a way in, not a
    // profile full of zeroes that looks like a real but empty account.
    render(<UserProfile user={null} local={local} onSignIn={vi.fn()} />);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByTestId('profile-metrics')).toBeNull();
    expect(leagues.fetchProfile).not.toHaveBeenCalled();
  });

  it('keeps the page usable when the profile fetch fails', async () => {
    leagues.fetchProfile.mockRejectedValue(new Error('offline'));
    render(<UserProfile user={USER} local={local} />);
    // The local numbers come from localStorage and are still true, so a failed
    // social fetch must not blank the whole page.
    //
    // findBy* rather than waitFor(() => expect(...)): it is the same wait with
    // the assertion built in, and it does not put an assertion inside a
    // callback that may run several times.
    const metrics = await screen.findByTestId('profile-metrics');
    expect(metrics).toHaveTextContent('1240');
  });

  it('no grid relies on the implicit auto column', async () => {
    // The bug the previous guard could not see, because it only inspected
    // elements that HAD a grid-template-columns to inspect. A `display: grid`
    // with no template gets ONE implicit column sized `auto` — max-content —
    // so the widest child decides its width. That is how the metrics row
    // pushed this page to 597px inside a 375px viewport: 222px of horizontal
    // overflow, invisible to jsdom because jsdom does no layout.
    //
    // Declaring a template is the structural property jsdom CAN check.
    const { container } = render(<UserProfile user={USER} local={local} />);
    await screen.findByRole('heading', { name: 'Sam Vimes' });
    const grids = [...container.querySelectorAll('[style*="display: grid"]')];
    expect(grids.length).toBeGreaterThan(0);
    for (const el of grids) {
      const style = el.getAttribute('style');
      const declaresTemplate = /grid-template-columns/.test(style);
      const shrinkable = /min-width:\s*0/.test(style);
      // A grid with an explicit width cannot be sized by its content, so the
      // implicit auto column is harmless there — that is the league shield,
      // a fixed 48px disc holding one icon.
      const fixedWidth = /(^|;)\s*width:\s*\d/.test(style);
      expect(
        declaresTemplate || shrinkable || fixedWidth,
        `content-sized grid — "${(el.textContent || '').slice(0, 40)}" — ${style}`
      ).toBe(true);
    }
  });

  it('every shrinkable grid track is minmax(0, 1fr), never a bare 1fr', async () => {
    // AGENTS.md: a bare `1fr` keeps min-width:auto and refuses to shrink,
    // pushing the page wider than a 320px viewport. This has caused mobile
    // overflow in four separate places already.
    const { container } = render(<UserProfile user={USER} local={local} />);
    await screen.findByRole('heading', { name: 'Sam Vimes' });
    const grids = [...container.querySelectorAll('[style*="grid-template-columns"]')];
    expect(grids.length).toBeGreaterThan(0);
    for (const el of grids) {
      const tracks = /grid-template-columns:([^;]*)/.exec(el.getAttribute('style'))?.[1] ?? '';
      // Every 1fr must be wrapped: minmax(0, 1fr). Counting is the reliable
      // test — a regex for "a bare 1fr" matches INSIDE minmax(0, 1fr) too,
      // which is how the first version of this guard failed a correct grid.
      const total = (tracks.match(/1fr/g) ?? []).length;
      // Any explicit minimum is fine — minmax(0, 1fr) or minmax(96px, 1fr).
      // What must never appear is a 1fr that is not inside a minmax at all,
      // or one whose minimum is `auto`: both keep min-width:auto and refuse
      // to shrink. A fixed px minimum still shrinks the TRACK COUNT, because
      // auto-fit drops to fewer columns rather than overflowing.
      const wrapped = (tracks.match(/minmax\(\s*(?!auto)[^,]+,\s*1fr\s*\)/g) ?? []).length;
      expect(total, `unshrinkable 1fr in "${tracks.trim()}"`).toBe(wrapped);
    }
  });
});
