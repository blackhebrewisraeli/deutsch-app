import { describe, it, expect } from 'vitest';
import {
  hashSeed,
  seedFor,
  recentBaseline,
  pickQuests,
  deriveQuests,
  questsCompleted,
  QUEST_CATALOGUE,
  QUEST_COUNT,
  MIN_TARGET,
} from './quests.js';
import { applyEvent, TABS } from './stats.js';

// Days are built with the REAL applyEvent rather than hand-written counter
// objects. A hand-written shape can drift from what the app actually stores and
// the tests would never notice — these fixtures cannot disagree with production.
function dayWith(events) {
  let daily = {};
  for (const [tab, level, verdict] of events) {
    daily = applyEvent(daily, '2026-08-30', tab, level, verdict);
  }
  return daily;
}

const answers = (n, tab = 'vocab', verdict = 'correct') =>
  dayWith(Array.from({ length: n }, () => [tab, 'a1', verdict]));

describe('hashSeed', () => {
  it('is stable for the same input', () => {
    expect(hashSeed('abc')).toBe(hashSeed('abc'));
  });

  it('differs for different inputs', () => {
    expect(hashSeed('abc')).not.toBe(hashSeed('abd'));
  });

  it('returns an unsigned 32-bit integer', () => {
    for (const s of ['', 'a', 'user-1:2026-08-30', 'ü']) {
      const h = hashSeed(s);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(2 ** 32);
    }
  });

  it('handles null and undefined without throwing', () => {
    expect(hashSeed(null)).toBe(hashSeed(undefined));
  });
});

describe('seedFor', () => {
  it('is identical for the same user on the same day — the cross-device property', () => {
    // Two devices, no shared state, same answer. This is the whole design.
    expect(seedFor('user-1', '2026-08-30')).toBe(seedFor('user-1', '2026-08-30'));
  });

  it('differs across days for the same user', () => {
    expect(seedFor('user-1', '2026-08-30')).not.toBe(seedFor('user-1', '2026-08-31'));
  });

  it('differs across users on the same day', () => {
    expect(seedFor('user-1', '2026-08-30')).not.toBe(seedFor('user-2', '2026-08-30'));
  });

  it('gives signed-out learners a stable seed of their own', () => {
    expect(seedFor(undefined, '2026-08-30')).toBe(seedFor(null, '2026-08-30'));
    expect(seedFor(undefined, '2026-08-30')).not.toBe(seedFor('user-1', '2026-08-30'));
  });
});

describe('recentBaseline', () => {
  const daily = {
    '2026-08-25': { total: 2 },
    '2026-08-26': { total: 4 },
    '2026-08-27': { total: 6 },
    '2026-08-28': { total: 22 }, // one binge
    '2026-08-29': { total: 4 },
    '2026-08-30': { total: 99 }, // today — must be ignored
  };

  it("takes the median so one binge does not set tomorrow's bar", () => {
    // mean would be 7.6; median of [2,4,4,6,22] is 4.
    expect(recentBaseline(daily, '2026-08-30')).toBe(4);
  });

  it('EXCLUDES today, which is what the quest is trying to move', () => {
    // Including today (99) would drag the median up and make the target chase
    // the progress.
    expect(recentBaseline(daily, '2026-08-30')).toBeLessThan(10);
  });

  it('averages the middle pair for an even-sized window', () => {
    expect(recentBaseline({ a: { total: 2 }, b: { total: 4 } }, 'z')).toBe(3);
  });

  it('honours the window length, ignoring older days', () => {
    const long = {};
    for (let d = 1; d <= 20; d += 1) long[`2026-08-${String(d).padStart(2, '0')}`] = { total: d };
    // Trailing 7 before the 20th are days 13..19 → median 16.
    expect(recentBaseline(long, '2026-08-20', 7)).toBe(16);
  });

  it.each([
    ['no history', {}],
    ['null', null],
    ['only today', { '2026-08-30': { total: 50 } }],
  ])('falls back to the floor for %s', (_l, d) => {
    expect(recentBaseline(d, '2026-08-30')).toBe(MIN_TARGET);
  });

  it('never returns below the floor, so a lapsed learner is not handed a zero', () => {
    expect(recentBaseline({ '2026-08-29': { total: 0 } }, '2026-08-30')).toBe(MIN_TARGET);
  });
});

describe('pickQuests', () => {
  const seed = seedFor('user-1', '2026-08-30');

  it('returns the requested number', () => {
    expect(pickQuests(QUEST_CATALOGUE, seed, 3)).toHaveLength(3);
  });

  it('is deterministic for a seed', () => {
    const a = pickQuests(QUEST_CATALOGUE, seed).map((q) => q.id);
    const b = pickQuests(QUEST_CATALOGUE, seed).map((q) => q.id);
    expect(a).toEqual(b);
  });

  it('never repeats a group, so a day cannot be three flavours of one idea', () => {
    // Swept across many seeds: a single seed can satisfy this by luck even with
    // the guard removed, which is how the inert-group bug hid.
    let checked = 0;
    for (let d = 1; d <= 60; d += 1) {
      const s = seedFor('user-1', `2026-09-${String(d).padStart(2, '0')}`);
      const groups = pickQuests(QUEST_CATALOGUE, s).map((q) => q.group);
      expect(new Set(groups).size).toBe(groups.length);
      checked += 1;
    }
    expect(checked).toBe(60); // print the denominator
  });

  it('offers at most one tab-focus quest a day', () => {
    for (let d = 1; d <= 60; d += 1) {
      const s = seedFor('user-1', `2026-09-${String(d).padStart(2, '0')}`);
      const focus = pickQuests(QUEST_CATALOGUE, s).filter((q) => q.group === 'focus');
      expect(focus.length).toBeLessThanOrEqual(1);
    }
  });

  it('is independent of catalogue ORDER, so adding a quest does not reshuffle a day', () => {
    const reversed = [...QUEST_CATALOGUE].reverse();
    expect(pickQuests(reversed, seed).map((q) => q.id)).toEqual(
      pickQuests(QUEST_CATALOGUE, seed).map((q) => q.id)
    );
  });

  it('produces different sets for different seeds across a run of days', () => {
    const sets = new Set();
    for (let d = 1; d <= 20; d += 1) {
      const key = `2026-09-${String(d).padStart(2, '0')}`;
      sets.add(
        pickQuests(QUEST_CATALOGUE, seedFor('user-1', key))
          .map((q) => q.id)
          .join(',')
      );
    }
    // Not asserting all-distinct — a finite catalogue repeats — only that the
    // seed actually varies the outcome rather than pinning one set forever.
    expect(sets.size).toBeGreaterThan(1);
  });

  it('returns what it can when the catalogue is smaller than the ask', () => {
    expect(pickQuests(QUEST_CATALOGUE.slice(0, 2), seed, 5)).toHaveLength(2);
  });

  it.each([
    ['an empty catalogue', []],
    ['null', null],
  ])('returns [] for %s', (_l, cat) => {
    expect(pickQuests(cat, seed)).toEqual([]);
  });
});

describe('deriveQuests', () => {
  const todayKey = '2026-08-30';
  const withHistory = (today) => ({
    '2026-08-27': { total: 4 },
    '2026-08-28': { total: 4 },
    '2026-08-29': { total: 4 },
    ...today,
  });

  it('returns QUEST_COUNT quests with a target, progress and done flag', () => {
    const quests = deriveQuests({ userId: 'u1', todayKey, daily: withHistory({}) });
    expect(quests).toHaveLength(QUEST_COUNT);
    for (const q of quests) {
      expect(q).toMatchObject({
        id: expect.any(String),
        target: expect.any(Number),
        progress: expect.any(Number),
        done: expect.any(Boolean),
        tab: expect.any(String),
      });
    }
  });

  it('gives two devices the same quests for the same user and day', () => {
    // Different local histories, same identity: the SET must match even though
    // the progress may not.
    const a = deriveQuests({ userId: 'u1', todayKey, daily: withHistory({}) });
    const b = deriveQuests({ userId: 'u1', todayKey, daily: { '2026-08-01': { total: 40 } } });
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
  });

  it('scales targets off recent activity rather than a flat number', () => {
    const quiet = deriveQuests({ userId: 'u1', todayKey, daily: withHistory({}) });
    const busy = deriveQuests({
      userId: 'u1',
      todayKey,
      daily: {
        '2026-08-27': { total: 40 },
        '2026-08-28': { total: 40 },
        '2026-08-29': { total: 40 },
      },
    });
    const volumeOf = (qs) => qs.find((q) => q.id === 'answer-cards')?.target;
    // Same quest set (same seed), different bar.
    if (volumeOf(quiet) !== undefined) expect(volumeOf(busy)).toBeGreaterThan(volumeOf(quiet));
  });

  it('never sets a target below 1, whatever the history', () => {
    const quests = deriveQuests({ userId: 'u1', todayKey, daily: { '2026-08-29': { total: 0 } } });
    for (const q of quests) expect(q.target).toBeGreaterThanOrEqual(1);
  });

  it('reads progress from the real counters applyEvent writes', () => {
    // Straight against the catalogue's progress functions: deriveQuests picks
    // at most one focus quest a day (one shared group), so it cannot be used to
    // observe all of them at once.
    const day = answers(3, 'vocab', 'correct')[todayKey];
    const progressOf = (id) => QUEST_CATALOGUE.find((q) => q.id === id).progress(day);

    expect(progressOf('answer-cards')).toBe(3);
    expect(progressOf('get-correct')).toBe(3);
    expect(progressOf('focus-vocab')).toBe(3);
    expect(progressOf('focus-chat')).toBe(0);
  });

  it('counts breadth as distinct tabs touched, not answers given', () => {
    let daily = {};
    for (const tab of TABS.slice(0, 2)) {
      for (let i = 0; i < 5; i += 1) daily = applyEvent(daily, todayKey, tab, 'a1', 'correct');
    }
    const day = daily[todayKey];
    expect(QUEST_CATALOGUE.find((q) => q.id === 'practise-tabs').progress(day)).toBe(2);
  });

  it('does not count a wrong answer toward the accuracy quest', () => {
    const day = answers(4, 'vocab', 'wrong')[todayKey];
    const progressOf = (id) => QUEST_CATALOGUE.find((q) => q.id === id).progress(day);
    expect(progressOf('get-correct')).toBe(0);
    expect(progressOf('answer-cards')).toBe(4); // …but it is still an answer
  });

  it('clamps progress at the target so a finished quest reads 7 / 7', () => {
    // Spread across every tab: a breadth quest is not satisfied by volume in
    // one place, which is the point of having it.
    let today = {};
    for (const tab of TABS) {
      for (let i = 0; i < 50; i += 1) today = applyEvent(today, todayKey, tab, 'a1', 'correct');
    }
    const daily = withHistory(today);
    for (const q of deriveQuests({ userId: 'u1', todayKey, daily })) {
      expect(q.progress).toBeLessThanOrEqual(q.target);
      expect(q.done).toBe(true);
    }
  });

  it('reports nothing done on a day with no activity', () => {
    const quests = deriveQuests({ userId: 'u1', todayKey, daily: withHistory({}) });
    expect(quests.every((q) => q.progress === 0 && q.done === false)).toBe(true);
  });

  it('works for a signed-out learner', () => {
    expect(deriveQuests({ todayKey, daily: withHistory({}) })).toHaveLength(QUEST_COUNT);
  });

  it.each([
    ['no arguments', undefined],
    ['no todayKey', { userId: 'u1' }],
  ])('returns [] for %s', (_l, args) => {
    expect(deriveQuests(args)).toEqual([]);
  });

  it('handles a day the learner has never opened', () => {
    expect(deriveQuests({ userId: 'u1', todayKey, daily: null })).toHaveLength(QUEST_COUNT);
  });
});

describe('questsCompleted', () => {
  it('counts the done ones', () => {
    expect(questsCompleted([{ done: true }, { done: false }, { done: true }])).toBe(2);
  });

  it.each([
    ['null', null],
    ['empty', []],
  ])('returns 0 for %s', (_l, qs) => {
    expect(questsCompleted(qs)).toBe(0);
  });
});

describe('the catalogue itself', () => {
  it('has unique ids', () => {
    const ids = QUEST_CATALOGUE.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('carries no learner-facing copy — words live in the pack', () => {
    // Same contract as missions.js: ids and numbers, never a sentence.
    for (const q of QUEST_CATALOGUE) {
      expect(Object.keys(q).sort()).toEqual(['group', 'id', 'progress', 'tab', 'target']);
    }
  });

  it('every entry floors its own target at MIN_TARGET, at the smallest baseline', () => {
    // This is the invariant deriveQuests relies on instead of an unreachable
    // runtime clamp. A new quest that forgets the floor fails here.
    for (const q of QUEST_CATALOGUE) {
      expect(q.target(MIN_TARGET)).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(q.target(MIN_TARGET))).toBe(true);
    }
  });

  it('has enough groups to fill a day without repeating one', () => {
    expect(new Set(QUEST_CATALOGUE.map((q) => q.group)).size).toBeGreaterThanOrEqual(QUEST_COUNT);
  });

  it('every quest is measurable against a real applyEvent day', () => {
    // The design rule: a quest whose progress cannot be read off an existing
    // counter does not belong in the catalogue.
    const daily = answers(1, 'vocab', 'correct');
    for (const q of QUEST_CATALOGUE) {
      const p = q.progress(daily['2026-08-30']);
      expect(Number.isFinite(p)).toBe(true);
      expect(p).toBeGreaterThanOrEqual(0);
    }
  });
});
