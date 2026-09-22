import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GodMode from './GodMode';

vi.mock('../../lib/adminApi.js', () => ({
  fetchAdminUsers: vi.fn(),
  fetchUserProgress: vi.fn(),
  adjustUserXp: vi.fn(),
  setUserLeagueTier: vi.fn(),
}));

import {
  fetchAdminUsers,
  fetchUserProgress,
  adjustUserXp,
  setUserLeagueTier,
} from '../../lib/adminApi.js';

const TARGET = {
  userId: 'user-1',
  email: 'learner@example.com',
  handle: 'sam',
  isAdmin: false,
  isSystemAccount: false,
  blockedAt: null,
  providers: ['email'],
};

const OTHER = { ...TARGET, userId: 'user-2', email: 'other@example.com', handle: 'kim' };

const snapshot = (over = {}) => ({
  userId: TARGET.userId,
  handle: 'sam',
  blocked: false,
  periodStart: '2026-09-21',
  totalXp: 420,
  weeklyXp: 35,
  today: { day: '2026-09-23', dayXp: 15, bonusXp: 5 },
  league: { leagueId: 'l1', tier: 1, rank: null, settled: false, result: null, weeklyXp: 35 },
  ...over,
});

const select = async () => {
  render(<GodMode />);
  await userEvent.click(await screen.findByRole('button', { name: /^select$/i }));
  return screen.findByText('420');
};

describe('GodMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchAdminUsers.mockResolvedValue({ items: [TARGET] });
    fetchUserProgress.mockResolvedValue(snapshot());
    adjustUserXp.mockResolvedValue(snapshot({ totalXp: 520, weeklyXp: 135, appliedDelta: 100 }));
    setUserLeagueTier.mockResolvedValue(
      snapshot({ moved: true, league: { ...snapshot().league, tier: 3 } })
    );
  });

  it('shows no editing controls until a user is chosen', async () => {
    render(<GodMode />);
    await screen.findByRole('button', { name: /^select$/i });
    expect(screen.queryByLabelText(/adjust xp/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/force league/i)).not.toBeInTheDocument();
    expect(fetchUserProgress).not.toHaveBeenCalled();
  });

  it('filters the roster locally instead of re-querying the admin lane', async () => {
    fetchAdminUsers.mockResolvedValue({ items: [TARGET, OTHER] });
    render(<GodMode />);
    await screen.findByText(TARGET.email);
    await userEvent.type(screen.getByLabelText(/find a user/i), 'kim');
    expect(screen.getByText(OTHER.email)).toBeInTheDocument();
    expect(screen.queryByText(TARGET.email)).not.toBeInTheDocument();
    expect(fetchAdminUsers).toHaveBeenCalledTimes(1);
  });

  it('loads and shows the selected user’s standing', async () => {
    await select();
    expect(fetchUserProgress).toHaveBeenCalledWith(TARGET.userId);
    expect(screen.getByText('420')).toBeInTheDocument();
    expect(screen.getByText('35')).toBeInTheDocument();
    // `selector` disambiguates the tile from the identically-named
    // <option> in the tier picker below it.
    expect(screen.getByText('Silver', { selector: 'div' })).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('will not arm an XP change until the field holds a real integer', async () => {
    await select();
    const apply = screen.getByRole('button', { name: /^apply$/i });
    expect(apply).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/adjust xp/i), '12abc');
    expect(apply).toBeDisabled();
    await userEvent.clear(screen.getByLabelText(/adjust xp/i));
    await userEvent.type(screen.getByLabelText(/adjust xp/i), '0');
    expect(apply).toBeDisabled();
  });

  it('requires a confirm before any XP is written', async () => {
    await select();
    await userEvent.type(screen.getByLabelText(/adjust xp/i), '100');
    await userEvent.click(screen.getByRole('button', { name: /^apply$/i }));
    expect(adjustUserXp).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /confirm xp/i }));
    expect(adjustUserXp).toHaveBeenCalledWith(TARGET.userId, 100);
    expect(await screen.findByText(/applied \+100 xp/i)).toBeInTheDocument();
    // The panel renders the SERVER's after-picture, never an optimistic guess.
    expect(screen.getByText('520')).toBeInTheDocument();
  });

  it('disarms when the amount changes after arming', async () => {
    await select();
    await userEvent.type(screen.getByLabelText(/adjust xp/i), '100');
    await userEvent.click(screen.getByRole('button', { name: /^apply$/i }));
    await userEvent.type(screen.getByLabelText(/adjust xp/i), '0');
    expect(screen.getByRole('button', { name: /^apply$/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^apply$/i }));
    expect(adjustUserXp).not.toHaveBeenCalled();
  });

  it('reports a clamp rather than claiming the typed amount landed', async () => {
    adjustUserXp.mockResolvedValue(snapshot({ appliedDelta: -15 }));
    await select();
    await userEvent.type(screen.getByLabelText(/adjust xp/i), '-1000');
    await userEvent.click(screen.getByRole('button', { name: /^apply$/i }));
    await userEvent.click(screen.getByRole('button', { name: /confirm xp/i }));
    expect(await screen.findByText(/clamped/i)).toBeInTheDocument();
  });

  it('requires a confirm before a league move, then reports the new tier', async () => {
    await select();
    await userEvent.selectOptions(screen.getByLabelText(/force league/i), '3');
    await userEvent.click(screen.getByRole('button', { name: /^move$/i }));
    expect(setUserLeagueTier).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /confirm move/i }));
    expect(setUserLeagueTier).toHaveBeenCalledWith(TARGET.userId, 3);
    expect(await screen.findByText(/moved to sapphire/i)).toBeInTheDocument();
  });

  it('locks placement once the week has settled', async () => {
    fetchUserProgress.mockResolvedValue(
      snapshot({ league: { ...snapshot().league, rank: 4, settled: true } })
    );
    await select();
    expect(screen.getByRole('button', { name: /^move$/i })).toBeDisabled();
    expect(screen.getByText(/placement is a finished record/i)).toBeInTheDocument();
    expect(screen.getByText('#4')).toBeInTheDocument();
  });

  it('says so when the user is in no league this week', async () => {
    fetchUserProgress.mockResolvedValue(snapshot({ league: null }));
    await select();
    expect(screen.getByText(/not in a league this week/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^move$/i })).not.toBeDisabled();
  });

  it('surfaces a rejected write instead of showing a stale success', async () => {
    adjustUserXp.mockRejectedValue(new Error('Admin only.'));
    await select();
    await userEvent.type(screen.getByLabelText(/adjust xp/i), '100');
    await userEvent.click(screen.getByRole('button', { name: /^apply$/i }));
    await userEvent.click(screen.getByRole('button', { name: /confirm xp/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Admin only.');
    expect(screen.getByText('420')).toBeInTheDocument();
  });
});
