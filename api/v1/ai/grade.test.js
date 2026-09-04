import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { gradeHandler as handler } from '../../_lib/aiEndpoints.js';
import { createRes, postReq } from '../../_lib/test-helpers.js';

describe('POST /api/v1/ai/grade', () => {
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubEnv('ALLOWED_ORIGINS', '');
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          status: 200,
          json: () => Promise.resolve({ content: [{ type: 'text', text: '{"ok":true}' }] }),
        })
      )
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('forwards a valid grading request', async () => {
    const res = createRes();
    await handler(postReq('10.2.0.1'), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.content[0].text).toBe('{"ok":true}');
  });

  it('honours the high-throughput 60-per-5-minutes exercise quota', async () => {
    const results = [];
    for (let i = 0; i < 61; i++) {
      const res = createRes();
      await handler(postReq('10.2.0.2'), res);
      results.push(res);
    }
    expect(results.slice(0, 60).every((r) => r.statusCode === 200)).toBe(true);
    expect(results[60].statusCode).toBe(429);
    expect(results[60].body.error.code).toBe('rate_limited');
  });

  it('rejects an unlisted Origin when the allow-list is configured', async () => {
    vi.stubEnv('ALLOWED_ORIGINS', 'https://deutsch-app-dusky.vercel.app');
    const res = createRes();
    await handler(
      postReq('10.2.0.3', {
        headers: { origin: 'https://evil.example', 'x-forwarded-for': '10.2.0.3' },
      }),
      res
    );
    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe('forbidden');
  });
});
