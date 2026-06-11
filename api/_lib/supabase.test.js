import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const load = () => import('./supabase.js');

describe('serviceClient', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns null when the data lane is not configured', async () => {
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    const { serviceClient } = await load();
    expect(serviceClient()).toBeNull();
  });

  it('returns a client with an rpc method when configured', async () => {
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
    const { serviceClient } = await load();
    const client = serviceClient();
    expect(client).not.toBeNull();
    expect(typeof client.rpc).toBe('function');
  });

  it('caches the client across calls', async () => {
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
    const { serviceClient } = await load();
    expect(serviceClient()).toBe(serviceClient());
  });
});
