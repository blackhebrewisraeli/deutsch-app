// api/v1/social.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../_lib/supabase.js', () => ({ serviceClient: vi.fn() }));
vi.mock('../_lib/auth-middleware.js', () => ({ requireAuth: vi.fn() }));

import {
  searchHandler,
  followHandler,
  unfollowHandler,
  sanitizeQuery,
  isUserId,
  MIN_QUERY_LEN,
  MAX_QUERY_LEN,
  SEARCH_LIMIT,
} from '../_lib/socialEndpoints.js';
import route from './social.js';
import { serviceClient } from '../_lib/supabase.js';
import { requireAuth } from '../_lib/auth-middleware.js';
import { createRes } from '../_lib/test-helpers.js';

const ME = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const THEM = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER = { userId: ME, email: 'me@example.com', user: { email: 'me@example.com' } };

// Routes are module singletons whose rate-limit counters live for the whole
// test process, so every request gets its own client IP.
let seq = 0;
const req = (method, extra = {}) => {
  seq += 1;
  return {
    method,
    headers: {
      'x-forwarded-for': `10.9.${Math.floor(seq / 250)}.${seq % 250}`,
      authorization: 'Bearer tok',
    },
    query: {},
    ...extra,
  };
};

// What the mocked database hands back, per test.
let searchRows;
let searchError;
let edgeRows;
let targetProfile;
let inserted;
let insertError;
let deleted;

const mockDb = () => ({
  from: vi.fn((table) => {
    const b = {
      cols: null,
      filters: {},
      select: vi.fn((cols) => {
        b.cols = cols;
        return b;
      }),
      or: vi.fn((v) => {
        b.filters.or = v;
        return b;
      }),
      is: vi.fn(() => b),
      neq: vi.fn((col, v) => {
        b.filters[`neq:${col}`] = v;
        return b;
      }),
      eq: vi.fn((col, v) => {
        b.filters[`eq:${col}`] = v;
        return b;
      }),
      in: vi.fn((col, v) => {
        b.filters[`in:${col}`] = v;
        return b;
      }),
      order: vi.fn(() => b),
      limit: vi.fn((n) => {
        b.filters.limit = n;
        return b;
      }),
      insert: vi.fn((row) => {
        inserted.push({ table, row });
        return Promise.resolve({ error: insertError });
      }),
      delete: vi.fn(() => {
        b.deleting = true;
        return b;
      }),
      maybeSingle: vi.fn(() => {
        // The guard chain reads the CALLER's blocked_at with select('blocked_at');
        // the follow path looks the TARGET up with a wider column list. The
        // column string is what tells the two apart.
        if (b.cols === 'blocked_at') return Promise.resolve({ data: { blocked_at: null } });
        return Promise.resolve({ data: targetProfile });
      }),
      then: (ok, err) => {
        if (b.deleting) {
          deleted.push({ table, filters: b.filters });
          return Promise.resolve({ error: null }).then(ok, err);
        }
        if (table === 'profile_follows') {
          return Promise.resolve({ data: edgeRows, error: null }).then(ok, err);
        }
        return Promise.resolve({ data: searchRows, error: searchError }).then(ok, err);
      },
    };
    return b;
  }),
});

beforeEach(() => {
  searchRows = [];
  searchError = null;
  edgeRows = [];
  targetProfile = { user_id: THEM, blocked_at: null };
  inserted = [];
  insertError = null;
  deleted = [];
  requireAuth.mockResolvedValue({ ...USER });
  serviceClient.mockReturnValue(mockDb());
});

describe('sanitizeQuery', () => {
  it('keeps letters, digits, space, underscore and hyphen', () => {
    expect(sanitizeQuery('learner_ab12-x')).toBe('learner_ab12-x');
  });

  it('lets the obvious thing to type work: a leading @ falls away', () => {
    expect(sanitizeQuery('@sam')).toBe('sam');
  });

  it('keeps non-latin letters, because display names are not latin-only', () => {
    expect(sanitizeQuery('Müller')).toBe('Müller');
    expect(sanitizeQuery('Ελλάδα')).toBe('Ελλάδα');
  });

  // The security-critical case. `.or()` takes a DSL STRING, so a comma or a
  // parenthesis that survived would add or close a FILTER rather than be
  // searched for.
  it('strips every character the PostgREST filter DSL treats as structure', () => {
    for (const hostile of [',', '.', '(', ')', '"', ':', '*', '%', '\\']) {
      expect(sanitizeQuery(`a${hostile}b`)).not.toContain(hostile);
    }
  });

  it('cannot smuggle a second filter condition through the term', () => {
    const attack = `sam,user_id.eq.${THEM}`;
    const cleaned = sanitizeQuery(attack);
    expect(cleaned).not.toContain(',');
    expect(cleaned).not.toContain('.');
    // And it did not splice the two sides together into a term nobody typed.
    expect(cleaned).not.toContain('samuser_id');
  });

  it('caps the term at the handle column write-path length', () => {
    expect(sanitizeQuery('x'.repeat(200))).toHaveLength(MAX_QUERY_LEN);
  });

  it('is empty for a non-string', () => {
    expect(sanitizeQuery(undefined)).toBe('');
    expect(sanitizeQuery(null)).toBe('');
    expect(sanitizeQuery(42)).toBe('');
  });
});

describe('isUserId', () => {
  it('accepts a uuid and refuses anything PostgREST would choke on', () => {
    expect(isUserId(THEM)).toBe(true);
    expect(isUserId('not-a-uuid')).toBe(false);
    expect(isUserId('')).toBe(false);
    expect(isUserId(undefined)).toBe(false);
  });
});

describe('GET — search', () => {
  it('returns matching people with the caller excluded', async () => {
    searchRows = [{ user_id: THEM, handle: 'sam', display_name: 'Sam', avatar_path: null }];
    const res = createRes();
    await searchHandler(req('GET', { query: { q: 'sam' } }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.results).toEqual([
      {
        user_id: THEM,
        handle: 'sam',
        display_name: 'Sam',
        avatar_path: null,
        is_following: false,
      },
    ]);
  });

  it('publishes ONLY public identity — never xp, streak, league or email', async () => {
    searchRows = [{ user_id: THEM, handle: 'sam', display_name: 'Sam', avatar_path: 'p.png' }];
    const res = createRes();
    await searchHandler(req('GET', { query: { q: 'sam' } }), res);

    expect(Object.keys(res.body.results[0]).sort()).toEqual([
      'avatar_path',
      'display_name',
      'handle',
      'is_following',
      'user_id',
    ]);
  });

  it('marks the people the caller already follows', async () => {
    searchRows = [
      { user_id: THEM, handle: 'sam', display_name: 'Sam', avatar_path: null },
      {
        user_id: '11111111-1111-4111-8111-111111111111',
        handle: 'sue',
        display_name: null,
        avatar_path: null,
      },
    ];
    edgeRows = [{ followed_id: THEM }];
    const res = createRes();
    await searchHandler(req('GET', { query: { q: 'sam' } }), res);
    expect(res.body.results.map((r) => r.is_following)).toEqual([true, false]);
  });

  it('a too-short term is an empty result, not an error', async () => {
    const res = createRes();
    await searchHandler(req('GET', { query: { q: 'a' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.results).toEqual([]);
  });

  it('does not query the database at all for a too-short term', async () => {
    const db = mockDb();
    serviceClient.mockReturnValue(db);
    const res = createRes();
    await searchHandler(req('GET', { query: { q: '' } }), res);
    // Only the guard chain's own blocked_at lookup touched the database.
    const tables = db.from.mock.calls.map(([t]) => t);
    expect(tables.filter((t) => t === 'profiles')).toHaveLength(1);
    expect(MIN_QUERY_LEN).toBe(2);
  });

  it('excludes the caller and caps the page', async () => {
    const db = mockDb();
    serviceClient.mockReturnValue(db);
    searchRows = [];
    await searchHandler(req('GET', { query: { q: 'sam' } }), createRes());

    const search = db.from.mock.results
      .map((r) => r.value)
      .find((b) => b.filters['neq:user_id'] !== undefined);
    expect(search.filters['neq:user_id']).toBe(ME);
    expect(search.filters.limit).toBe(SEARCH_LIMIT);
  });

  it('asks only who the CALLER follows, never who follows them', async () => {
    const db = mockDb();
    serviceClient.mockReturnValue(db);
    searchRows = [{ user_id: THEM, handle: 'sam', display_name: null, avatar_path: null }];
    await searchHandler(req('GET', { query: { q: 'sam' } }), createRes());

    const edges = db.from.mock.results
      .map((r) => r.value)
      .find((b) => b.filters['in:followed_id'] !== undefined);
    expect(edges.filters['eq:follower_id']).toBe(ME);
    expect(edges.filters['in:followed_id']).toEqual([THEM]);
  });
});

describe('POST — follow', () => {
  it('inserts the edge and reports the new state', async () => {
    const res = createRes();
    await followHandler(req('POST', { body: { userId: THEM } }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ user_id: THEM, is_following: true });
    expect(inserted).toEqual([
      { table: 'profile_follows', row: { follower_id: ME, followed_id: THEM } },
    ]);
  });

  it('refuses to follow yourself', async () => {
    const res = createRes();
    await followHandler(req('POST', { body: { userId: ME } }), res);
    expect(res.statusCode).toBe(400);
    expect(inserted).toEqual([]);
  });

  it('refuses a malformed id rather than letting PostgREST 500', async () => {
    const res = createRes();
    await followHandler(req('POST', { body: { userId: 'nope' } }), res);
    expect(res.statusCode).toBe(400);
  });

  it('refuses a blocked account', async () => {
    targetProfile = { user_id: THEM, blocked_at: '2026-01-01T00:00:00Z' };
    const res = createRes();
    await followHandler(req('POST', { body: { userId: THEM } }), res);
    expect(res.statusCode).toBe(400);
    expect(inserted).toEqual([]);
  });

  it('refuses an account that does not exist', async () => {
    targetProfile = null;
    const res = createRes();
    await followHandler(req('POST', { body: { userId: THEM } }), res);
    expect(res.statusCode).toBe(400);
  });

  // The double-tap case. An optimistic button that is told "failed" here would
  // roll back to Follow while the server says the caller IS following.
  it('treats an already-followed target as success, not a failure', async () => {
    insertError = { code: '23505' };
    const res = createRes();
    await followHandler(req('POST', { body: { userId: THEM } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.is_following).toBe(true);
  });

  it('still fails loudly on a real database error', async () => {
    insertError = { code: '42501', message: 'denied' };
    const res = createRes();
    await followHandler(req('POST', { body: { userId: THEM } }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('DELETE — unfollow', () => {
  it("removes only the caller's own edge", async () => {
    const res = createRes();
    await unfollowHandler(req('DELETE', { query: { userId: THEM } }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ user_id: THEM, is_following: false });
    expect(deleted).toEqual([
      {
        table: 'profile_follows',
        filters: { 'eq:follower_id': ME, 'eq:followed_id': THEM },
      },
    ]);
  });

  it('refuses a malformed id', async () => {
    const res = createRes();
    await unfollowHandler(req('DELETE', { query: { userId: 'nope' } }), res);
    expect(res.statusCode).toBe(400);
    expect(deleted).toEqual([]);
  });

  it('is idempotent — unfollowing someone you do not follow still succeeds', async () => {
    const res = createRes();
    await unfollowHandler(req('DELETE', { query: { userId: THEM } }), res);
    expect(res.statusCode).toBe(200);
  });
});

describe('route dispatch', () => {
  it('sends each method to its own lane', async () => {
    const get = createRes();
    await route(req('GET', { query: { q: 'sam' } }), get);
    expect(get.statusCode).toBe(200);

    const post = createRes();
    await route(req('POST', { body: { userId: THEM } }), post);
    expect(post.body.is_following).toBe(true);

    const del = createRes();
    await route(req('DELETE', { query: { userId: THEM } }), del);
    expect(del.body.is_following).toBe(false);
  });

  it('refuses anything else', async () => {
    const res = createRes();
    await route(req('PUT'), res);
    expect(res.statusCode).toBe(405);
  });
});
