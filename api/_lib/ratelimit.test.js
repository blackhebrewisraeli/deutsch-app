import { describe, it, expect } from 'vitest';
import { createRateLimiter, MemoryStore, clientKey } from './ratelimit.js';

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
