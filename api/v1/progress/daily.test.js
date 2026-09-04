import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../_lib/supabase.js', () => ({ serviceClient: vi.fn() }));
vi.mock('../../_lib/auth-middleware.js', () => ({ requireAuth: vi.fn() }));

import { dailyHandler as handler, emptyCounters } from '../../_lib/progressHandlers.js';
import { serviceClient } from '../../_lib/supabase.js';
import { requireAuth } from '../../_lib/auth-middleware.js';
import { createRes } from '../../_lib/test-helpers.js';

const USER = { userId: 'uid-1', email: 'a@b.com' };

let seq = 0;
const req = (query = {}, method = 'GET') => {
  seq += 1;
  return {
    method,
    headers: { 'x-forwarded-for': `10.8.8.${seq}`, authorization: 'Bearer tok' },
    query: { date: '2026-09-04', ...query },
  };
};

let row;
let dbError;
let filters;
const mockDb = () => ({
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(function (col, val) {
        filters.push([col, val]);
        return this;
      }),
      maybeSingle: vi.fn().mockResolvedValue({ data: row, error: dbError }),
    })),
  })),
});

beforeEach(() => {
  row = null;
  dbError = null;
  filters = [];
  serviceClient.mockReturnValue(mockDb());
  requireAuth.mockResolvedValue(USER);
});

describe('emptyCounters', () => {
  it('is the zeroed aggregate the Stats tab expects, not an empty object', () => {
    const empty = emptyCounters();
    expect(empty.total).toBe(0);
    expect(empty.bonusXp).toBe(0);
    expect(Object.keys(empty.byTab).sort()).toEqual(['alphabet', 'chat', 'translate', 'vocab']);
    expect(empty.byLevel.a1).toEqual({ correct: 0, almost: 0, wrong: 0 });
    expect(Object.keys(empty.byLevel).sort()).toEqual(['a1', 'a2', 'b1']);
  });
});

describe('GET /api/v1/progress/daily', () => {
  it('returns the stored counters for the caller', async () => {
    row = { counters: { total: 3, bonusXp: 0, byTab: {}, byLevel: {} } };
    const res = createRes();
    await handler(req(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.counters.total).toBe(3);
    expect(res.body.dateKey).toBe('2026-09-04');
    expect(res.body.packId).toBe('de');
  });

  it('scopes the query to the authenticated user', async () => {
    await handler(req(), createRes());
    expect(filters).toContainEqual(['user_id', USER.userId]);
    expect(filters).toContainEqual(['day', '2026-09-04']);
    expect(filters).toContainEqual(['pack_id', 'de']);
  });

  it('returns zeros rather than 404 for a quiet day', async () => {
    row = null;
    const res = createRes();
    await handler(req(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.counters.total).toBe(0);
    expect(res.body.counters.byLevel.a1.correct).toBe(0);
  });

  it('rejects a malformed date', async () => {
    const res = createRes();
    await handler(req({ date: '2026-9-4' }), res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects a well-formed but impossible date with 400, not 500', async () => {
    const res = createRes();
    await handler(req({ date: '2026-02-30' }), res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects an unknown packId', async () => {
    const res = createRes();
    await handler(req({ packId: 'en' }), res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects the wrong method', async () => {
    const res = createRes();
    await handler(req({}, 'POST'), res);
    expect(res.statusCode).toBe(405);
  });

  it('surfaces a database failure without leaking the message', async () => {
    dbError = { message: 'pg detail' };
    const res = createRes();
    await handler(req(), res);
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('pg detail');
  });
});
