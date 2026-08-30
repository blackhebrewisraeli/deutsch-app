import { describe, it, expect } from 'vitest';
import {
  mergeSrs,
  addCounters,
  subCounters,
  mergeDailyAdditive,
  mergeSettings,
  mergeDecks,
} from './merge.js';
import { trialStatus } from '../trial.js';
import { TRIAL_ROUND_CAP } from '../gameConfig.js';

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

  it('level follows its own timestamp, not the whole-row winner (regression 2026-08-24)', () => {
    // Local's blob write is newer overall (wins goal, the scalar LWW)...
    const local = { settingsUpdatedAt: 200, goal: 50, level: 'a1', levelUpdatedAt: 50 };
    // ...but the server's LEVEL was set more recently than local's stale a1.
    const remote = { settingsUpdatedAt: 100, goal: 30, level: 'b1', levelUpdatedAt: 150 };
    const out = mergeSettings(local, remote);
    expect(out.goal).toBe(50); // scalar settings still whole-row LWW (local newer)
    expect(out.level).toBe('b1'); // level follows its own more-recent timestamp, survives the row LWW
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

// The spec's success criterion for the guest trial is that "a trial user who
// signs in keeps 100% of trial progress". The merge engine already delivers
// that — this proves it rather than changing it. If this block ever goes red,
// merge.js is not the thing to edit: the trial's promise is broken.
describe('guest trial data survives sign-in', () => {
  const day = (byTab, correct) => ({
    total: Object.values(byTab).reduce((a, b) => a + b, 0),
    byTab: { chat: 0, alphabet: 0, vocab: 0, translate: 0, ...byTab },
    byLevel: {
      a1: { correct, almost: 0, wrong: 0 },
      a2: { correct: 0, almost: 0, wrong: 0 },
      b1: { correct: 0, almost: 0, wrong: 0 },
    },
  });

  // A guest who ran the trial all the way to the hard cap: 62 rounds over
  // three days, all four tabs sampled, a qualifying day in there.
  const guestDaily = {
    '2026-08-01': day({ chat: 12, alphabet: 9 }, 8),
    '2026-08-02': day({ vocab: 14, translate: 7 }, 6),
    '2026-08-03': day({ chat: 20 }, 11),
  };

  it('is at or past the trial cap before signing in', () => {
    const before = trialStatus(guestDaily, { goal: 50 });
    expect(before.roundsUsed).toBeGreaterThanOrEqual(TRIAL_ROUND_CAP);
    expect(before.exhausted).toBe(true);
    expect(before.tabsSampled).toBe(4);
  });

  // First sync after sign-in: the account has no rows and the device has no
  // baseline, so the delta is the entire local value and every round lands.
  it('folds every round into a fresh account on the first sync', () => {
    const merged = {};
    for (const [key, local] of Object.entries(guestDaily)) {
      merged[key] = mergeDailyAdditive({ local, server: undefined, lastSynced: undefined }).server;
    }
    expect(merged).toEqual(guestDaily);

    const before = trialStatus(guestDaily, { goal: 50 });
    const after = trialStatus(merged, { goal: 50 });
    expect(after).toEqual(before);
  });

  it('does not double-count the trial when the sync repeats', () => {
    const first = {};
    const baseline = {};
    for (const [key, local] of Object.entries(guestDaily)) {
      const out = mergeDailyAdditive({ local, server: undefined, lastSynced: undefined });
      first[key] = out.server;
      baseline[key] = out.lastSynced;
    }
    const second = {};
    for (const [key, local] of Object.entries(guestDaily)) {
      second[key] = mergeDailyAdditive({
        local,
        server: first[key],
        lastSynced: baseline[key],
      }).server;
    }
    expect(second).toEqual(guestDaily);
    expect(trialStatus(second, { goal: 50 }).roundsUsed).toBe(
      trialStatus(guestDaily, { goal: 50 }).roundsUsed
    );
  });

  // Signing in on a device that already has account history adds to it — the
  // trial rounds are never the thing that gets dropped.
  it('adds the trial on top of rounds the account already had', () => {
    const key = '2026-08-01';
    const existing = day({ vocab: 30 }, 15);
    const merged = mergeDailyAdditive({
      local: guestDaily[key],
      server: existing,
      lastSynced: undefined,
    }).server;
    expect(merged.total).toBe(guestDaily[key].total + existing.total);
    expect(merged.byTab.chat).toBe(12);
    expect(merged.byTab.vocab).toBe(30);
  });
});

describe('mergeDecks', () => {
  const deck = (deckId, updatedAt, name = deckId) => ({
    deckId,
    name,
    cards: [{ id: `${deckId}-card`, de: deckId }],
    updatedAt,
  });

  it('keeps a deck that exists only locally', () => {
    expect(mergeDecks({ a: deck('a', 10) }, {})).toEqual({ a: deck('a', 10) });
  });

  it('adopts a deck that exists only on the server', () => {
    expect(mergeDecks({}, { b: deck('b', 10) })).toEqual({ b: deck('b', 10) });
  });

  it('takes the union rather than one side wholesale', () => {
    const merged = mergeDecks({ a: deck('a', 1) }, { b: deck('b', 2) });
    expect(Object.keys(merged).sort()).toEqual(['a', 'b']);
  });

  it('keeps the local deck when its updatedAt is newer', () => {
    const merged = mergeDecks({ a: deck('a', 200, 'local') }, { a: deck('a', 100, 'server') });
    expect(merged.a.name).toBe('local');
  });

  it('takes the server deck when its updatedAt is newer', () => {
    const merged = mergeDecks({ a: deck('a', 100, 'local') }, { a: deck('a', 200, 'server') });
    expect(merged.a.name).toBe('server');
  });

  it('resolves an exact tie to remote, matching mergeSrs', () => {
    const merged = mergeDecks({ a: deck('a', 100, 'local') }, { a: deck('a', 100, 'server') });
    expect(merged.a.name).toBe('server');
  });

  it('lets a real timestamp beat a missing one, in both directions', () => {
    expect(mergeDecks({ a: deck('a', 1, 'local') }, { a: deck('a', null, 'server') }).a.name).toBe(
      'local'
    );
    expect(mergeDecks({ a: deck('a', null, 'local') }, { a: deck('a', 1, 'server') }).a.name).toBe(
      'server'
    );
  });

  it('resolves two missing timestamps to remote rather than throwing', () => {
    const merged = mergeDecks({ a: deck('a', null, 'local') }, { a: deck('a', null, 'server') });
    expect(merged.a.name).toBe('server');
  });

  it('carries the winning deck across whole — cards are never merged per card', () => {
    const local = {
      a: { deckId: 'a', name: 'local', cards: [{ id: 'x' }, { id: 'y' }], updatedAt: 9 },
    };
    const remote = { a: { deckId: 'a', name: 'server', cards: [{ id: 'z' }], updatedAt: 1 } };
    expect(mergeDecks(local, remote).a.cards).toEqual([{ id: 'x' }, { id: 'y' }]);
  });

  it('decides each deck on its OWN clock, not one clock for the slice', () => {
    // The whole point of per-deck LWW: a newer local deck must not drag an
    // older local one over a fresher server copy.
    const local = { a: deck('a', 500, 'local'), b: deck('b', 1, 'local') };
    const remote = { a: deck('a', 100, 'server'), b: deck('b', 400, 'server') };
    const merged = mergeDecks(local, remote);
    expect(merged.a.name).toBe('local');
    expect(merged.b.name).toBe('server');
  });

  it.each([
    ['both sides empty', {}, {}],
    ['null local', null, {}],
    ['null remote', {}, null],
    ['both null', null, null],
  ])('returns {} for %s', (_label, local, remote) => {
    expect(mergeDecks(local, remote)).toEqual({});
  });

  it('does not mutate either input', () => {
    const local = { a: deck('a', 200) };
    const remote = { a: deck('a', 100) };
    const before = [JSON.stringify(local), JSON.stringify(remote)];
    mergeDecks(local, remote);
    expect([JSON.stringify(local), JSON.stringify(remote)]).toEqual(before);
  });
});
