// api/v1/social.list.test.js
//
// GET ?list=followers|following — a separate file from social.test.js because
// the mock database here has to answer TWO distinct profile_follows queries
// per followers request (who follows me, then which of those I follow back),
// where social.test.js's fixture only ever needs one.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../_lib/supabase.js', () => ({ serviceClient: vi.fn() }));
vi.mock('../_lib/auth-middleware.js', () => ({ requireAuth: vi.fn() }));

import { listHandler, LIST_LIMIT } from '../_lib/socialEndpoints.js';
import route from './social.js';
import { serviceClient } from '../_lib/supabase.js';
import { requireAuth } from '../_lib/auth-middleware.js';
import { createRes } from '../_lib/test-helpers.js';

const ME = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SAM = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SUE = '11111111-1111-4111-8111-111111111111';
const USER = { userId: ME, email: 'me@example.com', user: { email: 'me@example.com' } };

let seq = 0;
const req = (extra = {}) => {
  seq += 1;
  return {
    method: 'GET',
    headers: {
      'x-forwarded-for': `10.8.${Math.floor(seq / 250)}.${seq % 250}`,
      authorization: 'Bearer tok',
    },
    query: {},
    ...extra,
  };
};

// Per-test wiring: `edgeQueues` holds one array of rows per profile_follows
// query, consumed in call order — the anchor query first, the "who do I
// follow back" query second. `profileRows` answers the one profiles query.
let edgeQueues;
let profileRows;

const mockDb = () => {
  let edgeCall = 0;
  return {
    from: vi.fn((table) => {
      const b = {
        cols: null,
        filters: {},
        select: vi.fn((cols) => {
          b.cols = cols;
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
        is: vi.fn(() => b),
        order: vi.fn(() => b),
        range: vi.fn((from, to) => {
          b.filters.range = [from, to];
          return b;
        }),
        // The guard chain's own blocked_at check on the CALLER, ahead of run().
        maybeSingle: vi.fn(() => Promise.resolve({ data: { blocked_at: null } })),
        then: (ok, err) => {
          if (table === 'profile_follows') {
            const data = edgeQueues[edgeCall] ?? [];
            edgeCall += 1;
            return Promise.resolve({ data, error: null }).then(ok, err);
          }
          return Promise.resolve({ data: profileRows, error: null }).then(ok, err);
        },
      };
      return b;
    }),
  };
};

beforeEach(() => {
  edgeQueues = [[]];
  profileRows = [];
  requireAuth.mockResolvedValue({ ...USER });
  serviceClient.mockReturnValue(mockDb());
});

describe('GET — followers list', () => {
  it('lists who follows the caller, most recent first', async () => {
    edgeQueues = [[{ follower_id: SAM }], []];
    profileRows = [{ user_id: SAM, handle: 'sam', display_name: 'Sam', avatar_path: null }];

    const res = createRes();
    await listHandler(req({ query: { list: 'followers' } }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.results).toEqual([
      { user_id: SAM, handle: 'sam', display_name: 'Sam', avatar_path: null, is_following: false },
    ]);
  });

  it('marks a follower the caller already follows back', async () => {
    edgeQueues = [[{ follower_id: SAM }], [{ followed_id: SAM }]];
    profileRows = [{ user_id: SAM, handle: 'sam', display_name: 'Sam', avatar_path: null }];

    const res = createRes();
    await listHandler(req({ query: { list: 'followers' } }), res);

    expect(res.body.results[0].is_following).toBe(true);
  });

  it('queries who follows me, not who I follow', async () => {
    const db = mockDb();
    serviceClient.mockReturnValue(db);
    edgeQueues = [[], []];

    await listHandler(req({ query: { list: 'followers' } }), createRes());

    const anchorCall = db.from.mock.results
      .map((r) => r.value)
      .find((b) => b.filters.range !== undefined);
    expect(anchorCall.filters['eq:followed_id']).toBe(ME);
  });

  it('is empty, not an error, when nobody follows the caller', async () => {
    const res = createRes();
    await listHandler(req({ query: { list: 'followers' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.results).toEqual([]);
    expect(res.body.hasMore).toBe(false);
  });

  it('drops a row whose profile is gone or blocked without erroring', async () => {
    edgeQueues = [[{ follower_id: SAM }, { follower_id: SUE }], []];
    // Only SUE resolves — SAM's profile row is filtered out (deleted/blocked).
    profileRows = [{ user_id: SUE, handle: 'sue', display_name: null, avatar_path: null }];

    const res = createRes();
    await listHandler(req({ query: { list: 'followers' } }), res);

    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].user_id).toBe(SUE);
  });
});

describe('GET — following list', () => {
  it('lists who the caller follows, all marked as followed', async () => {
    edgeQueues = [[{ followed_id: SAM }]];
    profileRows = [{ user_id: SAM, handle: 'sam', display_name: 'Sam', avatar_path: null }];

    const res = createRes();
    await listHandler(req({ query: { list: 'following' } }), res);

    expect(res.body.results).toEqual([
      { user_id: SAM, handle: 'sam', display_name: 'Sam', avatar_path: null, is_following: true },
    ]);
  });

  it('never issues a second profile_follows query — every row is already followed', async () => {
    const db = mockDb();
    serviceClient.mockReturnValue(db);
    edgeQueues = [[{ followed_id: SAM }]];
    profileRows = [{ user_id: SAM, handle: 'sam', display_name: 'Sam', avatar_path: null }];

    await listHandler(req({ query: { list: 'following' } }), createRes());

    const edgeCalls = db.from.mock.calls.filter(([t]) => t === 'profile_follows');
    expect(edgeCalls).toHaveLength(1);
  });
});

describe('GET — list pagination', () => {
  it('signals another page when a full page comes back', async () => {
    const full = Array.from({ length: LIST_LIMIT }, (_, i) => ({
      follower_id: `cccccccc-cccc-4ccc-8ccc-${String(i).padStart(12, '0')}`,
    }));
    edgeQueues = [full, []];
    profileRows = full.map((row) => ({
      user_id: row.follower_id,
      handle: row.follower_id,
      display_name: null,
      avatar_path: null,
    }));

    const res = createRes();
    await listHandler(req({ query: { list: 'followers' } }), res);
    expect(res.body.hasMore).toBe(true);
  });

  it('paginates with offset', async () => {
    const db = mockDb();
    serviceClient.mockReturnValue(db);
    edgeQueues = [[], []];

    await listHandler(req({ query: { list: 'followers', offset: '40' } }), createRes());

    const anchorCall = db.from.mock.results
      .map((r) => r.value)
      .find((b) => b.filters.range !== undefined);
    expect(anchorCall.filters.range).toEqual([40, 40 + LIST_LIMIT - 1]);
  });
});

describe('GET — invalid list', () => {
  it('refuses anything other than followers or following', async () => {
    const res = createRes();
    await listHandler(req({ query: { list: 'bogus' } }), res);
    expect(res.statusCode).toBe(400);
  });
});

describe('route dispatch', () => {
  it('sends ?list= to the list handler, not search', async () => {
    const res = createRes();
    await route(req({ query: { list: 'following' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.list).toBe('following');
  });
});
