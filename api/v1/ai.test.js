import { describe, it, expect } from 'vitest';
import handler from './ai.js';
import { createRes, postReq } from '../_lib/test-helpers.js';

// The dispatcher itself: each op is routed to a lane-specific handler
// (covered in api/v1/ai/chat.test.js, deck.test.js and grade.test.js), so
// this file only pins the dispatch behaviour that lives here — a missing or
// unknown op should never reach any of them.
describe('dispatcher /api/v1/ai', () => {
  it('rejects an unknown op with 400', async () => {
    const res = createRes();
    await handler(postReq('10.9.0.1', { query: { op: 'bogus' } }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('bad_request');
  });

  it('rejects a missing op with 400', async () => {
    const res = createRes();
    await handler(postReq('10.9.0.2'), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('bad_request');
  });
});
