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
  } else if (table === 'decks') {
    for (const row of rows) {
      const idx = tables.decks.findIndex((r) => r.deck_id === row.deck_id);
      // Mirrors the column default: a row arriving without updated_at is
      // stamped by the server, not stored as null.
      // Models ON CONFLICT DO UPDATE SET <provided columns>: a key the client
      // OMITS is left at its existing value, it is NOT nulled. Defaulting an
      // omitted deleted_at to null here made the fixture incapable of failing
      // when the writer stopped sending it — a tombstone would silently never
      // be cleared in production while the test stayed green.
      const existing = idx >= 0 ? tables.decks[idx] : {};
      const stored = {
        ...existing,
        deck_id: row.deck_id,
        name: row.name,
        cards: row.cards,
        updated_at: row.updated_at ?? existing.updated_at ?? new Date().toISOString(),
        ...('deleted_at' in row ? { deleted_at: row.deleted_at } : {}),
      };
      if (!('deleted_at' in stored)) stored.deleted_at = null;
      if (idx >= 0) tables.decks[idx] = stored;
      else tables.decks.push(stored);
    }
  } else if (table === 'settings') {
    // Models ON CONFLICT DO UPDATE SET <provided columns>: a column the client
    // OMITS keeps its existing value. That is the entire reason learned_by_deck
    // is a column and not a key inside `data` — an older client names only
    // (user_id, data), so it cannot erase what it never mentions.
    const prev = tables.settings[0] ?? {};
    tables.settings = rows.map((r) => ({
      ...prev,
      data: r.data,
      user_id: r.user_id,
      ...('learned_by_deck' in r ? { learned_by_deck: r.learned_by_deck } : {}),
    }));
  }
}

function makeFakeClient(seed = {}, { persist = false } = {}) {
  const tables = { srs_state: [], stats_daily: [], settings: [], decks: [], ...seed };
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
    fake._tables.decks = [];
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

  // Regression 2026-08-24: a real account's level was 'b1' server-side. A
  // browser profile whose local `deutsch-level` had drifted to 'a1' (for
  // reasons unrelated to level) triggered a pullAndMerge whose LOCAL blob had
  // a newer settingsUpdatedAt than the server's b1-setting write. Whole-row
  // LWW then dragged level back to 'a1' even though level itself was never
  // touched on that device this session.
  it('does not let a newer-but-unrelated local write drag level backwards (regression 2026-08-24)', async () => {
    localStorage.setItem(
      'deutsch-app-state-v1',
      JSON.stringify({
        gamification: { goal: 80 }, // some other setting changed locally, more recently…
        settingsUpdatedAt: 500,
        levelUpdatedAt: 50, // …but level itself is stale on this device
      })
    );
    localStorage.setItem('deutsch-level', 'a1');

    const seeded = makeFakeClient(
      {
        settings: [
          {
            data: { goal: 30, level: 'b1', levelUpdatedAt: 300, settingsUpdatedAt: 100 },
            user_id: 'user-1',
          },
        ],
      },
      { persist: true }
    );
    __setClientForTest(seeded);
    await pullAndMerge('user-1');

    expect(localStorage.getItem('deutsch-level')).toBe('b1'); // level survives the row LWW
    const pushedSettings = seeded._tables.settings[0];
    expect(pushedSettings.data.goal).toBe(80); // the genuinely newer scalar setting still wins
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

describe('custom decks sync', () => {
  const iso = (ms) => new Date(ms).toISOString();
  const localBlob = (deck) =>
    localStorage.setItem(
      'deutsch-app-state-v1',
      JSON.stringify({ decks: deck ? { custom: deck } : {} })
    );
  const storedLocally = () =>
    JSON.parse(localStorage.getItem('deutsch-app-state-v1') ?? '{}').decks?.custom;
  const deck = (name, updatedAt) => ({
    deckId: 'custom',
    name,
    cards: [{ id: `${name}-card`, de: name, en: name }],
    updatedAt,
  });
  const row = (name, updatedAtMs) => ({
    deck_id: 'custom',
    name,
    cards: [{ id: `${name}-card`, de: name, en: name }],
    updated_at: iso(updatedAtMs),
  });

  beforeEach(() => {
    localStorage.clear();
    __setClientForTest(null);
  });

  it('pushes a local-only deck to the decks table', async () => {
    localBlob(deck('Weather', 1000));
    const seeded = makeFakeClient({}, { persist: true });
    __setClientForTest(seeded);

    await pullAndMerge('user-1');

    expect(seeded._tables.decks).toHaveLength(1);
    expect(seeded._tables.decks[0]).toMatchObject({ deck_id: 'custom', name: 'Weather' });
  });

  it('scopes every pushed row to the caller, which is what RLS checks', async () => {
    localBlob(deck('Weather', 1000));
    const seeded = makeFakeClient({}, { persist: true });
    __setClientForTest(seeded);

    await pullAndMerge('user-1');

    const pushed = seeded._calls.upserts.find((u) => u.table === 'decks');
    expect(pushed.rows.every((r) => r.user_id === 'user-1' && r.pack_id === 'de')).toBe(true);
  });

  it('adopts a server-only deck into local state', async () => {
    localBlob(null);
    const seeded = makeFakeClient({ decks: [row('Kitchen', 2000)] }, { persist: true });
    __setClientForTest(seeded);

    await pullAndMerge('user-1');

    expect(storedLocally()).toMatchObject({ deckId: 'custom', name: 'Kitchen' });
  });

  it('keeps the LOCAL deck end-to-end when it is newer, overwriting the server row', async () => {
    localBlob(deck('Newer local', 5000));
    const seeded = makeFakeClient({ decks: [row('Older server', 1000)] }, { persist: true });
    __setClientForTest(seeded);

    await pullAndMerge('user-1');

    expect(storedLocally().name).toBe('Newer local');
    expect(seeded._tables.decks[0].name).toBe('Newer local');
  });

  it('takes the SERVER deck end-to-end when it is newer, overwriting the local blob', async () => {
    localBlob(deck('Older local', 1000));
    const seeded = makeFakeClient({ decks: [row('Newer server', 5000)] }, { persist: true });
    __setClientForTest(seeded);

    await pullAndMerge('user-1');

    expect(storedLocally().name).toBe('Newer server');
    expect(seeded._tables.decks[0].name).toBe('Newer server');
  });

  it('resolves an exact timestamp tie to the server copy', async () => {
    localBlob(deck('Local', 4242));
    const seeded = makeFakeClient({ decks: [row('Server', 4242)] }, { persist: true });
    __setClientForTest(seeded);

    await pullAndMerge('user-1');

    expect(storedLocally().name).toBe('Server');
  });

  it('issues no decks upsert at all when there is nothing to sync', async () => {
    localBlob(null);
    const seeded = makeFakeClient({}, { persist: true });
    __setClientForTest(seeded);

    await pullAndMerge('user-1');

    expect(seeded._calls.upserts.filter((u) => u.table === 'decks')).toEqual([]);
  });

  it('is idempotent — a second reconcile changes nothing', async () => {
    localBlob(deck('Weather', 3000));
    const seeded = makeFakeClient({}, { persist: true });
    __setClientForTest(seeded);

    await pullAndMerge('user-1');
    const afterFirst = JSON.stringify(seeded._tables.decks);
    await pullAndMerge('user-1');

    expect(JSON.stringify(seeded._tables.decks)).toBe(afterFirst);
    expect(seeded._tables.decks).toHaveLength(1);
  });

  it('ignores a corrupted local deck rather than pushing a malformed row', async () => {
    localStorage.setItem(
      'deutsch-app-state-v1',
      JSON.stringify({ decks: { custom: { cards: 'not-an-array' } } })
    );
    const seeded = makeFakeClient({}, { persist: true });
    __setClientForTest(seeded);

    await pullAndMerge('user-1');

    expect(seeded._calls.upserts.filter((u) => u.table === 'decks')).toEqual([]);
    expect(seeded._tables.decks).toEqual([]);
  });

  it('keeps a deck generated DURING the reconcile', async () => {
    // The re-read-at-write-time block: a learner can generate a deck while the
    // awaits above are in flight, and spreading the stale blob would drop it.
    localBlob(null);
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
          blob.decks = { custom: deck('Generated mid-reconcile', 9999) };
          localStorage.setItem('deutsch-app-state-v1', JSON.stringify(blob));
        }
        return realSelect();
      };
      return api;
    };
    __setClientForTest(seeded);

    await pullAndMerge('user-1');

    expect(storedLocally()?.name).toBe('Generated mid-reconcile');
  });

  it('does not disturb the other slices', async () => {
    localStorage.setItem(
      'deutsch-app-state-v1',
      JSON.stringify({
        decks: { custom: deck('Weather', 1000) },
        srs: { 'g:h': { box: 2, lastReviewed: 100, nextDue: 200, reps: 1 } },
        daily: { [DAY]: counters(3, 3) },
        gamification: { goal: 50 },
        settingsUpdatedAt: 5,
      })
    );
    const seeded = makeFakeClient({}, { persist: true });
    __setClientForTest(seeded);

    await pullAndMerge('user-1');

    const tables = seeded._calls.upserts.map((u) => u.table).sort();
    expect(tables).toEqual(['decks', 'settings', 'srs_state', 'stats_daily']);
    expect(seeded._tables.stats_daily[0].counters.total).toBe(3);
    expect(seeded._tables.srs_state[0].srs_key).toBe('g:h');
  });
});

describe('deck tombstones survive a pull (no resurrection)', () => {
  const iso = (ms) => new Date(ms).toISOString();
  const blob = (decks) => localStorage.setItem('deutsch-app-state-v1', JSON.stringify({ decks }));
  const localDeck = () =>
    JSON.parse(localStorage.getItem('deutsch-app-state-v1') ?? '{}').decks?.custom;
  const liveRow = (name, ms) => ({
    deck_id: 'custom',
    name,
    cards: [{ id: `${name}-card`, de: name, en: name }],
    updated_at: iso(ms),
    deleted_at: null,
  });
  const tombstone = (ms) => ({
    deckId: 'custom',
    name: 'Weather',
    cards: [],
    updatedAt: ms,
    deletedAt: ms,
  });
  const liveLocal = (name, ms) => ({
    deckId: 'custom',
    name,
    cards: [{ id: `${name}-card`, de: name, en: name }],
    updatedAt: ms,
    deletedAt: null,
  });

  beforeEach(() => {
    localStorage.clear();
    __setClientForTest(null);
  });

  it('THE BUG: a deck deleted offline is not resurrected by the other device copy', async () => {
    // Device A deleted the deck at t=5000 while offline. Device B never knew,
    // so the server still holds the live row from t=1000. Under an upsert-only
    // engine the pull re-adds it and the deletion is silently undone.
    blob({ custom: tombstone(5000) });
    const seeded = makeFakeClient({ decks: [liveRow('Weather', 1000)] }, { persist: true });
    __setClientForTest(seeded);

    await pullAndMerge('user-1');

    expect(localDeck().deletedAt).toBe(5000);
    expect(seeded._tables.decks[0].deleted_at).toBe(iso(5000));
  });

  it('propagates the tombstone to the server so the other device learns of it', async () => {
    blob({ custom: tombstone(5000) });
    const seeded = makeFakeClient({ decks: [liveRow('Weather', 1000)] }, { persist: true });
    __setClientForTest(seeded);

    await pullAndMerge('user-1');

    const pushed = seeded._calls.upserts.find((u) => u.table === 'decks');
    expect(pushed.rows[0]).toMatchObject({ deck_id: 'custom', deleted_at: iso(5000) });
    expect(pushed.rows[0].user_id).toBe('user-1');
  });

  it('adopts a server tombstone, removing a deck this device still thinks is live', async () => {
    // The mirror image: device B deleted it, this device pulls.
    blob({ custom: liveLocal('Weather', 1000) });
    const seeded = makeFakeClient(
      {
        decks: [
          {
            deck_id: 'custom',
            name: 'Weather',
            cards: [],
            updated_at: iso(9000),
            deleted_at: iso(9000),
          },
        ],
      },
      { persist: true }
    );
    __setClientForTest(seeded);

    await pullAndMerge('user-1');

    expect(localDeck().deletedAt).toBe(9000);
  });

  it('lets a LATER regeneration legitimately revive a tombstoned slot', async () => {
    // Not every resurrection is a bug: generating a new deck after the delete
    // is a newer write and must win, clearing the tombstone on the server.
    blob({ custom: liveLocal('Regenerated', 9000) });
    const seeded = makeFakeClient(
      {
        decks: [
          {
            deck_id: 'custom',
            name: 'Weather',
            cards: [],
            updated_at: iso(5000),
            deleted_at: iso(5000),
          },
        ],
      },
      { persist: true }
    );
    __setClientForTest(seeded);

    await pullAndMerge('user-1');

    expect(localDeck().deletedAt).toBeNull();
    expect(localDeck().name).toBe('Regenerated');
    expect(seeded._tables.decks[0].deleted_at).toBeNull();
  });

  it('keeps the deck when the server edit is NEWER than the local delete', async () => {
    blob({ custom: tombstone(1000) });
    const seeded = makeFakeClient({ decks: [liveRow('Newer server', 8000)] }, { persist: true });
    __setClientForTest(seeded);

    await pullAndMerge('user-1');

    expect(localDeck().deletedAt).toBeNull();
    expect(localDeck().name).toBe('Newer server');
  });

  it('is idempotent — reconciling twice leaves the tombstone exactly once', async () => {
    blob({ custom: tombstone(5000) });
    const seeded = makeFakeClient({ decks: [liveRow('Weather', 1000)] }, { persist: true });
    __setClientForTest(seeded);

    await pullAndMerge('user-1');
    const first = JSON.stringify(seeded._tables.decks);
    await pullAndMerge('user-1');

    expect(JSON.stringify(seeded._tables.decks)).toBe(first);
    expect(seeded._tables.decks).toHaveLength(1);
  });

  it('a tombstone on both sides stays deleted and stays quiet', async () => {
    blob({ custom: tombstone(5000) });
    const seeded = makeFakeClient(
      {
        decks: [
          {
            deck_id: 'custom',
            name: 'Weather',
            cards: [],
            updated_at: iso(5000),
            deleted_at: iso(5000),
          },
        ],
      },
      { persist: true }
    );
    __setClientForTest(seeded);

    await pullAndMerge('user-1');

    expect(localDeck().deletedAt).toBe(5000);
    expect(seeded._tables.decks[0].deleted_at).toBe(iso(5000));
  });
});

describe('deck-scoped mastery syncs in its own column', () => {
  const blob = (o) => localStorage.setItem('deutsch-app-state-v1', JSON.stringify(o));
  const stored = () => JSON.parse(localStorage.getItem('deutsch-app-state-v1') ?? '{}');

  beforeEach(() => {
    localStorage.clear();
    __setClientForTest(null);
  });

  it('pushes the scoped map into learned_by_deck, not into data', async () => {
    blob({ learnedByDeck: { greetings: { Hallo: true } }, settingsUpdatedAt: 5 });
    const seeded = makeFakeClient({}, { persist: true });
    __setClientForTest(seeded);

    await pullAndMerge('user-1');

    const row = seeded._tables.settings[0];
    expect(row.learned_by_deck).toEqual({ greetings: { Hallo: true } });
    expect(row.data).not.toHaveProperty('learnedByDeck');
  });

  it('adopts a server scoped map this device has never seen', async () => {
    blob({ settingsUpdatedAt: 1 });
    const seeded = makeFakeClient(
      { settings: [{ data: {}, learned_by_deck: { food: { Brot: true } } }] },
      { persist: true }
    );
    __setClientForTest(seeded);

    await pullAndMerge('user-1');

    expect(stored().learnedByDeck).toEqual({ food: { Brot: true } });
  });

  it('UNIONS two devices rather than letting one win', async () => {
    blob({ learnedByDeck: { greetings: { Hallo: true } }, settingsUpdatedAt: 9 });
    const seeded = makeFakeClient(
      { settings: [{ data: { settingsUpdatedAt: 1 }, learned_by_deck: { food: { Brot: true } } }] },
      { persist: true }
    );
    __setClientForTest(seeded);

    await pullAndMerge('user-1');

    // The local blob is NEWER, so whole-row LWW would have dropped the server's
    // deck entirely. Union keeps both.
    expect(stored().learnedByDeck).toEqual({
      greetings: { Hallo: true },
      food: { Brot: true },
    });
  });

  it('SURVIVES an old client push that names only (user_id, data)', async () => {
    // THE test for this epic. settingsToRow is an explicit allowlist, so an old
    // client serialises only the fields it knows. A key inside `data` would be
    // erased; a column it never names cannot be.
    const seeded = makeFakeClient({}, { persist: true });
    blob({ learnedByDeck: { greetings: { Hallo: true } }, settingsUpdatedAt: 5 });
    __setClientForTest(seeded);
    await pullAndMerge('user-1');
    expect(seeded._tables.settings[0].learned_by_deck).toBeTruthy();

    // Now an OLD client pushes: settings row with `data` only.
    seeded
      .from('settings')
      .upsert([{ user_id: 'user-1', data: { goal: 30, settingsUpdatedAt: 99 } }]);

    expect(seeded._tables.settings[0].learned_by_deck).toEqual({ greetings: { Hallo: true } });
  });

  it('backfills flat keys an old client wrote, using the deck their SRS names', async () => {
    // The old device knows only the flat map. This device attributes those keys
    // on the next reconcile — that is what makes the transition converge.
    blob({ srs: { 'greetings:Hallo': { box: 2, lastReviewed: 1, nextDue: 2, reps: 1 } } });
    const seeded = makeFakeClient(
      { settings: [{ data: { learnedWords: { Hallo: true }, settingsUpdatedAt: 50 } }] },
      { persist: true }
    );
    __setClientForTest(seeded);

    await pullAndMerge('user-1');

    expect(stored().learnedByDeck).toEqual({ greetings: { Hallo: true } });
    // The flat map is NOT pruned — it is union-merged, so a delete would be
    // resurrected by the next push from any device that still holds it.
    expect(stored().learnedWords.Hallo).toBe(true);
    expect(seeded._tables.settings[0].data.learnedWords.Hallo).toBe(true);
  });

  it('leaves an unattributable flat key alone rather than guessing a deck', async () => {
    blob({ srs: {} });
    const seeded = makeFakeClient(
      { settings: [{ data: { learnedWords: { Unbekannt: true }, settingsUpdatedAt: 50 } }] },
      { persist: true }
    );
    __setClientForTest(seeded);

    await pullAndMerge('user-1');

    expect(stored().learnedByDeck).toEqual({});
    expect(stored().learnedWords.Unbekannt).toBe(true);
  });

  it('is idempotent — a second reconcile changes nothing', async () => {
    blob({
      learnedByDeck: { greetings: { Hallo: true } },
      srs: { 'greetings:Hallo': { box: 2, lastReviewed: 1, nextDue: 2, reps: 1 } },
      learnedWords: { Hallo: true },
      settingsUpdatedAt: 5,
    });
    const seeded = makeFakeClient({}, { persist: true });
    __setClientForTest(seeded);

    await pullAndMerge('user-1');
    const first = JSON.stringify(seeded._tables.settings[0].learned_by_deck);
    await pullAndMerge('user-1');

    expect(JSON.stringify(seeded._tables.settings[0].learned_by_deck)).toBe(first);
  });
});
