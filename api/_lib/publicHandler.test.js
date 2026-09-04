import { describe, it, expect, vi } from 'vitest';

vi.mock('./supabase.js', () => ({ serviceClient: vi.fn() }));

import { createPublicHandler } from './publicHandler.js';
import { serviceClient } from './supabase.js';
import { MemoryStore } from './ratelimit.js';
import { createRes } from './test-helpers.js';

let seq = 0;
const req = (over = {}) => {
  seq += 1;
  return {
    method: 'GET',
    headers: { 'x-forwarded-for': `10.1.1.${seq}`, origin: 'https://app.test' },
    query: {},
    ...over,
  };
};

const build = (over = {}) =>
  createPublicHandler({
    method: 'GET',
    ipRate: { max: 60, windowMs: 300000 },
    name: 'content',
    run: async ({ res }) => res.status(200).json({ ok: true }),
    allowedOrigins: ['https://app.test'],
    // Same reason accountHandler.test.js injects this: `serviceClient` is
    // mocked, so defaultStore()'s SupabaseStore branch would wrap whatever
    // fake client a test set and fail every increment() call open. A real
    // MemoryStore lets the rate-limit tests assert the actual counting.
    store: new MemoryStore(),
    ...over,
  });

describe('createPublicHandler', () => {
  it('rejects the wrong method', async () => {
    const res = createRes();
    await build()(req({ method: 'POST' }), res);
    expect(res.statusCode).toBe(405);
    expect(res.body.error.code).toBe('method_not_allowed');
  });

  it('rejects a disallowed origin', async () => {
    const res = createRes();
    await build()(
      req({ headers: { origin: 'https://evil.test', 'x-forwarded-for': '10.9.9.9' } }),
      res
    );
    expect(res.statusCode).toBe(403);
  });

  it('serves a request with no Authorization header — the lane is public', async () => {
    serviceClient.mockReturnValue({});
    const res = createRes();
    await build()(req(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('rate limits by IP', async () => {
    serviceClient.mockReturnValue({});
    const handler = build({ ipRate: { max: 1, windowMs: 300000 } });
    const fixedIp = { headers: { 'x-forwarded-for': '10.2.2.2', origin: 'https://app.test' } };
    await handler(req(fixedIp), createRes());
    const res = createRes();
    await handler(req(fixedIp), res);
    expect(res.statusCode).toBe(429);
    expect(res.headers['Retry-After']).toBeDefined();
  });

  it('500s rather than throwing when the database is not configured', async () => {
    serviceClient.mockReturnValue(null);
    const res = createRes();
    await build()(req(), res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error.code).toBe('server_error');
  });

  it('converts a thrown error into the envelope, and does not leak the message', async () => {
    serviceClient.mockReturnValue({});
    const res = createRes();
    await build({
      run: async () => {
        throw new Error('inner detail');
      },
      failureMessage: 'Content unavailable.',
    })(req(), res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error.message).toBe('Content unavailable.');
    expect(JSON.stringify(res.body)).not.toContain('inner detail');
  });
});
