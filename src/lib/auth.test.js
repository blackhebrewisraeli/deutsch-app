import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockAuth = {
  signInWithOtp: vi.fn(() => Promise.resolve({ data: {}, error: null })),
  verifyOtp: vi.fn(() => Promise.resolve({ data: {}, error: null })),
  signOut: vi.fn(() => Promise.resolve({ error: null })),
  getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
};
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ auth: mockAuth })) }));

describe('isAuthConfigured', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is false when the Supabase env vars are absent', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
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
