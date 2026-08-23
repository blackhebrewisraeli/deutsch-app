import { describe, it, expect } from 'vitest';
import {
  srsToRows,
  srsFromRows,
  dailyToRows,
  dailyFromRows,
  settingsToRow,
  settingsFromRow,
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
