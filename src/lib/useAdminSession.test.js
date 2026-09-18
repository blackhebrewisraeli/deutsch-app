import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAdminSession } from './useAdminSession.js';

vi.mock('./adminApi.js', () => ({
  fetchAdminMe: vi.fn(),
}));

import { fetchAdminMe } from './adminApi.js';

describe('useAdminSession', () => {
  beforeEach(() => {
    localStorage.clear();
    fetchAdminMe.mockReset();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it('does not fetch and has no me when signed out', () => {
    const { result } = renderHook(() => useAdminSession(null));
    expect(result.current).toEqual({ status: 'idle', me: null });
    expect(fetchAdminMe).not.toHaveBeenCalled();
  });

  it('loads server flags for a signed-in user', async () => {
    fetchAdminMe.mockResolvedValue({ isAdmin: true, isSystemAccount: true, blocked: false });
    const { result } = renderHook(() => useAdminSession({ id: 'u1', email: 'a@b.com' }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.me).toEqual({
      isAdmin: true,
      isSystemAccount: true,
      blocked: false,
    });
  });

  it('clears me immediately when the user becomes null (sign-out / switch)', async () => {
    fetchAdminMe.mockResolvedValue({ isAdmin: true, isSystemAccount: true, blocked: false });
    const { result, rerender } = renderHook(({ user }) => useAdminSession(user), {
      initialProps: { user: { id: 'u1' } },
    });
    await waitFor(() => expect(result.current.me?.isAdmin).toBe(true));
    rerender({ user: null });
    expect(result.current).toEqual({ status: 'idle', me: null });
  });

  it('does not treat a localStorage flag as admin', async () => {
    localStorage.setItem('isAdmin', 'true');
    localStorage.setItem('role', 'admin');
    fetchAdminMe.mockResolvedValue({ isAdmin: false, isSystemAccount: false, blocked: false });
    const { result } = renderHook(() => useAdminSession({ id: 'u2' }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.me.isAdmin).toBe(false);
  });

  it('fails closed when the probe errors', async () => {
    fetchAdminMe.mockRejectedValue(Object.assign(new Error('nope'), { code: 'forbidden' }));
    const { result } = renderHook(() => useAdminSession({ id: 'u3' }));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.me.isAdmin).toBe(false);
  });
});
