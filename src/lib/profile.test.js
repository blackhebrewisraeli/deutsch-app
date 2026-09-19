import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const authMock = vi.hoisted(() => ({ token: 'tok', supabase: null, refreshed: null }));
vi.mock('./auth.js', () => ({
  getAccessToken: () => Promise.resolve(authMock.token),
  getSupabase: () => Promise.resolve(authMock.supabase),
  refreshAccessToken: () => Promise.resolve(authMock.refreshed),
}));

import { fetchMyProfile, updateProfile, PROFILE_COLUMNS, SESSION_EXPIRED_MESSAGE } from './profile';

const row = { handle: 'sam', avatar_path: null, created_at: 'x' };

/** Minimal PostgREST chain: from().select().eq().maybeSingle(). */
function supabaseReturning(result) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { client: { from }, from, select, eq };
}

describe('fetchMyProfile', () => {
  beforeEach(() => {
    authMock.supabase = null;
    authMock.token = 'tok';
  });

  it('reads the caller’s own row', async () => {
    const s = supabaseReturning({ data: row, error: null });
    authMock.supabase = s.client;
    await expect(fetchMyProfile('u1')).resolves.toEqual(row);
    expect(s.from).toHaveBeenCalledWith('profiles');
    expect(s.select).toHaveBeenCalledWith(PROFILE_COLUMNS);
    expect(s.eq).toHaveBeenCalledWith('user_id', 'u1');
  });

  it('never asks for columns it has no business reading', () => {
    expect(PROFILE_COLUMNS).not.toMatch(/user_id/);
    expect(PROFILE_COLUMNS).not.toMatch(/\*/);
    // display_name was dropped: selecting a column nothing reads is dead weight
    // on every profile fetch.
    expect(PROFILE_COLUMNS).not.toMatch(/display_name/);
    expect(PROFILE_COLUMNS).not.toMatch(/avatar_emoji/);
  });

  // Home is the landing tab and renders a greeting either way; an absent
  // backend, session or row must not be an exception there.
  it.each([
    ['no user id', () => fetchMyProfile(null)],
    ['no backend configured', () => fetchMyProfile('u1')],
  ])('resolves null with %s', async (_label, call) => {
    await expect(call()).resolves.toBeNull();
  });

  it('resolves null when the row does not exist yet', async () => {
    authMock.supabase = supabaseReturning({ data: null, error: null }).client;
    await expect(fetchMyProfile('u1')).resolves.toBeNull();
  });

  it('surfaces a real query error rather than pretending there is no profile', async () => {
    authMock.supabase = supabaseReturning({ data: null, error: new Error('rls denied') }).client;
    await expect(fetchMyProfile('u1')).rejects.toThrow(/rls denied/);
  });
});

describe('updateProfile', () => {
  let fetchSpy;
  beforeEach(() => {
    authMock.token = 'tok';
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });
  afterEach(() => fetchSpy.mockRestore());

  it('PATCHes the account endpoint with the token and the patch', async () => {
    fetchSpy.mockResolvedValue({ ok: true, json: () => Promise.resolve(row) });
    await expect(updateProfile({ handle: 'sam' })).resolves.toEqual(row);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/v1/account/profile');
    expect(init.method).toBe('PATCH');
    expect(init.headers.authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body)).toEqual({ handle: 'sam' });
  });

  it('resolves the STORED row, so a rejected handle is never assumed accepted', async () => {
    const stored = { ...row, handle: 'sam' };
    fetchSpy.mockResolvedValue({ ok: true, json: () => Promise.resolve(stored) });
    await expect(updateProfile({ handle: 'wanted' })).resolves.toEqual(stored);
  });

  it('throws the server’s own wording, which is what makes the error fixable', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({ error: { code: 'bad_request', message: 'That handle is taken.' } }),
    });
    await expect(updateProfile({ handle: 'taken' })).rejects.toThrow('That handle is taken.');
  });

  it('falls back to a plain message when the body is unreadable', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 500, json: () => Promise.reject(new Error()) });
    await expect(updateProfile({ handle: 'x' })).rejects.toThrow(/could not save/i);
  });

  it('refuses to call the endpoint without a token', async () => {
    authMock.token = null;
    await expect(updateProfile({ handle: 'x' })).rejects.toThrow(/sign in again/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ── Revoked sessions ────────────────────────────────────────────────
//
// The production failure this covers: Storage accepted the avatar upload
// (it only checks the JWT signature) while the account lane rejected the same
// token, because GoTrue additionally requires the session behind it to exist
// and answered `session_not_found`. The bytes landed; the row never did.
describe('updateProfile when the session has been revoked', () => {
  beforeEach(() => {
    authMock.token = 'stale';
    authMock.refreshed = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const jsonRes = (status, body = {}) => ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });

  it('refreshes once and retries, so a merely-stale token is not an error', async () => {
    authMock.refreshed = 'fresh';
    const stored = { handle: 'sam', avatar_path: 'u1/a.webp', created_at: 'x' };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonRes(401, { error: { message: 'Invalid or expired token.' } }))
      .mockResolvedValueOnce(jsonRes(200, stored));
    vi.stubGlobal('fetch', fetchMock);

    await expect(updateProfile({ avatar_path: 'u1/a.webp' })).resolves.toEqual(stored);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe('Bearer stale');
    expect(fetchMock.mock.calls[1][1].headers.authorization).toBe('Bearer fresh');
  });

  it('says the session expired rather than blaming the save', async () => {
    authMock.refreshed = null; // refresh failed: the session is genuinely gone
    const fetchMock = vi.fn().mockResolvedValue(jsonRes(401, { error: { message: 'nope' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(updateProfile({ avatar_path: 'u1/a.webp' })).rejects.toThrow(
      SESSION_EXPIRED_MESSAGE
    );
    // No retry without a fresh token — a second call with the same dead token
    // can only fail the same way.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives up after ONE retry when the fresh token is rejected too', async () => {
    authMock.refreshed = 'fresh';
    const fetchMock = vi.fn().mockResolvedValue(jsonRes(401, { error: { message: 'nope' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(updateProfile({ handle: 'sam' })).rejects.toThrow(SESSION_EXPIRED_MESSAGE);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not refresh on failures that are not about the session', async () => {
    authMock.refreshed = 'fresh';
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonRes(400, { error: { message: 'That handle is taken.' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(updateProfile({ handle: 'sam' })).rejects.toThrow('That handle is taken.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
