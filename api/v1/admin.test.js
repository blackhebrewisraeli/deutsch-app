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
});
