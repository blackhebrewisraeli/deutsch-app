import { describe, it, expect } from 'vitest';
import { mergeSrs, addCounters, subCounters, mergeDailyAdditive, mergeSettings } from './merge.js';

describe('mergeSrs', () => {
  const card = (lastReviewed, box) => ({ box, lastReviewed, nextDue: lastReviewed + 1, reps: 1 });

  it('keeps the record with the more recent lastReviewed', () => {
    const local = { 'greetings:hallo': card(200, 3) };
    const remote = { 'greetings:hallo': card(100, 2) };
    expect(mergeSrs(local, remote)['greetings:hallo'].box).toBe(3); // local newer
    expect(mergeSrs(remote, local)['greetings:hallo'].box).toBe(3); // symmetric
  });

  it('unions cards present on only one side', () => {
    const local = { a: card(100, 1) };
    const remote = { b: card(100, 1) };
    const out = mergeSrs(local, remote);
    expect(Object.keys(out).sort()).toEqual(['a', 'b']);
  });

  it('a real lastReviewed beats null/undefined', () => {
    const local = { x: { box: 1, lastReviewed: null, nextDue: 0, reps: 0 } };
    const remote = { x: card(100, 4) };
    expect(mergeSrs(local, remote).x.box).toBe(4);
  });

  it('exact tie resolves to the remote (server) record', () => {
    const local = { x: card(100, 2) };
    const remote = { x: card(100, 5) };
    expect(mergeSrs(local, remote).x.box).toBe(5);
  });
});

describe('counter arithmetic', () => {
  const day = (total, chat = 0) => ({
    total,
    byTab: { chat, alphabet: 0, vocab: 0, translate: 0 },
    byLevel: {
      a1: { correct: 0, almost: 0, wrong: 0 },
      a2: { correct: 0, almost: 0, wrong: 0 },
      b1: { correct: 0, almost: 0, wrong: 0 },
    },
  });

  it('addCounters sums leaf-by-leaf', () => {
    expect(addCounters(day(5, 5), day(3, 3))).toEqual(day(8, 8));
  });

  it('subCounters subtracts leaf-by-leaf', () => {
    expect(subCounters(day(8, 8), day(5, 5))).toEqual(day(3, 3));
  });

  it('addCounters treats a missing side as zero', () => {
    expect(addCounters(undefined, day(3, 3))).toEqual(day(3, 3));
    expect(addCounters(day(5, 5), undefined)).toEqual(day(5, 5));
  });
});

describe('mergeDailyAdditive (delta sync)', () => {
  const day = (total) => ({
    total,
    byTab: { chat: total, alphabet: 0, vocab: 0, translate: 0 },
    byLevel: {
      a1: { correct: 0, almost: 0, wrong: 0 },
      a2: { correct: 0, almost: 0, wrong: 0 },
      b1: { correct: 0, almost: 0, wrong: 0 },
    },
  });

  it('server += (local - lastSynced); idempotent on re-sync', () => {
    const r1 = mergeDailyAdditive({ local: day(5), server: undefined, lastSynced: undefined });
    expect(r1.server.total).toBe(5);
    expect(r1.lastSynced.total).toBe(5);

    const r2 = mergeDailyAdditive({ local: day(5), server: r1.server, lastSynced: r1.lastSynced });
    expect(r2.server.total).toBe(5);
  });

  it('adds only the new local delta after more activity', () => {
    const server = { ...day(10) };
    const r = mergeDailyAdditive({ local: day(8), server, lastSynced: day(5) });
    expect(r.server.total).toBe(13); // 10 + (8-5)
    expect(r.lastSynced.total).toBe(8);
  });

  it('floors a negative delta — a cleared/desynced local never decrements the server', () => {
    // local fell to 0 but its baseline still says 5 (storage cleared mid-session)
    expect(
      mergeDailyAdditive({ local: day(0), server: day(5), lastSynced: day(5) }).server.total
    ).toBe(5);
    // and the shared total never goes negative
    expect(
      mergeDailyAdditive({ local: day(0), server: day(0), lastSynced: day(5) }).server.total
    ).toBe(0);
  });
});

describe('mergeSettings', () => {
  it('whole-object LWW by settingsUpdatedAt; tie → remote', () => {
    const local = { settingsUpdatedAt: 200, goal: 50, level: 'b1' };
    const remote = { settingsUpdatedAt: 100, goal: 30, level: 'a1' };
    expect(mergeSettings(local, remote).goal).toBe(50); // local newer
    expect(mergeSettings({ ...local, settingsUpdatedAt: 100 }, remote)).toEqual(remote); // tie → remote
  });

  it('a missing remote means local wins (first push)', () => {
    const local = { settingsUpdatedAt: 5, goal: 50 };
    expect(mergeSettings(local, null)).toEqual(local);
  });

  it('a missing local means remote wins (fresh device pull)', () => {
    const remote = { settingsUpdatedAt: 5, goal: 30 };
    expect(mergeSettings(null, remote)).toEqual(remote);
  });

  it('unions learnedWords so cross-device LWW never drops a learned mark (#41)', () => {
    // local is newer (wins the scalar LWW) but has fewer learned words
    const local = { settingsUpdatedAt: 200, goal: 50, learnedWords: { hallo: true } };
    const remote = { settingsUpdatedAt: 100, goal: 30, learnedWords: { hallo: true, danke: true } };
    const out = mergeSettings(local, remote);
    expect(out.goal).toBe(50); // scalar settings still LWW (local newer)
    expect(out.learnedWords).toEqual({ hallo: true, danke: true }); // remote's 'danke' survives
  });

  it('a word stays learned if either side has it (OR union)', () => {
    const a = { settingsUpdatedAt: 1, learnedWords: { x: true, y: false } };
    const b = { settingsUpdatedAt: 2, learnedWords: { x: false, y: true } };
    expect(mergeSettings(a, b).learnedWords).toEqual({ x: true, y: true });
  });

  it('unions frozenDays and maxes bestStreak across devices (sync-safe)', () => {
    const local = {
      settingsUpdatedAt: 200,
      gamification: { goal: 50, frozenDays: { '2026-06-08': true }, bestStreak: 5 },
    };
    const remote = {
      settingsUpdatedAt: 100,
      gamification: { goal: 30, frozenDays: { '2026-06-10': true }, bestStreak: 9 },
    };
    const out = mergeSettings(local, remote);
    expect(out.gamification.frozenDays).toEqual({ '2026-06-08': true, '2026-06-10': true });
    expect(out.gamification.bestStreak).toBe(9); // max wins even though remote is older
    expect(out.gamification.goal).toBe(50); // scalar gamification still LWW (local newer)
  });
});
