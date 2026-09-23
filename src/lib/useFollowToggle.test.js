import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('./social.js', () => ({
  followUser: vi.fn(),
  unfollowUser: vi.fn(),
}));

import { useFollowToggle } from './useFollowToggle.js';
import { followUser, unfollowUser } from './social.js';

const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const row = (is_following) => ({ user_id: ID, handle: 'sam', is_following });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useFollowToggle', () => {
  it('flips the row immediately, before the server answers', async () => {
    let resolveFollow;
    followUser.mockImplementation(() => new Promise((r) => (resolveFollow = r)));
    let rows = [row(false)];
    const setRows = (updater) => {
      rows = updater(rows);
    };
    const { result } = renderHook(() => useFollowToggle(setRows));

    let pendingResult;
    await act(async () => {
      pendingResult = result.current.toggle(row(false));
    });

    expect(rows[0].is_following).toBe(true);
    expect(result.current.pending[ID]).toBe(true);

    await act(async () => {
      resolveFollow({ is_following: true });
      await pendingResult;
    });

    expect(followUser).toHaveBeenCalledWith(ID);
    expect(result.current.pending[ID]).toBeUndefined();
  });

  it('rolls back and returns the error message on failure', async () => {
    followUser.mockRejectedValue(new Error('Could not follow.'));
    let rows = [row(false)];
    const setRows = (updater) => {
      rows = updater(rows);
    };
    const { result } = renderHook(() => useFollowToggle(setRows));

    let message;
    await act(async () => {
      message = await result.current.toggle(row(false));
    });

    expect(rows[0].is_following).toBe(false);
    expect(message).toBe('Could not follow.');
  });

  it('unfollows when already following', async () => {
    unfollowUser.mockResolvedValue({ is_following: false });
    let rows = [row(true)];
    const setRows = (updater) => {
      rows = updater(rows);
    };
    const { result } = renderHook(() => useFollowToggle(setRows));

    await act(async () => {
      await result.current.toggle(row(true));
    });

    expect(unfollowUser).toHaveBeenCalledWith(ID);
    expect(rows[0].is_following).toBe(false);
  });

  it('falls back to a generic message when the rejection carries no message', async () => {
    followUser.mockRejectedValue(undefined);
    let rows = [row(false)];
    const setRows = (updater) => {
      rows = updater(rows);
    };
    const { result } = renderHook(() => useFollowToggle(setRows));

    let message;
    await act(async () => {
      message = await result.current.toggle(row(false));
    });

    expect(message).toBe('Could not save that.');
  });
});
