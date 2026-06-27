import { describe, it, expect, vi, afterEach } from 'vitest';
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
  fetchMyResults: vi.fn(),
}));
vi.mock('../../lib/storage.js', () => ({
  loadState: vi.fn(),
  saveState: vi.fn(),
}));

import LeaderboardSection from './LeaderboardSection.jsx';
import { useAuth, getSupabase } from '../../lib/auth.js';
import { joinLeague, refreshLeague, fetchStandings, fetchMyResults } from '../../lib/leagues.js';
import { loadState, saveState } from '../../lib/storage.js';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it('shows the sign-in teaser when signed out', () => {
  useAuth.mockReturnValue({ user: null });
  render(<LeaderboardSection onSelectUser={() => {}} />);
  expect(screen.getByText(/sign in to join/i)).toBeTruthy();
});

it('renders standings when signed in', async () => {
  useAuth.mockReturnValue({ user: { id: 'me' } });
  joinLeague.mockResolvedValue({
    league_id: 'L1',
    tier: 0,
    period_start: '2026-06-22',
    handle: 'Me',
  });
  refreshLeague.mockResolvedValue({ weekly_xp: 30 });
  fetchStandings.mockResolvedValue([
    { user_id: 'me', handle: 'Me', weekly_xp: 30, rank: null },
    { user_id: 'x', handle: 'Rival', weekly_xp: 10, rank: null },
  ]);
  fetchMyResults.mockResolvedValue([]);
  loadState.mockReturnValue({});
  render(<LeaderboardSection onSelectUser={() => {}} />);
  await waitFor(() => expect(screen.getByText('Rival')).toBeTruthy());
  expect(screen.getByText('Bronze')).toBeTruthy();
});

it('claims winner reward and calls saveState when user is rank-1', async () => {
  useAuth.mockReturnValue({ user: { id: 'me' } });
  joinLeague.mockResolvedValue({
    league_id: 'L1',
    tier: 0,
    period_start: '2026-06-22',
    handle: 'Me',
  });
  refreshLeague.mockResolvedValue({ weekly_xp: 80 });
  fetchStandings.mockResolvedValue([{ user_id: 'me', handle: 'Me', weekly_xp: 80, rank: 1 }]);
  fetchMyResults.mockResolvedValue([{ league_id: 'L1', rank: 1, result: 'promoted' }]);
  loadState.mockReturnValue({});
  render(<LeaderboardSection onSelectUser={() => {}} />);
  await waitFor(() => expect(saveState).toHaveBeenCalled());
  const saved = saveState.mock.calls[0][0];
  expect(saved.stats.leagueWins).toBe(1);
});
