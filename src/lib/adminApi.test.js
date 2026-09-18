import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./auth.js', () => ({
  getAccessToken: vi.fn(),
}));

import { getAccessToken } from './auth.js';
import {
  fetchAdminMe,
  fetchFeedback,
  updateFeedbackStatus,
  deleteFeedback,
  fetchAdminUsers,
  setUserBlocked,
} from './adminApi.js';

describe('adminApi', () => {
  beforeEach(() => {
    getAccessToken.mockResolvedValue('tok');
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ items: [] }),
        })
      )
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('GETs me with the bearer token', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ isAdmin: false, isSystemAccount: false, blocked: false }),
    });
    const me = await fetchAdminMe();
    expect(me.isAdmin).toBe(false);
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/admin?op=me',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ authorization: 'Bearer tok' }),
      })
    );
  });

  it('surfaces a 403 instead of treating the caller as admin', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: { code: 'forbidden', message: 'Admin only.' } }),
    });
    await expect(fetchFeedback()).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('patches and deletes feedback by id', async () => {
    await updateFeedbackStatus('11111111-1111-4111-8111-111111111111', 'handled');
    expect(fetch.mock.calls[0][0]).toBe('/api/v1/admin?op=feedback');
    expect(fetch.mock.calls[0][1].method).toBe('PATCH');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      status: 'handled',
    });

    fetch.mockResolvedValue({ ok: true, status: 204, json: () => Promise.resolve(null) });
    await deleteFeedback('11111111-1111-4111-8111-111111111111');
    expect(fetch.mock.calls[1][1].method).toBe('DELETE');
  });

  it('posts a block update', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ userId: 'u1', blockedAt: 't' }),
    });
    await setUserBlocked('u1', true);
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/admin?op=block',
      expect.objectContaining({ method: 'POST' })
    );
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ userId: 'u1', blocked: true });
  });

  it('loads the user list', async () => {
    await fetchAdminUsers();
    expect(fetch.mock.calls[0][0]).toBe('/api/v1/admin?op=users');
  });
});
