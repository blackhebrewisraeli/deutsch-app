// api/_lib/accountHandler.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./supabase.js', () => ({ serviceClient: vi.fn() }));
vi.mock('./auth-middleware.js', () => ({ requireAuth: vi.fn() }));

import { createAccountHandler } from './accountHandler.js';
import { MemoryStore } from './ratelimit.js';
import { serviceClient } from './supabase.js';
import { requireAuth } from './auth-middleware.js';
import { createRes } from './test-helpers.js';

const USER = { userId: 'uid-1', email: 'a@b.com' };

// Each test gets its own IP: the limiter's MemoryStore counters live for the
// life of the test process (see test-helpers.js).
let ipSeq = 0;
const req = (overrides = {}) => ({
  method: 'DELETE',
  headers: {
    'x-forwarded-for': `10.0.0.${++ipSeq}`,
    authorization: 'Bearer tok',
    ...(overrides.headers ?? {}),
  },
  ...overrides,
});

// Generous quotas so the guard-ordering tests never trip the limiter by accident.
const build = (run, opts = {}) =>
  createAccountHandler({
    method: 'DELETE',
    ipRate: { windowMs: 60_000, max: 100 },
    userRate: { windowMs: 60_000, max: 100 },
    run,
    store: new MemoryStore(),
    ...opts,
  });

describe('createAccountHandler', () => {
  beforeEach(() => {
    requireAuth.mockResolvedValue(USER);
    serviceClient.mockReturnValue({ marker: 'db' });
  });
  afterEach(() => vi.clearAllMocks());

  it('rejects the wrong method before doing any work', async () => {
    const run = vi.fn();
    const res = createRes();
    await build(run)(req({ method: 'GET' }), res);
    expect(res.statusCode).toBe(405);
    expect(run).not.toHaveBeenCalled();
    expect(requireAuth).not.toHaveBeenCalled();
  });

  it('rejects a disallowed Origin before authenticating', async () => {
    const run = vi.fn();
    const res = createRes();
    const handler = build(run, { allowedOrigins: ['https://good.example'] });
    await handler(req({ headers: { origin: 'https://evil.example' } }), res);
    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe('forbidden');
    expect(requireAuth).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it('allows a listed Origin', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const res = createRes();
    const handler = build(run, { allowedOrigins: ['https://good.example'] });
    await handler(req({ headers: { origin: 'https://good.example' } }), res);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('rate limits by IP BEFORE authenticating, so an anonymous flood cannot cost a getUser call', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const handler = createAccountHandler({
      method: 'DELETE',
      ipRate: { windowMs: 60_000, max: 1 },
      userRate: { windowMs: 60_000, max: 100 },
      run,
      store: new MemoryStore(),
    });
    const ip = '10.9.9.9';
    const mk = () => ({
      method: 'DELETE',
      headers: { 'x-forwarded-for': ip, authorization: 'Bearer tok' },
    });

    await handler(mk(), createRes());
    const res2 = createRes();
    await handler(mk(), res2);

    expect(res2.statusCode).toBe(429);
    expect(res2.body.error.code).toBe('rate_limited');
    expect(res2.headers['Retry-After']).toBeDefined();
    // The second request was rejected before requireAuth ran at all.
    expect(requireAuth).toHaveBeenCalledTimes(1);
  });

  it('rate limits per identity, so one user cannot burn the lane from many IPs', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const handler = createAccountHandler({
      method: 'DELETE',
      ipRate: { windowMs: 60_000, max: 100 },
      userRate: { windowMs: 60_000, max: 1 },
      run,
      store: new MemoryStore(),
    });

    // Two different IPs, same authenticated user.
    await handler(req(), createRes());
    const res2 = createRes();
    await handler(req(), res2);

    expect(res2.statusCode).toBe(429);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('returns the auth error code when requireAuth throws', async () => {
    requireAuth.mockRejectedValue({ code: 'unauthorized', message: 'Invalid or expired token.' });
    const run = vi.fn();
    const res = createRes();
    await build(run)(req(), res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
    expect(run).not.toHaveBeenCalled();
  });

  it('returns 500 when the service client is unconfigured', async () => {
    serviceClient.mockReturnValue(null);
    const run = vi.fn();
    const res = createRes();
    await build(run)(req(), res);
    expect(res.statusCode).toBe(500);
    expect(run).not.toHaveBeenCalled();
  });

  it('hands the run function the request, auth and db', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const res = createRes();
    await build(run)(req(), res);
    expect(run).toHaveBeenCalledTimes(1);
    const arg = run.mock.calls[0][0];
    expect(arg.auth).toEqual(USER);
    expect(arg.db).toEqual({ marker: 'db' });
    expect(arg.res).toBe(res);
  });

  it('maps a thrown run error to a 500 envelope and LOGS it with the endpoint and user', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const run = vi.fn().mockRejectedValue(new Error('boom'));
    const res = createRes();
    const handler = build(run, {
      name: 'account.delete',
      failureMessage: 'Failed to delete account.',
    });
    await handler(req(), res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error.message).toBe('Failed to delete account.');

    // Defect (c): the old `catch {}` bound no error, so a failure reached
    // neither the logs nor a human. The message must name the endpoint, the
    // user whose operation failed, and the underlying cause.
    expect(spy).toHaveBeenCalledTimes(1);
    const logged = spy.mock.calls[0].join(' ');
    expect(logged).toContain('account.delete');
    expect(logged).toContain('uid-1');
    expect(logged).toContain('boom');
    spy.mockRestore();
  });
});
