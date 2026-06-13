import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from './deck.js';
import { createRes, postReq } from '../../_lib/test-helpers.js';

describe('POST /api/v1/ai/deck', () => {
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubEnv('ALLOWED_ORIGINS', '');
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          status: 200,
          json: () => Promise.resolve({ content: [{ type: 'text', text: '[]' }] }),
        })
      )
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('forwards a valid generation request', async () => {
    const res = createRes();
    await handler(postReq('10.1.0.1'), res);
    expect(res.statusCode).toBe(200);
  });

  it('enforces the strict 5-per-hour deck quota per client', async () => {
    const results = [];
    for (let i = 0; i < 6; i++) {
      const res = createRes();
      await handler(postReq('10.1.0.2'), res);
      results.push(res);
    }
    expect(results.slice(0, 5).every((r) => r.statusCode === 200)).toBe(true);
    expect(results[5].statusCode).toBe(429);
    expect(results[5].body.error.code).toBe('rate_limited');
  });

  it('malformed requests still consume quota (garbage is not free)', async () => {
    // Burn the full quota with invalid bodies…
    for (let i = 0; i < 5; i++) {
      const res = createRes();
      await handler(postReq('10.1.0.3', { body: { junk: true } }), res);
      expect(res.statusCode).toBe(400);
    }
    // …then a valid request is already rate-limited.
    const res = createRes();
    await handler(postReq('10.1.0.3'), res);
    expect(res.statusCode).toBe(429);
    expect(fetch).not.toHaveBeenCalled();
  });
});
