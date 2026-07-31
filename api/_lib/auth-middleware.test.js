import { describe, it, expect, vi, afterEach } from 'vitest';

// Mock serviceClient before importing the module under test
vi.mock('./supabase.js', () => ({
  serviceClient: vi.fn(),
}));

import { requireAuth } from './auth-middleware.js';
import { serviceClient } from './supabase.js';

function makeReq(token) {
  return {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  };
}

describe('requireAuth', () => {
  afterEach(() => vi.clearAllMocks());

  it('throws unauthorized when Authorization header is absent', async () => {
    await expect(requireAuth(makeReq(null))).rejects.toMatchObject({
      code: 'unauthorized',
    });
  });

  it('throws unauthorized when token is invalid', async () => {
    serviceClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'bad' } }),
      },
    });
    await expect(requireAuth(makeReq('bad-token'))).rejects.toMatchObject({
      code: 'unauthorized',
    });
  });

  it('returns userId and email for a valid token', async () => {
    serviceClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'uid-1', email: 'a@b.com' } },
          error: null,
        }),
      },
    });
    const result = await requireAuth(makeReq('good-token'));
    expect(result).toEqual({ userId: 'uid-1', email: 'a@b.com' });
  });

  it('throws server_error when serviceClient is unavailable', async () => {
    serviceClient.mockReturnValue(null);
    await expect(requireAuth(makeReq('any-token'))).rejects.toMatchObject({
      code: 'server_error',
    });
  });
});
