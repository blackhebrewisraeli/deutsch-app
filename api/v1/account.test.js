import { describe, it, expect } from 'vitest';
import handler from './account.js';
import { createRes } from '../_lib/test-helpers.js';

// The dispatcher itself: PATCH/GET/DELETE are routed by the three lane-specific
// handlers (covered in api/v1/account/profile.test.js, export.test.js and
// delete.test.js), so this file only pins the dispatch behaviour that lives
// here — an unsupported method should never reach any of them.
describe('dispatcher /api/v1/account', () => {
  it('rejects an unsupported method with 405', async () => {
    const res = createRes();
    await handler({ method: 'POST', headers: {} }, res);
    expect(res.statusCode).toBe(405);
  });
});
