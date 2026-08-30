import { describe, it, expect } from 'vitest';
import {
  srsToRows,
  srsFromRows,
  dailyToRows,
  dailyFromRows,
  settingsToRow,
  settingsFromRow,
  decksToRows,
  decksFromRows,
} from './adapters.js';

describe('srs adapter', () => {
  it('round-trips ms↔ISO and srs_key', () => {
    const srs = {
      'greetings:hallo': { box: 3, lastReviewed: 1750000000000, nextDue: 1750086400000, reps: 4 },
    };
    const rows = srsToRows(srs);
    expect(rows[0].srs_key).toBe('greetings:hallo');
    expect(typeof rows[0].last_reviewed).toBe('string'); // ISO
    expect(srsFromRows(rows)).toEqual(srs);
  });
  it('null lastReviewed maps to null timestamptz and back', () => {
    const srs = { x: { box: 1, lastReviewed: null, nextDue: null, reps: 0 } };
    expect(srsFromRows(srsToRows(srs))).toEqual(srs);
  });

  it('a NaN timestamp maps to null instead of throwing', () => {
    const srs = { x: { box: 1, lastReviewed: NaN, nextDue: NaN, reps: 0 } };
    const rows = srsToRows(srs); // must not throw
    expect(rows[0].last_reviewed).toBeNull();
    expect(rows[0].next_due).toBeNull();
  });

  it('a corrupt ISO timestamp from a row maps to null', () => {
    const rows = [{ srs_key: 'x', box: 1, last_reviewed: 'not-a-date', next_due: null, reps: 0 }];
    expect(srsFromRows(rows).x.lastReviewed).toBeNull();
  });
});

describe('daily adapter', () => {
  it('round-trips day↔row with counters jsonb', () => {
    const daily = {
      '2026-06-19': {
        total: 5,
        byTab: { chat: 5, alphabet: 0, vocab: 0, translate: 0 },
        byLevel: {
          a1: { correct: 5, almost: 0, wrong: 0 },
          a2: { correct: 0, almost: 0, wrong: 0 },
          b1: { correct: 0, almost: 0, wrong: 0 },
        },
      },
    };
    const rows = dailyToRows(daily);
    expect(rows[0].day).toBe('2026-06-19');
    expect(rows[0].counters.total).toBe(5);
    expect(dailyFromRows(rows)).toEqual(daily);
  });
});

describe('settings adapter', () => {
  it('bundles gamification + learnedWords + level into data, and back', () => {
    const local = {
      gamification: { goal: 50, soundOn: true, achievements: {}, lastGoalMet: null },
      learnedWords: { hallo: true },
      settingsUpdatedAt: 123,
    };
    const row = settingsToRow(local, 'b1'); // level passed in (separate key)
    expect(row.data.level).toBe('b1');
    expect(row.data.goal).toBe(50);
    const back = settingsFromRow(row);
    expect(back.level).toBe('b1');
    expect(back.gamification.goal).toBe(50);
    expect(back.learnedWords.hallo).toBe(true);
    expect(back.settingsUpdatedAt).toBe(123);
  });

  it('carries levelUpdatedAt round-trip, independent of settingsUpdatedAt', () => {
    const local = {
      gamification: { goal: 50 },
      learnedWords: {},
      settingsUpdatedAt: 123,
    };
    const row = settingsToRow(local, 'b1', 999);
    expect(row.data.levelUpdatedAt).toBe(999);
    const back = settingsFromRow(row);
    expect(back.levelUpdatedAt).toBe(999);
    expect(back.settingsUpdatedAt).toBe(123);
  });

  it('carries frozenDays / bestStreak / lastReconcileDay round-trip', () => {
    const local = {
      gamification: {
        goal: 50,
        frozenDays: { '2026-06-08': true },
        bestStreak: 9,
        lastReconcileDay: '2026-06-10',
      },
      learnedWords: {},
      settingsUpdatedAt: 1,
    };
    const back = settingsFromRow(settingsToRow(local, 'a1'));
    expect(back.gamification.frozenDays).toEqual({ '2026-06-08': true });
    expect(back.gamification.bestStreak).toBe(9);
    expect(back.gamification.lastReconcileDay).toBe('2026-06-10');
  });
});

describe('deck adapters', () => {
  const localDeck = {
    custom: {
      deckId: 'custom',
      name: 'Weather',
      cards: [{ id: 'die Sonne', de: 'die Sonne', en: 'the sun' }],
      updatedAt: Date.parse('2026-08-30T10:00:00.000Z'),
      deletedAt: null,
    },
  };

  it('maps a local deck to its row shape, carrying cards whole', () => {
    expect(decksToRows(localDeck)).toEqual([
      {
        deck_id: 'custom',
        name: 'Weather',
        cards: [{ id: 'die Sonne', de: 'die Sonne', en: 'the sun' }],
        updated_at: '2026-08-30T10:00:00.000Z',
        deleted_at: null,
      },
    ]);
  });

  it('keys the row off the map key, not the stored deckId field', () => {
    const rows = decksToRows({ custom: { deckId: 'wrong', name: 'n', cards: [], updatedAt: 1 } });
    expect(rows[0].deck_id).toBe('custom');
  });

  it('OMITS updated_at when there is no local timestamp, so the column default stamps it', () => {
    // decks.updated_at is NOT NULL: sending null would fail the write, and
    // fabricating `now()` locally would win LWW forever.
    const rows = decksToRows({ custom: { name: 'n', cards: [{ id: 'a' }], updatedAt: null } });
    expect(rows[0]).not.toHaveProperty('updated_at');
    expect(Object.keys(rows[0]).sort()).toEqual(['cards', 'deck_id', 'deleted_at', 'name']);
  });

  it('falls back to the deck id for a missing name — the column is NOT NULL', () => {
    expect(decksToRows({ custom: { cards: [], updatedAt: 1 } })[0].name).toBe('custom');
  });

  it.each([
    ['an empty map', {}],
    ['null', null],
    ['undefined', undefined],
  ])('maps %s to no rows', (_label, decks) => {
    expect(decksToRows(decks)).toEqual([]);
  });

  it('maps server rows back to the local shape', () => {
    expect(
      decksFromRows([
        {
          deck_id: 'custom',
          name: 'Weather',
          cards: [{ id: 'die Sonne' }],
          updated_at: '2026-08-30T10:00:00.000Z',
        },
      ])
    ).toEqual({
      custom: {
        deckId: 'custom',
        name: 'Weather',
        cards: [{ id: 'die Sonne' }],
        updatedAt: Date.parse('2026-08-30T10:00:00.000Z'),
        deletedAt: null,
      },
    });
  });

  it('round-trips a deck through rows and back unchanged', () => {
    expect(decksFromRows(decksToRows(localDeck))).toEqual(localDeck);
  });

  it('normalises an unparseable or absent updated_at to null', () => {
    expect(decksFromRows([{ deck_id: 'a', cards: [] }]).a.updatedAt).toBeNull();
    expect(decksFromRows([{ deck_id: 'a', cards: [], updated_at: 'soon' }]).a.updatedAt).toBeNull();
  });

  it('defends against a row with non-array cards', () => {
    expect(decksFromRows([{ deck_id: 'a', cards: null }]).a.cards).toEqual([]);
  });

  it('skips a row with no deck_id rather than keying a deck on undefined', () => {
    expect(decksFromRows([{ name: 'orphan', cards: [] }])).toEqual({});
  });

  it.each([
    ['no rows', []],
    ['null', null],
  ])('maps %s to an empty map', (_label, rows) => {
    expect(decksFromRows(rows)).toEqual({});
  });
});

describe('deck adapters — tombstones', () => {
  it('sends deleted_at for a tombstone', () => {
    const rows = decksToRows({
      custom: { name: 'Weather', cards: [], updatedAt: 100, deletedAt: 100 },
    });
    expect(rows[0].deleted_at).toBe(new Date(100).toISOString());
  });

  it('sends deleted_at: null for a live deck, so regenerating CLEARS the column', () => {
    // Omitting it would leave an old tombstone standing on the server and the
    // revived deck would vanish again on the next pull.
    const rows = decksToRows({ custom: { name: 'W', cards: [{ id: 'a' }], updatedAt: 1 } });
    expect(rows[0]).toHaveProperty('deleted_at', null);
  });

  it('KEEPS a tombstoned row rather than filtering it out', () => {
    // A deletion only wins the merge if the merge can see it.
    const decks = decksFromRows([
      {
        deck_id: 'custom',
        name: 'W',
        cards: [],
        updated_at: new Date(100).toISOString(),
        deleted_at: new Date(100).toISOString(),
      },
    ]);
    expect(decks.custom).toMatchObject({ deckId: 'custom', deletedAt: 100 });
  });

  it('drops any cards that came back on a tombstoned row', () => {
    const decks = decksFromRows([
      {
        deck_id: 'custom',
        cards: [{ id: 'stale' }],
        updated_at: null,
        deleted_at: new Date(5).toISOString(),
      },
    ]);
    expect(decks.custom.cards).toEqual([]);
  });

  it('reads a live row as deletedAt null', () => {
    const decks = decksFromRows([{ deck_id: 'custom', cards: [{ id: 'a' }], deleted_at: null }]);
    expect(decks.custom.deletedAt).toBeNull();
  });

  it('round-trips a tombstone through rows and back', () => {
    const tomb = {
      custom: { deckId: 'custom', name: 'W', cards: [], updatedAt: 100, deletedAt: 100 },
    };
    expect(decksFromRows(decksToRows(tomb))).toEqual(tomb);
  });
});
