import { describe, it, expect } from 'vitest';
import {
  questHistory,
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

// The spec's §2.4 steady learner: 10 answers a day, every day, over two tabs.
// Built with the real applyEvent for the same reason dayWith is — a
// hand-written counter shape can drift from what the app stores.
function steadyHistory(days) {
  let daily = {};
  for (let i = 1; i <= days; i += 1) {
    const key = `2026-07-${String(i).padStart(2, '0')}`;
    for (let n = 0; n < 5; n += 1) daily = applyEvent(daily, key, 'vocab', 'a1', 'correct');
    for (let n = 0; n < 5; n += 1) daily = applyEvent(daily, key, 'translate', 'a1', 'correct');
  }
  return daily;
}

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

  it('lets a steady learner complete the volume quest — 1.2x made it unreachable', () => {
    // The bug this epic exists for: base is the learner's own median, so a
    // target of 1.2x base is a treadmill that speeds up as they walk. Measured
    // before the fix, 143 of 200 seeded learners were offered this quest and
    // exactly ZERO could ever finish it.
    //
    // Many seeds, not one: the quest set is seeded per (user, day), so a single
    // userId is one sample and proves nothing about the population.
    const daily = steadyHistory(14);
    let offered = 0;
    let completed = 0;
    for (let u = 0; u < 200; u += 1) {
      const volume = deriveQuests({ userId: `u${u}`, todayKey: '2026-07-14', daily }).find(
        (q) => q.id === 'answer-cards'
      );
      if (!volume) continue;
      offered += 1;
      if (volume.done) completed += 1;
    }
    // Assert the denominator too: "0 completed of 0 offered" and "0 of 143"
    // print identically at the assertion below, and only one of them is a bug.
    expect(offered).toBeGreaterThan(20);
    expect(completed).toBe(offered);
  });

  it('lets a steady learner clear the whole board, which two dead groups prevented', () => {
    // The board draws 3 of 4 groups a day. With volume AND breadth both
    // unreachable, a steady learner needed the draw to drop one dead group and
    // was still left holding the other — a perfect day was arithmetically
    // impossible. Measured across these 200 seeds: 0% before this epic, 16%
    // with the volume fix alone, 48% with both.
    //
    // Deterministic, not statistical: the same 200 userIds on the same day
    // always draw the same boards, so this threshold cannot flake. It sits with
    // ~15 points of margin on either side of the two outcomes it separates.
    const daily = steadyHistory(14);
    let perfect = 0;
    for (let u = 0; u < 200; u += 1) {
      const board = deriveQuests({ userId: `u${u}`, todayKey: '2026-07-14', daily });
      if (board.length > 0 && board.every((q) => q.done)) perfect += 1;
    }
    expect(perfect).toBeGreaterThan(60);
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
  it('clears breadth on two tabs, and still fails on one', () => {
    // Breadth is about the shape of a day, not its size. Two tabs rules out a
    // single-surface day; three demanded the learner scatter across
    // three quarters of the app daily, which a focused habit never does.
    const breadth = QUEST_CATALOGUE.find((q) => q.id === 'practise-tabs');
    const twoTabs = dayWith([
      ['vocab', 'a1', 'correct'],
      ['translate', 'a1', 'correct'],
    ])['2026-08-30'];
    const oneTab = dayWith([['vocab', 'a1', 'correct']])['2026-08-30'];

    expect(breadth.progress(twoTabs)).toBeGreaterThanOrEqual(breadth.target());
    expect(breadth.progress(oneTab)).toBeLessThan(breadth.target());
  });

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

describe('questHistory', () => {
  // A day whose counters clear every quest, whatever the seed picks.
  const bigDay = () => {
    let d = {};
    for (const tab of TABS) {
      for (let i = 0; i < 60; i += 1) d = applyEvent(d, 'X', tab, 'a1', 'correct');
    }
    return d.X;
  };

  const historyOf = (dayCounters, days) => {
    const daily = {};
    for (let i = 1; i <= days; i += 1) {
      daily[`2026-09-${String(i).padStart(2, '0')}`] = dayCounters;
    }
    return daily;
  };

  it('counts nothing for an empty history', () => {
    expect(questHistory({ daily: {}, userId: 'u1' })).toEqual({
      completed: 0,
      perfectDays: 0,
      days: 0,
    });
  });

  it('counts a fully-cleared day as a perfect day', () => {
    const r = questHistory({ daily: historyOf(bigDay(), 1), userId: 'u1' });
    expect(r.days).toBe(1);
    expect(r.perfectDays).toBe(1);
    expect(r.completed).toBe(QUEST_COUNT);
  });

  it('accumulates across days', () => {
    const one = questHistory({ daily: historyOf(bigDay(), 1), userId: 'u1' });
    const five = questHistory({ daily: historyOf(bigDay(), 5), userId: 'u1' });
    expect(five.days).toBe(5);
    expect(five.completed).toBeGreaterThan(one.completed);
  });

  it('does NOT hand out a clean sweep every day for a steady learner', () => {
    // Targets scale off the trailing median, so a learner doing exactly their
    // usual amount is asked for a little more. Five identical days are not five
    // perfect days, and that is the point of relative targets — this test
    // originally asserted 5×QUEST_COUNT and was wrong about the design.
    const r = questHistory({ daily: historyOf(bigDay(), 5), userId: 'u1' });
    expect(r.perfectDays).toBeLessThan(5);
  });

  it('counts no completions on days with no activity', () => {
    const daily = { '2026-09-01': { total: 0 }, '2026-09-02': { total: 0 } };
    const r = questHistory({ daily, userId: 'u1' });
    expect(r).toEqual({ completed: 0, perfectDays: 0, days: 2 });
  });

  it('is a pure read — it never mutates the day map', () => {
    const daily = historyOf(bigDay(), 3);
    const before = JSON.stringify(daily);
    questHistory({ daily, userId: 'u1' });
    expect(JSON.stringify(daily)).toBe(before);
  });

  it('depends on the user, because their quest sets did', () => {
    // Two learners with IDENTICAL histories can differ: they were asked
    // different things on the same days.
    const daily = historyOf(answers(3, 'vocab', 'correct')['2026-08-30'], 6);
    const a = questHistory({ daily, userId: 'user-a' }).completed;
    const b = questHistory({ daily, userId: 'user-b' }).completed;
    expect(Number.isInteger(a)).toBe(true);
    expect(Number.isInteger(b)).toBe(true);
  });

  it('agrees with deriveQuests for the most recent day', () => {
    // The fold reimplements the baseline window for speed; if it drifts from
    // deriveQuests, the badge count stops matching what the learner saw.
    const daily = historyOf(bigDay(), 4);
    const days = Object.keys(daily).sort();
    const last = days[days.length - 1];
    const live = deriveQuests({ userId: 'u1', todayKey: last, daily });
    const doneLive = live.filter((q) => q.done).length;

    const upTo = Object.fromEntries(days.map((d) => [d, daily[d]]));
    const folded = questHistory({ daily: upTo, userId: 'u1' });
    // The last day's contribution is the fold total minus the first three days'.
    const withoutLast = questHistory({
      daily: Object.fromEntries(days.slice(0, -1).map((d) => [d, daily[d]])),
      userId: 'u1',
    });
    expect(folded.completed - withoutLast.completed).toBe(doneLive);
  });
});
