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

  it('returns userId, email, and the getUser payload for a valid token', async () => {
    const user = { id: 'uid-1', email: 'a@b.com', email_confirmed_at: '2026-09-18T00:00:00Z' };
    serviceClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user },
          error: null,
        }),
      },
    });
    const result = await requireAuth(makeReq('good-token'));
    expect(result).toEqual({ userId: 'uid-1', email: 'a@b.com', user });
  });

  it('throws server_error when serviceClient is unavailable', async () => {
    serviceClient.mockReturnValue(null);
    await expect(requireAuth(makeReq('any-token'))).rejects.toMatchObject({
      code: 'server_error',
    });
  });
});

describe('requireAuth — signup allowlist', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  const ADMIN = 'esterkinshimon712@gmail.com';
  const STRANGER = 'fateevvl@gmail.com';

  function mockUser(user) {
    serviceClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
    });
  }

  it('does not change current behaviour when SIGNUP_EMAIL_ALLOWLIST is unset', async () => {
    vi.stubEnv('SIGNUP_EMAIL_ALLOWLIST', undefined);
    const user = {
      id: 'uid-stranger',
      email: STRANGER,
      email_confirmed_at: '2026-09-18T00:00:00Z',
    };
    mockUser(user);
    await expect(requireAuth(makeReq('good-token'))).resolves.toEqual({
      userId: 'uid-stranger',
      email: STRANGER,
      user,
    });
  });

  it('does not change current behaviour when SIGNUP_EMAIL_ALLOWLIST is empty', async () => {
    vi.stubEnv('SIGNUP_EMAIL_ALLOWLIST', '  ,  ');
    const user = {
      id: 'uid-stranger',
      email: STRANGER,
      email_confirmed_at: '2026-09-18T00:00:00Z',
    };
    mockUser(user);
    await expect(requireAuth(makeReq('good-token'))).resolves.toMatchObject({
      userId: 'uid-stranger',
      email: STRANGER,
    });
  });

  it('allows a verified admin mailbox when the list is closed', async () => {
    vi.stubEnv('SIGNUP_EMAIL_ALLOWLIST', `${ADMIN},friend@example.com`);
    const user = {
      id: 'uid-admin',
      email: ADMIN,
      email_confirmed_at: '2026-09-18T00:00:00Z',
    };
    mockUser(user);
    await expect(requireAuth(makeReq('good-token'))).resolves.toMatchObject({
      userId: 'uid-admin',
      email: ADMIN,
    });
  });

  it('rejects a verified stranger when the list is closed', async () => {
    vi.stubEnv('SIGNUP_EMAIL_ALLOWLIST', ADMIN);
    mockUser({
      id: 'uid-stranger',
      email: STRANGER,
      email_confirmed_at: '2026-09-18T00:00:00Z',
    });
    await expect(requireAuth(makeReq('good-token'))).rejects.toMatchObject({
      code: 'signup_not_allowed',
      message: /isn't invited to the beta/i,
    });
  });

  it('rejects an unverified match when the list is closed', async () => {
    vi.stubEnv('SIGNUP_EMAIL_ALLOWLIST', ADMIN);
    mockUser({ id: 'uid-admin', email: ADMIN, email_confirmed_at: null });
    await expect(requireAuth(makeReq('good-token'))).rejects.toMatchObject({
      code: 'signup_not_allowed',
    });
  });
});
