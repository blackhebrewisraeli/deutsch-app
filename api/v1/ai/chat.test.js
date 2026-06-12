import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from './chat.js';
import { createRes, postReq } from '../../_lib/test-helpers.js';

// The route is a module singleton, so its MemoryStore persists across tests —
// every test uses its own client IP to keep quota counters independent.
describe('POST /api/v1/ai/chat', () => {
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubEnv('ALLOWED_ORIGINS', '');
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          status: 200,
          json: () => Promise.resolve({ content: [{ type: 'text', text: 'Hallo!' }] }),
        })
      )
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('forwards a valid conversation turn and returns the upstream payload', async () => {
    const res = createRes();
    await handler(postReq('10.0.0.1'), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.content[0].text).toBe('Hallo!');
  });

  it('rejects malformed bodies with the error envelope', async () => {
    const res = createRes();
    await handler(postReq('10.0.0.2', { body: { model: 'gpt-4' } }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('bad_request');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('enforces the 20-per-5-minutes chat quota per client', async () => {
    const results = [];
    for (let i = 0; i < 21; i++) {
      const res = createRes();
      await handler(postReq('10.0.0.3'), res);
      results.push(res);
    }
    expect(results.slice(0, 20).every((r) => r.statusCode === 200)).toBe(true);
    expect(results[20].statusCode).toBe(429);
    expect(results[20].body.error.code).toBe('rate_limited');
    expect(Number(results[20].headers['Retry-After'])).toBeGreaterThan(0);

    // Another client is unaffected by the exhausted quota.
    const other = createRes();
    await handler(postReq('10.0.0.4'), other);
    expect(other.statusCode).toBe(200);
  });
});
