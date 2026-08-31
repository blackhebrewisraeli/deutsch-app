import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const authMock = vi.hoisted(() => ({ token: 'tok', supabase: null }));
vi.mock('./auth.js', () => ({
  getAccessToken: () => Promise.resolve(authMock.token),
  getSupabase: () => Promise.resolve(authMock.supabase),
}));

import { fetchMyProfile, updateProfile, PROFILE_COLUMNS } from './profile';

const row = { handle: 'sam', avatar_emoji: '🦊', created_at: 'x' };

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
