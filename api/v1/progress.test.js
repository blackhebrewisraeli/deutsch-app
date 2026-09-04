import { describe, it, expect } from 'vitest';
import handler from './progress.js';
import { createRes } from '../_lib/test-helpers.js';

// The dispatcher itself: POST and GET are routed by the two lane-specific
// handlers (covered in api/v1/progress/events.test.js and daily.test.js),
// so this file only pins the dispatch behaviour that lives here — an
// unsupported method should never reach either handler.
describe('dispatcher /api/v1/progress', () => {
  it('rejects an unsupported method with 405', async () => {
    const res = createRes();
    await handler({ method: 'DELETE', headers: {} }, res);
    expect(res.statusCode).toBe(405);
  });
});
