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

import LeaderboardSection from './LeaderboardSection.jsx';
import { useAuth } from '../../lib/auth.js';
import { joinLeague, refreshLeague, fetchStandings } from '../../lib/leagues.js';

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
  render(<LeaderboardSection onSelectUser={() => {}} />);
  await waitFor(() => expect(screen.getByText('Rival')).toBeTruthy());
  expect(screen.getByText('Bronze')).toBeTruthy();
});
