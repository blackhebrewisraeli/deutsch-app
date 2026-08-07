import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const mockAuth = {
  signInWithOtp: vi.fn(() => Promise.resolve({ data: {}, error: null })),
  verifyOtp: vi.fn(() => Promise.resolve({ data: {}, error: null })),
  signOut: vi.fn(() => Promise.resolve({ error: null })),
  getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
};
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ auth: mockAuth })) }));

describe('auth actions', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.resetModules();
    Object.values(mockAuth).forEach((fn) => fn.mockClear?.());
  });
  afterEach(() => vi.unstubAllEnvs());

  it('signInWithMagicLink sends an OTP with a redirect back to the app', async () => {
    const { signInWithMagicLink } = await import('./auth.js');
    const { error } = await signInWithMagicLink('a@b.com');
    expect(error).toBeNull();
    expect(mockAuth.signInWithOtp).toHaveBeenCalledWith({
      email: 'a@b.com',
      options: { emailRedirectTo: window.location.origin },
    });
  });

  it('verifyCode verifies the 6-digit email token', async () => {
    const { verifyCode } = await import('./auth.js');
    await verifyCode('a@b.com', '123456');
    expect(mockAuth.verifyOtp).toHaveBeenCalledWith({
      email: 'a@b.com',
      token: '123456',
      type: 'email',
    });
  });

  it('signOut delegates to the client', async () => {
    const { signOut } = await import('./auth.js');
    await signOut();
    expect(mockAuth.signOut).toHaveBeenCalled();
  });

  it('actions no-op with an error when auth is not configured', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    vi.resetModules();
    const { signInWithMagicLink } = await import('./auth.js');
    const { error } = await signInWithMagicLink('a@b.com');
    expect(error).toBeTruthy();
    expect(mockAuth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('signOut reports success (not an error) when auth is not configured', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    vi.resetModules();
    const { signOut } = await import('./auth.js');
    const { error } = await signOut();
    expect(error).toBeNull();
    expect(mockAuth.signOut).not.toHaveBeenCalled();
  });

  it('getAccessToken returns the access token from the current session', async () => {
    const sessionMock = vi.fn().mockResolvedValue({
      data: { session: { access_token: 'tok-abc' } },
    });
    mockAuth.getSession = sessionMock;

    const { getAccessToken } = await import('./auth.js');
    const token = await getAccessToken();
    expect(token).toBe('tok-abc');
    expect(sessionMock).toHaveBeenCalled();
  });

  it('getAccessToken returns null when no session exists', async () => {
    const sessionMock = vi.fn().mockResolvedValue({ data: { session: null } });
    mockAuth.getSession = sessionMock;

    const { getAccessToken } = await import('./auth.js');
    const token = await getAccessToken();
    expect(token).toBeNull();
    expect(sessionMock).toHaveBeenCalled();
  });
});

describe('useAuth', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.resetModules();
    Object.values(mockAuth).forEach((fn) => fn.mockClear?.());
  });
  afterEach(() => vi.unstubAllEnvs());

  it('subscribes to auth changes when a persisted session may exist', async () => {
    localStorage.setItem('sb-xcnn-auth-token', JSON.stringify({ access_token: 'x' }));
    const { useAuth } = await import('./auth.js');
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.status).not.toBe('loading'));
    expect(result.current.session).toBeNull();
    expect(mockAuth.onAuthStateChange).toHaveBeenCalled();
    localStorage.clear();
  });

  it('settles a guest as anonymous without loading the client at all', async () => {
    localStorage.clear();
    const { useAuth } = await import('./auth.js');
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    // The whole point of the split: no session to restore, no 207KB chunk.
    expect(mockAuth.onAuthStateChange).not.toHaveBeenCalled();
  });

  it('still subscribes if a guest signs in, which loads the client', async () => {
    localStorage.clear();
    const mod = await import('./auth.js');
    const { result } = renderHook(() => mod.useAuth());
    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    expect(mockAuth.onAuthStateChange).not.toHaveBeenCalled();

    // Signing in is what pulls the client in — the hook must notice and attach,
    // otherwise the UI would never reflect the new session.
    await mod.signInWithMagicLink('a@b.com');
    await waitFor(() => expect(mockAuth.onAuthStateChange).toHaveBeenCalled());
  });

  it('reports status "anonymous" when auth is not configured', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    vi.resetModules();
    const { useAuth } = await import('./auth.js');
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.status).toBe('anonymous'));
  });
});

describe('isAuthConfigured', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is false when the Supabase env vars are absent', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    vi.resetModules();
    const { isAuthConfigured } = await import('./auth.js');
    expect(isAuthConfigured()).toBe(false);
  });

  it('is true when both env vars are present', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.resetModules();
    const { isAuthConfigured } = await import('./auth.js');
    expect(isAuthConfigured()).toBe(true);
  });
});

// The Supabase client is code-split. A guest must settle as anonymous without
// ever fetching that chunk, but no real session may be missed to achieve it.
describe('mayHaveSession', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://xcnn.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.resetModules();
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('is false for a clean guest, so the chunk is never fetched', async () => {
    const { mayHaveSession } = await import('./auth.js');
    expect(mayHaveSession()).toBe(false);
  });

  it('is true when a persisted supabase session key exists', async () => {
    localStorage.setItem('sb-xcnn-auth-token', JSON.stringify({ access_token: 'x' }));
    const { mayHaveSession } = await import('./auth.js');
    expect(mayHaveSession()).toBe(true);
  });

  it('ignores an empty session key', async () => {
    localStorage.setItem('sb-xcnn-auth-token', '');
    const { mayHaveSession } = await import('./auth.js');
    expect(mayHaveSession()).toBe(false);
  });

  it('is true on a PKCE callback, where storage is still empty', async () => {
    window.history.replaceState({}, '', '/?code=abc123');
    const { mayHaveSession } = await import('./auth.js');
    expect(mayHaveSession()).toBe(true);
  });

  it('is true on an implicit-flow callback carried in the hash', async () => {
    window.history.replaceState({}, '', '/#access_token=abc&type=magiclink');
    const { mayHaveSession } = await import('./auth.js');
    expect(mayHaveSession()).toBe(true);
  });

  it('is true when the callback reports an error, so it can be surfaced', async () => {
    window.history.replaceState({}, '', '/?error=access_denied&error_description=expired');
    const { mayHaveSession } = await import('./auth.js');
    expect(mayHaveSession()).toBe(true);
  });

  it('is false when auth is not configured at all', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    vi.resetModules();
    const { mayHaveSession } = await import('./auth.js');
    expect(mayHaveSession()).toBe(false);
  });
});

describe('authCallbackKind', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('returns null on a clean URL', async () => {
    const { authCallbackKind } = await import('./auth.js');
    expect(authCallbackKind()).toBeNull();
  });

  it('returns pending for a PKCE code', async () => {
    window.history.replaceState({}, '', '/?code=abc123');
    const { authCallbackKind } = await import('./auth.js');
    expect(authCallbackKind()).toBe('pending');
  });

  it('returns pending for an implicit magic-link hash', async () => {
    window.history.replaceState({}, '', '/#access_token=abc&type=magiclink');
    const { authCallbackKind } = await import('./auth.js');
    expect(authCallbackKind()).toBe('pending');
  });

  it('returns error for ?error= in the query string', async () => {
    window.history.replaceState({}, '', '/?error=access_denied&error_code=otp_expired');
    const { authCallbackKind } = await import('./auth.js');
    expect(authCallbackKind()).toBe('error');
  });

  it('returns error for an expired-link hash', async () => {
    window.history.replaceState(
      {},
      '',
      '/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'
    );
    const { authCallbackKind } = await import('./auth.js');
    expect(authCallbackKind()).toBe('error');
  });
});
