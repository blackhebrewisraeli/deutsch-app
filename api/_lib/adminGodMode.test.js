import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./supabase.js', () => ({ serviceClient: vi.fn() }));
vi.mock('./auth-middleware.js', () => ({ requireAuth: vi.fn() }));

import {
  progressHandler,
  xpHandler,
  leagueHandler,
  readGodModeSnapshot,
  MAX_XP_DELTA,
} from './adminGodMode.js';
import { serviceClient } from './supabase.js';
import { requireAuth } from './auth-middleware.js';
import { createRes } from './test-helpers.js';

const ADMIN_EMAIL = 'esterkinshimon712@gmail.com';
const OTHER_EMAIL = 'blackhebrewisraeli@gmail.com';
const TARGET = '33333333-3333-4333-8333-333333333333';
const LEAGUE = '44444444-4444-4444-8444-444444444444';
const OTHER_LEAGUE = '55555555-5555-4555-8555-555555555555';
const DAY = '2026-09-23';
// The Monday of the week DAY falls in. currentPeriodStart() reads the real
// clock, so anything asserting on the period has to fake it.
const PERIOD = '2026-09-21';

const adminAuth = {
  userId: 'admin-1',
  email: ADMIN_EMAIL,
  user: {
    id: 'admin-1',
    email: ADMIN_EMAIL,
    email_confirmed_at: '2026-09-18T00:00:00Z',
    identities: [
      { provider: 'google', identity_data: { email: ADMIN_EMAIL, email_verified: true } },
    ],
  },
};

const otherAuth = {
  userId: TARGET,
  email: OTHER_EMAIL,
  user: { id: TARGET, email: OTHER_EMAIL, email_confirmed_at: '2026-09-18T00:00:00Z' },
};

let seq = 0;
const req = (overrides = {}) => {
  seq += 1;
  return {
    method: 'GET',
    headers: { 'x-forwarded-for': `10.30.0.${seq}`, authorization: 'Bearer tok' },
    query: {},
    body: {},
    ...overrides,
  };
};

// ── A fake PostgREST that actually filters ───────────────────────────────────
//
// It has to: every assertion here is about WHICH rows a handler summed or wrote,
// and a stub that returns the same array for `.eq('day', …)` and `.gte('day', …)`
// cannot tell a correct weekly sum from a lifetime one. The chain records the
// filters it was given and the resolver applies them.
let writes;

function makeDb(state) {
  writes = [];

  const resolve = (ctx) => {
    const { table, op, filters } = ctx;
    if (op === 'insert' && table === 'leagues') return { data: { id: 'league-new' }, error: null };
    if (op !== 'select') return { data: null, error: null };

    if (table === 'stats_daily') {
      let rows = state.stats_daily ?? [];
      if (filters.day != null) rows = rows.filter((r) => r.day === filters.day);
      if (filters.day__gte != null) rows = rows.filter((r) => r.day >= filters.day__gte);
      return { data: rows, error: null, one: rows[0] ?? null };
    }
    if (table === 'league_members') {
      return { data: state.league_members ?? null, error: null, one: state.league_members ?? null };
    }
    if (table === 'leagues') {
      const rows = (state.leagues ?? []).filter(
        (l) => filters.tier == null || l.tier === filters.tier
      );
      return { data: rows, error: null, one: rows[0] ?? null };
    }
    return { data: state.profiles ?? null, error: null, one: state.profiles ?? null };
  };

  const chain = (table) => {
    const ctx = { table, op: 'select', filters: {}, payload: null };
    const c = {
      ctx,
      select: () => c,
      eq: (k, v) => {
        ctx.filters[k] = v;
        return c;
      },
      gte: (k, v) => {
        ctx.filters[`${k}__gte`] = v;
        return c;
      },
      order: () => c,
      limit: () => c,
      insert: (payload) => {
        ctx.op = 'insert';
        ctx.payload = payload;
        writes.push(ctx);
        return c;
      },
      upsert: (payload, opts) => {
        ctx.op = 'upsert';
        ctx.payload = payload;
        ctx.opts = opts;
        writes.push(ctx);
        return c;
      },
      update: (payload) => {
        ctx.op = 'update';
        ctx.payload = payload;
        writes.push(ctx);
        return c;
      },
      delete: () => {
        ctx.op = 'delete';
        writes.push(ctx);
        return c;
      },
      maybeSingle: () => {
        const r = resolve(ctx);
        return Promise.resolve({ data: r.one ?? null, error: r.error });
      },
      single: () => {
        const r = resolve(ctx);
        return Promise.resolve({ data: r.one ?? r.data ?? null, error: r.error });
      },
      then(onOk, onErr) {
        const r = resolve(ctx);
        return Promise.resolve({ data: r.data, error: r.error }).then(onOk, onErr);
      },
    };
    return c;
  };

  return {
    from: vi.fn(chain),
    auth: {
      admin: {
        getUserById: vi
          .fn()
          .mockResolvedValue(
            state.userMissing
              ? { data: null, error: { message: 'not found' } }
              : { data: { user: otherAuth.user }, error: null }
          ),
      },
    },
  };
}

const writeTo = (table, op) => writes.find((w) => w.table === table && w.op === op);

const DEFAULT_STATE = () => ({
  stats_daily: [
    // Last week — inside the lifetime total, outside the league week.
    { day: '2026-09-14', counters: { byLevel: { a1: { correct: 1 } }, bonusXp: 0 } },
    // This week.
    { day: PERIOD, counters: { byLevel: { a1: { correct: 2 } }, bonusXp: 0 } },
    { day: DAY, counters: { byLevel: { a1: { correct: 1 } }, bonusXp: 5 } },
  ],
  league_members: {
    league_id: LEAGUE,
    handle: 'target',
    weekly_xp: 30,
    rank: null,
    result: null,
    leagues: { tier: 1, period_start: PERIOD },
  },
  profiles: { handle: 'target', blocked_at: null },
  leagues: [{ id: OTHER_LEAGUE, tier: 3, period_start: PERIOD, league_members: [{ count: 2 }] }],
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${DAY}T12:00:00Z`));
  requireAuth.mockResolvedValue(adminAuth);
  serviceClient.mockReturnValue(makeDb(DEFAULT_STATE()));
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('god mode — authorization', () => {
  it('403s a non-admin on every op, before a single row is read', async () => {
    requireAuth.mockResolvedValue(otherAuth);
    for (const [handler, r] of [
      [progressHandler, req({ query: { userId: TARGET, today: DAY } })],
      [xpHandler, req({ method: 'POST', body: { userId: TARGET, deltaXp: 10, day: DAY } })],
      [leagueHandler, req({ method: 'POST', body: { userId: TARGET, tier: 4, day: DAY } })],
    ]) {
      const db = makeDb(DEFAULT_STATE());
      serviceClient.mockReturnValue(db);
      const res = createRes();
      await handler(r, res);
      expect(res.statusCode).toBe(403);
      expect(db.from).not.toHaveBeenCalled();
      expect(writes).toEqual([]);
    }
  });

  it('does not take admin from the request body', async () => {
    requireAuth.mockResolvedValue(otherAuth);
    const res = createRes();
    await xpHandler(
      req({ method: 'POST', body: { userId: TARGET, deltaXp: 10, day: DAY, isAdmin: true } }),
      res
    );
    expect(res.statusCode).toBe(403);
  });
});

describe('god mode — reading a user', () => {
  it('separates the lifetime total from the league week', async () => {
    const res = createRes();
    await progressHandler(req({ query: { userId: TARGET, today: DAY } }), res);
    expect(res.statusCode).toBe(200);
    // 10 (last week) + 20 + 10 + 5 bonus = 45 lifetime; 35 this week.
    expect(res.body.totalXp).toBe(45);
    expect(res.body.weeklyXp).toBe(35);
    expect(res.body.today).toEqual({ day: DAY, dayXp: 15, bonusXp: 5 });
    expect(res.body.league).toMatchObject({ tier: 1, settled: false, rank: null });
  });

  it('rejects a non-uuid user id and a malformed day', async () => {
    const bad = createRes();
    await progressHandler(req({ query: { userId: 'me', today: DAY } }), bad);
    expect(bad.statusCode).toBe(400);

    const worse = createRes();
    await progressHandler(req({ query: { userId: TARGET, today: 'today' } }), worse);
    expect(worse.statusCode).toBe(400);
  });

  it('400s a user that does not exist rather than failing on a foreign key', async () => {
    serviceClient.mockReturnValue(makeDb({ ...DEFAULT_STATE(), userMissing: true }));
    const res = createRes();
    await progressHandler(req({ query: { userId: TARGET, today: DAY } }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toMatch(/not found/i);
  });

  it('reports no league when the user has not joined this week', async () => {
    serviceClient.mockReturnValue(makeDb({ ...DEFAULT_STATE(), league_members: null }));
    const res = createRes();
    await progressHandler(req({ query: { userId: TARGET, today: DAY } }), res);
    expect(res.body.league).toBeNull();
  });
});

describe('god mode — XP', () => {
  const post = (body) => req({ method: 'POST', body: { day: DAY, ...body } });

  it('adds the delta to the day bonus and recomputes the league week', async () => {
    const res = createRes();
    await xpHandler(post({ userId: TARGET, deltaXp: 100 }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.appliedDelta).toBe(100);

    const upsert = writeTo('stats_daily', 'upsert');
    expect(upsert.payload).toMatchObject({ user_id: TARGET, pack_id: 'de', day: DAY });
    expect(upsert.payload.counters.bonusXp).toBe(105);
    // The verdict counters are untouched: an adjustment is not a drill answer,
    // and moving `total` would corrupt every derived stat on the Profile page.
    expect(upsert.payload.counters.byLevel).toEqual({ a1: { correct: 1 } });

    // weekly_xp is pushed from the WEEK's rows, never from the lifetime sum.
    expect(writeTo('league_members', 'update').payload.weekly_xp).toBe(35);
  });

  it('clamps a negative adjustment at the day, never below zero', async () => {
    const res = createRes();
    await xpHandler(post({ userId: TARGET, deltaXp: -1000 }), res);
    expect(res.statusCode).toBe(200);
    // The day was worth 15; -1000 becomes -15 and the day lands at exactly 0.
    expect(res.body.appliedDelta).toBe(-15);
    expect(writeTo('stats_daily', 'upsert').payload.counters.bonusXp).toBe(-10);
  });

  it('rejects a zero, fractional, or oversized delta', async () => {
    for (const deltaXp of [0, 1.5, '50', MAX_XP_DELTA + 1, -(MAX_XP_DELTA + 1)]) {
      const res = createRes();
      await xpHandler(post({ userId: TARGET, deltaXp }), res);
      expect(res.statusCode, `deltaXp=${deltaXp}`).toBe(400);
      expect(writeTo('stats_daily', 'upsert')).toBeUndefined();
    }
  });

  it('requires a day, so an adjustment cannot land in an unnamed week', async () => {
    const res = createRes();
    await xpHandler(req({ method: 'POST', body: { userId: TARGET, deltaXp: 10 } }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toMatch(/day/i);
  });

  it('writes a fresh zeroed day when the user has no row yet', async () => {
    serviceClient.mockReturnValue(makeDb({ ...DEFAULT_STATE(), stats_daily: [] }));
    const res = createRes();
    await xpHandler(post({ userId: TARGET, deltaXp: 40 }), res);
    const counters = writeTo('stats_daily', 'upsert').payload.counters;
    expect(counters.bonusXp).toBe(40);
    expect(counters.total).toBe(0);
    expect(counters.byLevel.a1).toEqual({ correct: 0, almost: 0, wrong: 0 });
  });

  it('leaves a settled league row alone', async () => {
    const state = DEFAULT_STATE();
    state.league_members = { ...state.league_members, rank: 3 };
    serviceClient.mockReturnValue(makeDb(state));
    const res = createRes();
    await xpHandler(post({ userId: TARGET, deltaXp: 100 }), res);
    expect(res.statusCode).toBe(200);
    expect(writeTo('stats_daily', 'upsert')).toBeDefined();
    expect(writeTo('league_members', 'update')).toBeUndefined();
  });
});

describe('god mode — league placement', () => {
  const post = (body) => req({ method: 'POST', body: { day: DAY, ...body } });

  it('moves the member into an open cohort at the target tier, carrying their XP', async () => {
    const res = createRes();
    await leagueHandler(post({ userId: TARGET, tier: 3 }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.moved).toBe(true);

    expect(writeTo('league_members', 'delete').filters).toMatchObject({
      user_id: TARGET,
      league_id: LEAGUE,
    });
    expect(writeTo('league_members', 'insert').payload).toMatchObject({
      league_id: OTHER_LEAGUE,
      user_id: TARGET,
      handle: 'target',
      weekly_xp: 30,
      period_start: PERIOD,
    });
    // An open cohort existed, so no new league was opened.
    expect(writeTo('leagues', 'insert')).toBeUndefined();
  });

  it('opens a league when no cohort at that tier has room', async () => {
    const state = DEFAULT_STATE();
    state.leagues = [
      { id: 'full-1', tier: 4, period_start: PERIOD, league_members: [{ count: 25 }] },
    ];
    serviceClient.mockReturnValue(makeDb(state));
    const res = createRes();
    await leagueHandler(post({ userId: TARGET, tier: 4 }), res);
    expect(writeTo('leagues', 'insert').payload).toEqual({ tier: 4, period_start: PERIOD });
    expect(writeTo('league_members', 'insert').payload.league_id).toBe('league-new');
  });

  it('refuses to rewrite a settled week', async () => {
    const state = DEFAULT_STATE();
    state.league_members = { ...state.league_members, rank: 2, result: 'promoted' };
    serviceClient.mockReturnValue(makeDb(state));
    const res = createRes();
    await leagueHandler(post({ userId: TARGET, tier: 0 }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toMatch(/settled/i);
    expect(writes.filter((w) => w.op !== 'select')).toEqual([]);
  });

  it('is a no-op when the user is already in that tier', async () => {
    const res = createRes();
    await leagueHandler(post({ userId: TARGET, tier: 1 }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.moved).toBe(false);
    expect(writeTo('league_members', 'delete')).toBeUndefined();
    expect(writeTo('league_members', 'insert')).toBeUndefined();
  });

  it('rejects a tier off the ladder', async () => {
    for (const tier of [-1, 5, 2.5, '3', null]) {
      const res = createRes();
      await leagueHandler(post({ userId: TARGET, tier }), res);
      expect(res.statusCode, `tier=${tier}`).toBe(400);
    }
  });

  it('refuses a user with no handle rather than minting a second one', async () => {
    serviceClient.mockReturnValue(
      makeDb({ ...DEFAULT_STATE(), league_members: null, profiles: { handle: null } })
    );
    const res = createRes();
    await leagueHandler(post({ userId: TARGET, tier: 2 }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toMatch(/handle/i);
  });

  it('creates the membership for a user who is not in a league yet', async () => {
    serviceClient.mockReturnValue(makeDb({ ...DEFAULT_STATE(), league_members: null }));
    const res = createRes();
    await leagueHandler(post({ userId: TARGET, tier: 3 }), res);
    expect(res.statusCode).toBe(200);
    expect(writeTo('league_members', 'delete')).toBeUndefined();
    expect(writeTo('league_members', 'insert').payload).toMatchObject({
      league_id: OTHER_LEAGUE,
      weekly_xp: 0,
    });
  });
});

describe('readGodModeSnapshot', () => {
  it('reads the handle off the profile, falling back to the league row', async () => {
    const db = makeDb({ ...DEFAULT_STATE(), profiles: { handle: null, blocked_at: 'x' } });
    const snap = await readGodModeSnapshot(db, TARGET, DAY);
    expect(snap.handle).toBe('target');
    expect(snap.blocked).toBe(true);
    expect(snap.periodStart).toBe(PERIOD);
  });
});
