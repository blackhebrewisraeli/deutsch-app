import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../lib/auth.js', () => ({
  useAuth: vi.fn(),
  getSupabase: vi.fn(),
}));
vi.mock('../../lib/leagues.js', () => ({
  LEAGUES_ENABLED: true,
  TIER_NAMES: ['Bronze', 'Silver', 'Gold', 'Sapphire', 'Ruby'],
  joinLeague: vi.fn(),
  refreshLeague: vi.fn(),
  fetchStandings: vi.fn(),
}));
// leagueZones + leagueCountdown are pure — left un-mocked so the UI exercises
// the same zone logic the settle job uses.

import LeaderboardSection from './LeaderboardSection.jsx';
import { useAuth } from '../../lib/auth.js';
import { joinLeague, refreshLeague, fetchStandings } from '../../lib/leagues.js';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// This week's Monday (UTC), matching the server's currentPeriodStart. Computed
// at run time so the countdown ("Ends in …") is always active — a hardcoded
// period_start rolls into the past and makes weekRemaining report "ended".
const currentMonday = () => {
  const d = new Date();
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = utc.getUTCDay(); // 0=Sun..6=Sat
  utc.setUTCDate(utc.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return utc.toISOString().slice(0, 10);
};

const signIn = (rows, tier = 0) => {
  useAuth.mockReturnValue({ user: { id: 'me' } });
  joinLeague.mockResolvedValue({
    league_id: 'L1',
    tier,
    period_start: currentMonday(),
    handle: 'Me',
  });
  refreshLeague.mockResolvedValue({ weekly_xp: 0 });
  fetchStandings.mockResolvedValue(rows);
};

it('shows the sign-in teaser when signed out', () => {
  useAuth.mockReturnValue({ user: null });
  render(<LeaderboardSection onSelectUser={() => {}} />);
  expect(screen.getByText(/sign in to join/i)).toBeTruthy();
  expect(document.querySelector('[data-ui="status-note"]')).not.toBeNull();
});

it('renders standings, tier, a countdown, and the sparse note for a small league', async () => {
  signIn([
    { user_id: 'me', handle: 'Me', weekly_xp: 30, rank: null },
    { user_id: 'x', handle: 'Rival', weekly_xp: 10, rank: null },
  ]);
  render(<LeaderboardSection onSelectUser={() => {}} />);
  await waitFor(() => expect(screen.getByText('Rival')).toBeTruthy());
  expect(screen.getByText(/Bronze League/)).toBeTruthy();
  expect(screen.getByText(/Ends in/)).toBeTruthy();
  expect(screen.getByText(/still filling up/i)).toBeTruthy();
});

it('shows promotion and relegation zone labels in a full league (no sparse note)', async () => {
  const rows = Array.from({ length: 14 }, (_, i) => ({
    user_id: `u${i}`,
    handle: `User${i}`,
    weekly_xp: 100 - i,
    rank: null,
  }));
  signIn(rows);
  render(<LeaderboardSection onSelectUser={() => {}} />);
  await waitFor(() => expect(screen.getByText('User0')).toBeTruthy());
  expect(screen.getByText(/Promotion/)).toBeTruthy();
  expect(screen.getByText(/Relegation/)).toBeTruthy();
  expect(screen.queryByText(/still filling up/i)).toBeNull();
});

// ── Keyboard reachability ────────────────────────────────────────────────
// The rows used to be `<li onClick>`: clickable with a mouse, invisible to the
// keyboard. These assert the row is a real control, and they assert the
// DENOMINATOR (every row, not just the first) so a regression that leaves one
// row behind can't pass.

const threeRows = [
  { user_id: 'me', handle: 'Me', weekly_xp: 30, rank: null },
  { user_id: 'a', handle: 'Rival A', weekly_xp: 20, rank: null },
  { user_id: 'b', handle: 'Rival B', weekly_xp: 10, rank: null },
];

it('puts every league row in the tab order, in standings order', async () => {
  const user = userEvent.setup();
  signIn(threeRows);
  render(<LeaderboardSection onSelectUser={() => {}} />);
  await waitFor(() => expect(screen.getByText('Rival B')).toBeTruthy());

  const rows = screen.getAllByRole('button');
  expect(rows).toHaveLength(threeRows.length); // the denominator

  for (const row of rows) {
    await user.tab();
    expect(document.activeElement).toBe(row);
  }
});

it.each([
  ['Enter', '{Enter}'],
  ['Space', ' '],
])('activates the focused row with %s', async (_label, keys) => {
  const user = userEvent.setup();
  const onSelectUser = vi.fn();
  signIn(threeRows);
  render(<LeaderboardSection onSelectUser={onSelectUser} />);
  await waitFor(() => expect(screen.getByText('Rival A')).toBeTruthy());

  await user.tab();
  await user.tab(); // second row — 'a'
  await user.keyboard(keys);

  expect(onSelectUser).toHaveBeenCalledTimes(1);
  expect(onSelectUser).toHaveBeenCalledWith('a');
});

it('still selects a row on a mouse click', async () => {
  const user = userEvent.setup();
  const onSelectUser = vi.fn();
  signIn(threeRows);
  render(<LeaderboardSection onSelectUser={onSelectUser} />);
  await waitFor(() => expect(screen.getByText('Rival B')).toBeTruthy());

  await user.click(screen.getByText('Rival B'));
  expect(onSelectUser).toHaveBeenCalledWith('b');
});

it('names each row for a screen reader from its rank, handle, and XP', async () => {
  signIn(threeRows);
  render(<LeaderboardSection onSelectUser={() => {}} />);
  await waitFor(() => expect(screen.getByText('Rival A')).toBeTruthy());

  expect(screen.getByRole('button', { name: /2\.\s*Rival A\s*20 XP/ })).toBeTruthy();
});

// ── Error recovery ───────────────────────────────────────────────────────

it('announces a league load failure and offers a way back', async () => {
  useAuth.mockReturnValue({ user: { id: 'me' } });
  joinLeague.mockRejectedValue(new Error('boom'));
  render(<LeaderboardSection onSelectUser={() => {}} />);

  expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load your league.");
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
});

it('refetches when Retry is pressed', async () => {
  const user = userEvent.setup();
  useAuth.mockReturnValue({ user: { id: 'me' } });
  joinLeague.mockRejectedValueOnce(new Error('boom'));
  joinLeague.mockResolvedValue({
    league_id: 'L1',
    tier: 0,
    period_start: currentMonday(),
    handle: 'Me',
  });
  refreshLeague.mockResolvedValue({ weekly_xp: 0 });
  fetchStandings.mockResolvedValue([{ user_id: 'me', handle: 'Me', weekly_xp: 30, rank: null }]);

  render(<LeaderboardSection onSelectUser={() => {}} />);
  await user.click(await screen.findByRole('button', { name: 'Retry' }));

  // Assert on the recovered UI, not on a call count: the count is an
  // implementation detail and would pass even if the retry re-rendered the
  // same error.
  expect(await screen.findByRole('heading', { name: /League/ })).toBeInTheDocument();
});

it('shows loading feedback between two consecutive failures, not a frozen error', async () => {
  const user = userEvent.setup();
  useAuth.mockReturnValue({ user: { id: 'me' } });

  // The second call's promise is held open deliberately (not
  // mockRejectedValueOnce twice), so we can inspect the DOM at a moment we
  // control: after Retry has fired but before the second failure lands.
  const first = Promise.reject(new Error('boom'));
  first.catch(() => {}); // already handled by the component's own catch below
  let rejectSecond;
  const second = new Promise((_resolve, reject) => {
    rejectSecond = reject;
  });
  joinLeague.mockReturnValueOnce(first).mockReturnValueOnce(second);

  render(<LeaderboardSection onSelectUser={() => {}} />);
  expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load your league.");

  await user.click(screen.getByRole('button', { name: 'Retry' }));

  // The second fetch is still pending — if the stale error state were never
  // cleared, the same alert node would still be here with the same text, and
  // a second failure would change nothing on screen. It must be gone in
  // favour of the loading branch.
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByText(/Loading league/)).toBeTruthy();

  rejectSecond(new Error('boom again'));
  expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load your league.");
});
