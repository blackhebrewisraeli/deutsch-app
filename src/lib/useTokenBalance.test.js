import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('./economy.js', async (importOriginal) => ({
  ...(await importOriginal()),
  awardTokens: vi.fn(),
  fetchMyTokens: vi.fn(),
}));

import { awardTokens, fetchMyTokens } from './economy.js';
import { useTokenBalance } from './useTokenBalance.js';

const DAY = '2026-09-23';
const quests = (...done) => ['q1', 'q2', 'q3'].map((id) => ({ id, done: done.includes(id) }));
const render = (initial) =>
  renderHook((props) => useTokenBalance(props), {
    initialProps: { userId: 'u1', todayKey: DAY, quests: initial },
  });

describe('useTokenBalance', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows +10 the moment a quest flips to done, then adopts the server balance', async () => {
    fetchMyTokens.mockResolvedValue(5000);
    let resolveAward;
    awardTokens.mockReturnValue(new Promise((r) => (resolveAward = r)));
    const { result, rerender } = render(quests());
    await waitFor(() => expect(result.current).toBe(5000));

    rerender({ userId: 'u1', todayKey: DAY, quests: quests('q1') });
    expect(result.current).toBe(5010);
    expect(awardTokens).toHaveBeenCalledWith('daily_quest', `${DAY}:q1`);

    // The server is the truth — here it says the cap was already hit.
    await act(async () => resolveAward(5000));
    expect(result.current).toBe(5000);
  });

  it('claims a quest already done at load without the optimistic bump', async () => {
    fetchMyTokens.mockResolvedValue(5030);
    awardTokens.mockResolvedValue(5030);
    const { result } = render(quests('q1'));
    await waitFor(() => expect(awardTokens).toHaveBeenCalledTimes(1));
    expect(result.current).toBe(5030);
  });

  it('pays each quest once, even when a later quest completes', async () => {
    fetchMyTokens.mockResolvedValue(5000);
    awardTokens.mockResolvedValue(5010);
    const { rerender } = render(quests());
    await waitFor(() => expect(fetchMyTokens).toHaveBeenCalled());
    rerender({ userId: 'u1', todayKey: DAY, quests: quests('q1') });
    // The effect re-walks EVERY done quest here; q1 must not be claimed again.
    rerender({ userId: 'u1', todayKey: DAY, quests: quests('q1', 'q2') });
    await waitFor(() => expect(awardTokens).toHaveBeenCalledTimes(2));
    expect(awardTokens.mock.calls.map((c) => c[1])).toEqual([`${DAY}:q1`, `${DAY}:q2`]);
  });

  it('never awards while the balance is unknown (signed out / not migrated)', async () => {
    fetchMyTokens.mockResolvedValue(null);
    const { result } = render(quests('q1', 'q2'));
    await waitFor(() => expect(fetchMyTokens).toHaveBeenCalled());
    expect(result.current).toBeNull();
    expect(awardTokens).not.toHaveBeenCalled();
  });

  it('re-reads the balance when an award fails instead of guessing an undo', async () => {
    fetchMyTokens.mockResolvedValueOnce(5000).mockResolvedValueOnce(5000);
    awardTokens.mockRejectedValue(new Error('network'));
    const { result, rerender } = render(quests());
    await waitFor(() => expect(result.current).toBe(5000));
    rerender({ userId: 'u1', todayKey: DAY, quests: quests('q2') });
    expect(result.current).toBe(5010);
    await waitFor(() => expect(result.current).toBe(5000));
    expect(fetchMyTokens).toHaveBeenCalledTimes(2);
  });
});
