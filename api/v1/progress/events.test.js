import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('../../_lib/supabase.js', () => ({ serviceClient: vi.fn() }));
vi.mock('../../_lib/auth-middleware.js', () => ({ requireAuth: vi.fn() }));

import {
  eventsHandler as handler,
  validateEventBody,
  MAX_BONUS_XP,
} from '../../_lib/progressHandlers.js';
import { serviceClient } from '../../_lib/supabase.js';
import { requireAuth } from '../../_lib/auth-middleware.js';
import { createRes } from '../../_lib/test-helpers.js';

const USER = { userId: 'uid-1', email: 'a@b.com' };

let seq = 0;
const req = (body, method = 'POST') => {
  seq += 1;
  return {
    method,
    headers: { 'x-forwarded-for': `10.7.7.${seq}`, authorization: 'Bearer tok' },
    body,
  };
};

const VALID = { dateKey: '2026-09-04', tab: 'vocab', level: 'a1', verdict: 'correct' };

let rpcResult;
let rpcArgs;
const mockDb = () => ({
  rpc: vi.fn((name, args) => {
    rpcArgs = { name, args };
    return Promise.resolve(rpcResult);
  }),
});

beforeEach(() => {
  rpcArgs = null;
  rpcResult = { data: { total: 1, bonusXp: 0, byTab: {}, byLevel: {} }, error: null };
  serviceClient.mockReturnValue(mockDb());
  requireAuth.mockResolvedValue(USER);
});

describe('validateEventBody', () => {
  it('accepts a well-formed body and defaults packId and bonusXp', () => {
    const out = validateEventBody(VALID);
    expect(out.ok).toBe(true);
    expect(out.value.packId).toBe('de');
    expect(out.value.bonusXp).toBe(0);
  });

  it('rejects a dateKey that is not YYYY-MM-DD', () => {
    for (const bad of ['2026-9-4', '04-09-2026', 'today', '2026-09-04T00:00:00Z', '']) {
      expect(validateEventBody({ ...VALID, dateKey: bad }).ok).toBe(false);
    }
  });

  it('names packId when a caller sends courseCode, rather than aliasing it', () => {
    const out = validateEventBody({ ...VALID, courseCode: 'de' });
    expect(out.ok).toBe(false);
    expect(out.message).toMatch(/packId/);
  });

  it('rejects an unknown tab, level or verdict', () => {
    expect(validateEventBody({ ...VALID, tab: 'dictation' }).ok).toBe(false);
    expect(validateEventBody({ ...VALID, level: 'c1' }).ok).toBe(false);
    expect(validateEventBody({ ...VALID, verdict: 'perfect' }).ok).toBe(false);
  });

  it('rejects a packId other than de in v1', () => {
    expect(validateEventBody({ ...VALID, packId: 'en' }).ok).toBe(false);
  });

  it('caps bonusXp and rejects negative or non-integer values', () => {
    expect(validateEventBody({ ...VALID, bonusXp: MAX_BONUS_XP }).ok).toBe(true);
    expect(validateEventBody({ ...VALID, bonusXp: MAX_BONUS_XP + 1 }).ok).toBe(false);
    expect(validateEventBody({ ...VALID, bonusXp: -1 }).ok).toBe(false);
    expect(validateEventBody({ ...VALID, bonusXp: 1.5 }).ok).toBe(false);
    expect(validateEventBody({ ...VALID, bonusXp: '5' }).ok).toBe(false);
  });

  it('accepts a body that arrived unparsed', () => {
    expect(validateEventBody(JSON.stringify(VALID)).ok).toBe(true);
  });
});

describe('POST /api/v1/progress/events', () => {
  it('calls the RPC with the authenticated user, never a body-supplied id', async () => {
    const res = createRes();
    await handler(req({ ...VALID, userId: 'someone-else' }), res);
    expect(res.statusCode).toBe(200);
    expect(rpcArgs.name).toBe('apply_progress_event');
    expect(rpcArgs.args.p_user_id).toBe(USER.userId);
  });

  it('returns the resulting counters', async () => {
    const res = createRes();
    await handler(req(VALID), res);
    expect(res.body.dateKey).toBe('2026-09-04');
    expect(res.body.packId).toBe('de');
    expect(res.body.counters.total).toBe(1);
    expect(res.body.success).toBeUndefined();
  });

  it('does not overwrite the learner-supplied dateKey with a server clock', async () => {
    const res = createRes();
    await handler(req({ ...VALID, dateKey: '2026-01-15' }), res);
    expect(rpcArgs.args.p_day).toBe('2026-01-15');
    expect(res.body.dateKey).toBe('2026-01-15');
  });

  it('rejects the wrong method', async () => {
    const res = createRes();
    await handler(req(VALID, 'GET'), res);
    expect(res.statusCode).toBe(405);
  });

  it('rejects a request with no valid JWT', async () => {
    // The factory owns this, but spec section 8.2 names it for this endpoint,
    // and the lane writes user-scoped rows — worth pinning here too.
    requireAuth.mockRejectedValue(
      Object.assign(new Error('Missing token.'), { code: 'unauthorized' })
    );
    const res = createRes();
    await handler(req(VALID), res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });

  it('rejects a malformed body with 400', async () => {
    const res = createRes();
    await handler(req({ ...VALID, verdict: 'perfect' }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('bad_request');
  });

  it('rejects a well-formed but impossible dateKey with 400, not 500', async () => {
    const res = createRes();
    await handler(req({ ...VALID, dateKey: '2026-02-30' }), res);
    expect(res.statusCode).toBe(400);
  });

  it('surfaces an RPC failure as the envelope without leaking the message', async () => {
    rpcResult = { data: null, error: { message: 'pg detail' } };
    const res = createRes();
    await handler(req(VALID), res);
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('pg detail');
  });
});

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(js|jsx)$/.test(full)) out.push(full);
  }
  return out;
}

describe('the progress lane has no client caller', () => {
  it('nothing under src/ references the progress endpoints', () => {
    // E4: this assertion inverts in Task 6 (src/ becomes the caller; the
    // daily upsert is the thing that must not exist). Two writers double-count
    // via mergeDailyAdditive, they do not lose increments.
    const files = walk('src');
    // A guard that inspected nothing would report zero offenders too — the
    // same green result as a guard that actually found none. Assert the
    // denominator so an accidentally-empty walk (wrong path, moved directory)
    // fails loudly instead of passing quietly.
    expect(files.length).toBeGreaterThan(50);
    const offenders = files.filter((f) => /\/api\/v1\/progress\//.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
