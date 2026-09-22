import { describe, it, expect } from 'vitest';
import handler from './admin.js';
import { createRes } from '../_lib/test-helpers.js';

describe('dispatcher /api/v1/admin', () => {
  it('rejects an unknown op with 400', async () => {
    const res = createRes();
    await handler({ method: 'GET', headers: {}, query: { op: 'bogus' } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('bad_request');
  });

  it('rejects a missing op with 400', async () => {
    const res = createRes();
    await handler({ method: 'GET', headers: {} }, res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects an unsupported method on feedback with 405', async () => {
    const res = createRes();
    await handler({ method: 'PUT', headers: {}, query: { op: 'feedback' } }, res);
    expect(res.statusCode).toBe(405);
  });

  // The dispatcher is the only thing standing between a deployed God Mode
  // endpoint and a 'Unknown admin operation.' 400 — there is no file per op, so
  // nothing else fails when a route is forgotten. These assert the routing
  // only: each handler's own authorization is covered in adminGodMode.test.js.
  it.each(['me', 'users', 'block', 'progress', 'xp', 'league'])(
    'routes op=%s to a handler rather than rejecting it as unknown',
    async (op) => {
      const res = createRes();
      await handler(
        {
          method: op === 'block' || op === 'xp' || op === 'league' ? 'POST' : 'GET',
          headers: { 'x-forwarded-for': `10.40.0.${op.length}` },
          query: { op },
          body: {},
        },
        res
      );
      expect(res.body?.error?.message ?? '').not.toMatch(/unknown admin operation/i);
    }
  );
});
