import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';

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
