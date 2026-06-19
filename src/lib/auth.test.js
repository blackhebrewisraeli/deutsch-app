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
});

describe('useAuth', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.resetModules();
    Object.values(mockAuth).forEach((fn) => fn.mockClear?.());
  });
  afterEach(() => vi.unstubAllEnvs());

  it('starts unauthenticated and subscribes to auth changes', async () => {
    const { useAuth } = await import('./auth.js');
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.status).not.toBe('loading'));
    expect(result.current.session).toBeNull();
    expect(mockAuth.onAuthStateChange).toHaveBeenCalled();
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
