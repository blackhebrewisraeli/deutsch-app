import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';

vi.mock('../../lib/leagues.js', () => ({
  TIER_NAMES: ['Bronze', 'Silver', 'Gold', 'Sapphire', 'Ruby'],
  fetchProfile: vi.fn(),
}));

import ProfileCard from './ProfileCard.jsx';
import { fetchProfile } from '../../lib/leagues.js';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it('renders fetched profile fields', async () => {
  fetchProfile.mockResolvedValue({
    handle: 'Rival',
    avatar_emoji: '🦊',
    tier: 1,
    total_xp: 420,
    longest_streak: 9,
    achievements: [],
  });
  render(<ProfileCard userId="x" onClose={() => {}} />);
  await waitFor(() => expect(screen.getByText('Rival')).toBeTruthy());
  expect(screen.getByText('Silver')).toBeTruthy();
  expect(screen.getByText(/420/)).toBeTruthy();
});

it('calls onClose when the close button is clicked', async () => {
  fetchProfile.mockResolvedValue({
    handle: 'R',
    avatar_emoji: null,
    tier: 0,
    total_xp: 0,
    longest_streak: 0,
    achievements: [],
  });
  const onClose = vi.fn();
  render(<ProfileCard userId="x" onClose={onClose} />);
  await waitFor(() => expect(screen.getByText('R')).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: /close/i }));
  expect(onClose).toHaveBeenCalled();
});
