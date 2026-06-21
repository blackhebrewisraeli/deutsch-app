import { describe, it, expect, vi, beforeEach } from 'vitest';

const DAY = '2026-06-19';
const counters = (total, chat = total) => ({
  total,
  byTab: { chat, alphabet: 0, vocab: 0, translate: 0 },
  byLevel: {
    a1: { correct: chat, almost: 0, wrong: 0 },
    a2: { correct: 0, almost: 0, wrong: 0 },
    b1: { correct: 0, almost: 0, wrong: 0 },
  },
});

function persistUpsert(tables, table, rows) {
  if (table === 'stats_daily') {
    for (const row of rows) {
      const idx = tables.stats_daily.findIndex((r) => r.day === row.day);
      const stored = { day: row.day, counters: row.counters };
      if (idx >= 0) tables.stats_daily[idx] = stored;
      else tables.stats_daily.push(stored);
    }
  } else if (table === 'srs_state') {
    for (const row of rows) {
      const idx = tables.srs_state.findIndex((r) => r.srs_key === row.srs_key);
      const stored = {
        srs_key: row.srs_key,
        box: row.box,
        last_reviewed: row.last_reviewed,
        next_due: row.next_due,
        reps: row.reps,
      };
      if (idx >= 0) tables.srs_state[idx] = stored;
      else tables.srs_state.push(stored);
    }
  } else if (table === 'settings') {
    tables.settings = rows.map((r) => ({ data: r.data, user_id: r.user_id }));
  }
}

function makeFakeClient(seed = {}, { persist = false } = {}) {
  const tables = { srs_state: [], stats_daily: [], settings: [], ...seed };
  const calls = { upserts: [] };
  return {
    _tables: tables,
    _calls: calls,
    from(table) {
      return {
        upsert: (rows) => {
          calls.upserts.push({ table, rows });
          if (persist) persistUpsert(tables, table, rows);
          return Promise.resolve({ error: null });
        },
        select: () => Promise.resolve({ data: tables[table], error: null }),
      };
    },
  };
}

const fake = makeFakeClient();
vi.mock('./auth.js', () => ({
  getSupabase: () => fake,
  isAuthConfigured: () => true,
}));

import { pushAll, pullAndMerge, __setClientForTest, __reconcileNowForTest } from './sync.js';

describe('sync engine', () => {
  beforeEach(() => {
    localStorage.clear();
    fake._calls.upserts = [];
    fake._tables.srs_state = [];
    fake._tables.stats_daily = [];
    fake._tables.settings = [];
    __setClientForTest(null);
  });

  it('pushAll reconciles and upserts srs/daily/settings rows for the user', async () => {
    localStorage.setItem(
      'deutsch-app-state-v1',
      JSON.stringify({
        srs: { 'g:h': { box: 2, lastReviewed: 100, nextDue: 200, reps: 1 } },
        daily: { [DAY]: counters(3, 3) },
        gamification: { goal: 50 },
        learnedWords: {},
        settingsUpdatedAt: 5,
      })
    );
    localStorage.setItem('deutsch-level', 'a2');
    await pushAll('user-1');
    const tables = fake._calls.upserts.map((u) => u.table).sort();
    expect(tables).toEqual(['settings', 'srs_state', 'stats_daily']);
    expect(
      fake._calls.upserts.every((u) => u.rows.every?.((r) => r.user_id === 'user-1') ?? true)
    ).toBe(true);
  });

  it('pullAndMerge folds guest local stats into the account exactly once (persisting server)', async () => {
    localStorage.setItem(
      'deutsch-app-state-v1',
      JSON.stringify({ daily: { [DAY]: counters(5, 5) } })
    );
    const seeded = makeFakeClient(
      { stats_daily: [{ day: DAY, counters: counters(5, 5) }] },
      { persist: true }
    );
    __setClientForTest(seeded);
    await pullAndMerge('user-1');
    const pushed = seeded._calls.upserts.filter((u) => u.table === 'stats_daily').pop();
    expect(pushed.rows[0].counters.total).toBe(10);
    await pullAndMerge('user-1');
    const pushed2 = seeded._calls.upserts.filter((u) => u.table === 'stats_daily').pop();
    expect(pushed2.rows[0].counters.total).toBe(10);
  });

  it('reconcile after local activity does not double-count on a second pull', async () => {
    const seeded = makeFakeClient({}, { persist: true });
    __setClientForTest(seeded);

    localStorage.setItem('deutsch-app-state-v1', JSON.stringify({ daily: {} }));
    await pullAndMerge('user-1');

    localStorage.setItem(
      'deutsch-app-state-v1',
      JSON.stringify({ daily: { [DAY]: counters(3, 3) } })
    );
    await pushAll('user-1');
    const afterPush = seeded._tables.stats_daily.find((r) => r.day === DAY);
    expect(afterPush.counters.total).toBe(3);

    await pullAndMerge('user-1');
    const afterResume = seeded._tables.stats_daily.find((r) => r.day === DAY);
    expect(afterResume.counters.total).toBe(3);
  });

  it('does not clobber local activity recorded during the reconcile (no lost answers)', async () => {
    localStorage.setItem(
      'deutsch-app-state-v1',
      JSON.stringify({ daily: { [DAY]: counters(3, 3) } })
    );
    // A client whose FIRST select() simulates the user answering one more card
    // mid-reconcile: today's counter goes 3 -> 4 while pullAndMerge is awaiting.
    const seeded = makeFakeClient({}, { persist: true });
    const realFrom = seeded.from.bind(seeded);
    let injected = false;
    seeded.from = (table) => {
      const api = realFrom(table);
      const realSelect = api.select;
      api.select = () => {
        if (!injected) {
          injected = true;
          const blob = JSON.parse(localStorage.getItem('deutsch-app-state-v1'));
          blob.daily[DAY] = counters(4, 4);
          localStorage.setItem('deutsch-app-state-v1', JSON.stringify(blob));
        }
        return realSelect();
      };
      return api;
    };
    __setClientForTest(seeded);
    await pullAndMerge('user-1');
    const after = JSON.parse(localStorage.getItem('deutsch-app-state-v1'));
    expect(after.daily[DAY].total).toBe(4); // the concurrently-recorded 4th answer must survive
  });

  it('serializes overlapping reconciles so concurrent triggers cannot double-count', async () => {
    localStorage.setItem(
      'deutsch-app-state-v1',
      JSON.stringify({ daily: { [DAY]: counters(5, 5) } })
    );
    const seeded = makeFakeClient({}, { persist: true });
    __setClientForTest(seeded);

    // Two triggers race — e.g. a visibilitychange firing while the debounced
    // reconcile is mid-flight. Without an in-flight guard the two pullAndMerge
    // runs interleave and re-add the day's delta (runaway double-count).
    await Promise.all([__reconcileNowForTest('user-1'), __reconcileNowForTest('user-1')]);

    const row = seeded._tables.stats_daily.find((r) => r.day === DAY);
    expect(row.counters.total).toBe(5); // folded in exactly once
  });
});
