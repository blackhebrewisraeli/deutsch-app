import { describe, it, expect, vi } from 'vitest';
import { createRateLimiter, MemoryStore, SupabaseStore, clientKey } from './ratelimit.js';

const reqFrom = (ip) => ({ headers: ip ? { 'x-forwarded-for': ip } : {} });

describe('clientKey', () => {
  it('uses the first x-forwarded-for hop', () => {
    expect(clientKey(reqFrom('1.2.3.4, 10.0.0.1'))).toBe('ip:1.2.3.4');
  });

  it('falls back to unknown without the header', () => {
    expect(clientKey(reqFrom(null))).toBe('ip:unknown');
  });
});

describe('createRateLimiter', () => {
  it('allows up to max requests, then blocks with a Retry-After', async () => {
    let t = 0;
    const check = createRateLimiter({
      windowMs: 1000,
      max: 2,
      store: new MemoryStore(),
      now: () => t,
    });
    expect((await check(reqFrom('1.1.1.1'))).allowed).toBe(true);
    expect((await check(reqFrom('1.1.1.1'))).allowed).toBe(true);
    t = 250;
    const blocked = await check(reqFrom('1.1.1.1'));
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(1); // ceil((1000 - 250) / 1000)
  });

  it('resets when the window rolls over', async () => {
    let t = 0;
    const check = createRateLimiter({
      windowMs: 1000,
      max: 1,
      store: new MemoryStore(),
      now: () => t,
    });
    expect((await check(reqFrom('2.2.2.2'))).allowed).toBe(true);
    expect((await check(reqFrom('2.2.2.2'))).allowed).toBe(false);
    t = 1001;
    expect((await check(reqFrom('2.2.2.2'))).allowed).toBe(true);
  });

  it('tracks each client key independently', async () => {
    const check = createRateLimiter({
      windowMs: 1000,
      max: 1,
      store: new MemoryStore(),
      now: () => 0,
    });
    expect((await check(reqFrom('3.3.3.3'))).allowed).toBe(true);
    expect((await check(reqFrom('4.4.4.4'))).allowed).toBe(true);
    expect((await check(reqFrom('3.3.3.3'))).allowed).toBe(false);
  });
});

describe('SupabaseStore', () => {
  it('calls the RPC with the right args and returns the count', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: 7, error: null }) };
    const store = new SupabaseStore(client);
    const count = await store.increment('ip:1.1.1.1', 60000);
    expect(client.rpc).toHaveBeenCalledWith('increment_rate_limit', {
      p_key: 'ip:1.1.1.1',
      p_window_start: 60000,
    });
    expect(count).toBe(7);
  });

  it('throws when the RPC reports an error', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'down' } }) };
    const store = new SupabaseStore(client);
    await expect(store.increment('k', 0)).rejects.toThrow('down');
  });

  it('throws when the RPC itself rejects', async () => {
    const client = { rpc: vi.fn().mockRejectedValue(new Error('network')) };
    const store = new SupabaseStore(client);
    await expect(store.increment('k', 0)).rejects.toThrow('network');
  });
});

describe('fail-open behavior', () => {
  it('allows the request and logs when the store throws', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = { increment: vi.fn().mockRejectedValue(new Error('boom')) };
    const check = createRateLimiter({ windowMs: 1000, max: 1, store, now: () => 0 });
    const result = await check({ headers: { 'x-forwarded-for': '1.1.1.1' } });
    expect(result.allowed).toBe(true);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

describe('defaultStore', () => {
  it('picks SupabaseStore when the data lane is configured', async () => {
    vi.resetModules();
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
    const { defaultStore: freshDefaultStore, SupabaseStore: FreshSupabaseStore } =
      await import('./ratelimit.js');
    expect(freshDefaultStore()).toBeInstanceOf(FreshSupabaseStore);
    vi.unstubAllEnvs();
  });

  it('falls back to MemoryStore and warns exactly once when unconfigured', async () => {
    vi.resetModules();
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { defaultStore: freshDefaultStore, MemoryStore: FreshMemoryStore } =
      await import('./ratelimit.js');
    expect(freshDefaultStore()).toBeInstanceOf(FreshMemoryStore);
    freshDefaultStore();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
    vi.unstubAllEnvs();
  });
});
