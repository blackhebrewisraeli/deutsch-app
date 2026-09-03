import { readFileSync } from 'node:fs';
import { URL as NodeURL } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  qualifies,
  currentStreak,
  bestStreakFromHistory,
  crossedMilestone,
  simulateFreezes,
  reconcile,
  freezesAvailable,
  multiplier,
} from './streak';
import { applyEvent } from './stats';
import { FREEZE } from './gameConfig';

// The jsdom test environment shadows the global `URL` with its own
// implementation, and Node's fs rejects that instance with "The URL must be
// of scheme file" even though the href is a valid file:// URL — so this uses
// Node's own URL constructor explicitly rather than the (jsdom) global one.
const streakSource = readFileSync(new NodeURL('./streak.js', import.meta.url), 'utf8');

// 5 correct = 50 XP; 4 correct = 40 XP
const day = (correct) => ({ byLevel: { a1: { correct, almost: 0, wrong: 0 } } });
const qual = { byLevel: { a1: { correct: 5, almost: 0, wrong: 0 } } }; // 50 XP
const miss = { byLevel: { a1: { correct: 0, almost: 0, wrong: 0 } } }; // 0 XP
const days = (...keys) => Object.fromEntries(keys.map((k) => [k, qual]));
const week = () =>
  days(
    '2026-06-01',
    '2026-06-02',
    '2026-06-03',
    '2026-06-04',
    '2026-06-05',
    '2026-06-06',
    '2026-06-07'
  );

// Days rich enough to COMPLETE quests. The hand-written `qual` fixture above
// carries only `byLevel`, so volume/breadth/focus quests all score 0 against it
// and 14 days of it yields 6 completions — under the threshold, which makes a
// missing feature look like a working negative. These are built with the real
// applyEvent: 10 answers a day over two tabs.
function questfulDays(startDay, days) {
  let daily = {};
  for (let i = 0; i < days; i += 1) {
    const k = `2026-06-${String(startDay + i).padStart(2, '0')}`;
    for (let n = 0; n < 5; n += 1) daily = applyEvent(daily, k, 'vocab', 'a1', 'correct');
    for (let n = 0; n < 5; n += 1) daily = applyEvent(daily, k, 'translate', 'a1', 'correct');
  }
  return daily;
}

describe('qualifies', () => {
  it('is true when the day reaches the goal XP', () => {
    expect(qualifies(day(5), 50)).toBe(true);
  });
  it('is false below the goal', () => {
    expect(qualifies(day(4), 50)).toBe(false);
  });
  it('is false for a missing day', () => {
    expect(qualifies(undefined, 50)).toBe(false);
  });
});

describe('currentStreak', () => {
  it('counts consecutive qualifying days ending today', () => {
    const d = { '2026-06-08': qual, '2026-06-09': qual, '2026-06-10': qual };
    expect(currentStreak(d, 50, '2026-06-10')).toBe(3);
  });
  it("keeps the prior run alive while today hasn't qualified yet", () => {
    const d = { '2026-06-08': qual, '2026-06-09': qual, '2026-06-10': miss };
    expect(currentStreak(d, 50, '2026-06-10')).toBe(2);
  });
  it('breaks at a gap', () => {
    const d = { '2026-06-07': qual, '2026-06-09': qual, '2026-06-10': qual }; // 06-08 missing
    expect(currentStreak(d, 50, '2026-06-10')).toBe(2);
  });
  it('is 0 when neither today nor yesterday qualifies', () => {
    expect(currentStreak({ '2026-06-08': qual }, 50, '2026-06-10')).toBe(0);
  });
});

describe('bestStreakFromHistory', () => {
  it('finds the longest qualifying run', () => {
    const d = {
      '2026-06-01': qual,
      '2026-06-02': qual,
      '2026-06-03': qual, // run of 3
      '2026-06-05': qual,
      '2026-06-06': qual, // run of 2
    };
    expect(bestStreakFromHistory(d, 50)).toBe(3);
  });
  it('is 0 with no qualifying days', () => {
    expect(bestStreakFromHistory({ '2026-06-01': miss }, 50)).toBe(0);
  });
});

describe('crossedMilestone', () => {
  it('returns the milestone just reached', () => {
    expect(crossedMilestone(2, 3)).toBe(3);
    expect(crossedMilestone(6, 7)).toBe(7);
  });
  it('returns null when no milestone is crossed', () => {
    expect(crossedMilestone(3, 4)).toBeNull();
    expect(crossedMilestone(7, 7)).toBeNull();
  });
  it('returns the highest milestone when several are crossed at once', () => {
    expect(crossedMilestone(1, 8)).toBe(7);
  });
});

describe('freeze bridging', () => {
  it('currentStreak bridges a missed day that was frozen', () => {
    const d = { '2026-06-08': qual, '2026-06-09': miss, '2026-06-10': qual };
    expect(currentStreak(d, 50, '2026-06-10')).toBe(1);
    expect(currentStreak(d, 50, '2026-06-10', { '2026-06-09': true })).toBe(3);
  });
  it('bestStreakFromHistory bridges frozen days', () => {
    const d = { '2026-06-01': qual, '2026-06-02': miss, '2026-06-03': qual };
    expect(bestStreakFromHistory(d, 50, { '2026-06-02': true })).toBe(3);
  });
});

describe('simulateFreezes', () => {
  it('earns one freeze after a 7-day run', () => {
    const r = simulateFreezes(week(), 50, '2026-06-08');
    expect(r.freezes).toBe(1);
    expect(r.frozenDays).toEqual({});
  });
  it('spends a freeze to bridge a single missed day', () => {
    const r = simulateFreezes(week(), 50, '2026-06-09'); // 06-08 is a miss
    expect(r.frozenDays).toEqual({ '2026-06-08': true });
    expect(r.freezes).toBe(0);
  });
  it('breaks the run when a miss has no freeze to spend', () => {
    const r = simulateFreezes(days('2026-06-01', '2026-06-02'), 50, '2026-06-05');
    expect(r.frozenDays).toEqual({});
    expect(r.freezes).toBe(0);
  });
});

describe('reconcile + freezesAvailable', () => {
  it('reconcile produces frozenDays + bestStreak + lastReconcileDay', () => {
    const state = {
      daily: week(),
      gamification: { goal: 50, frozenDays: {}, bestStreak: 0, lastReconcileDay: '2026-06-07' },
    };
    const r = reconcile(state, '2026-06-09');
    expect(r.frozenDays).toEqual({ '2026-06-08': true });
    expect(r.lastReconcileDay).toBe('2026-06-09');
    expect(r.bestStreak).toBeGreaterThanOrEqual(7);
  });
  it('freezesAvailable reflects the earned balance', () => {
    const state = { daily: week(), gamification: { goal: 50 } };
    expect(freezesAvailable(state, '2026-06-08')).toBe(1);
  });

  it('keeps a day rescued even when nothing would grant that freeze today', () => {
    // §4.3, the ratchet. The GRANT is derived and may move when the catalogue
    // changes; the SPEND is stored and unions, so it only ever grows. A day the
    // learner already saw rescued must stay rescued forever — otherwise a
    // catalogue edit retroactively shortens a streak, silently, with no user
    // action and nothing in any multi-device test to catch it.
    //
    // '2026-05-01' is not in `daily` at all, so NO simulation over this state
    // could ever produce it. It can only survive by being unioned in.
    const state = {
      daily: questfulDays(1, 3),
      gamification: { goal: 50, frozenDays: { '2026-05-01': true }, bestStreak: 0 },
    };
    const r = reconcile(state, '2026-06-05', { userId: 'u1' });
    expect(r.frozenDays['2026-05-01']).toBe(true);
  });
});

describe('multiplier', () => {
  it('steps up by streak tier', () => {
    expect(multiplier(0)).toBe(1.0);
    expect(multiplier(2)).toBe(1.0);
    expect(multiplier(3)).toBe(1.2);
    expect(multiplier(7)).toBe(1.5);
    expect(multiplier(14)).toBe(1.75);
    expect(multiplier(30)).toBe(2.0);
    expect(multiplier(100)).toBe(2.0);
  });
});

describe('freezes earned from quest completions', () => {
  // goal 500 is deliberately unreachable: 10 correct answers is 100 XP, so NO
  // day qualifies and the 7-consecutive-day faucet grants nothing. Any freeze
  // here can only have come from quests, which is what isolates the new path.
  const QUEST_ONLY_GOAL = 500;

  it('earns freezes from quests alone, on days that never meet the XP goal', () => {
    const daily = questfulDays(1, 14);
    const r = simulateFreezes(daily, QUEST_ONLY_GOAL, '2026-06-15', { userId: 'u1' });
    // 33 completions over 14 days / earnPerQuests 14 = 2 grants, and each is
    // spent bridging the miss on the day it lands (see R2 in the plan).
    expect(Object.keys(r.frozenDays).length).toBe(2);
    // R2: the grant is applied BEFORE the qualify/spend branch, so the freeze is
    // spent on the very day its threshold is crossed. Asserting the exact days,
    // not just how many: reversing that ordering still bridges two days, just
    // later ones, so a count cannot see the difference and a previous version of
    // this test could not tell the two orderings apart.
    expect(r.frozenDays).toEqual({ '2026-06-06': true, '2026-06-12': true });
  });

  it('grants nothing extra to a signed-out learner', () => {
    // R1: no userId means no quest grading at all, so the guest balance is
    // exactly what it is today. This is the guard on "strictly additive".
    const daily = questfulDays(1, 14);
    const guest = simulateFreezes(daily, QUEST_ONLY_GOAL, '2026-06-15');
    expect(guest).toEqual({ frozenDays: {}, freezes: 0 });
  });

  it('is deterministic — the property that replaces a stored inventory', () => {
    const daily = questfulDays(1, 14);
    const a = simulateFreezes(daily, QUEST_ONLY_GOAL, '2026-06-15', { userId: 'u1' });
    const b = simulateFreezes(daily, QUEST_ONLY_GOAL, '2026-06-15', { userId: 'u1' });
    expect(a).toEqual(b);
  });

  it('depends on the user, because their quest sets did', () => {
    const daily = questfulDays(1, 14);
    const u1 = simulateFreezes(daily, QUEST_ONLY_GOAL, '2026-06-15', { userId: 'u1' });
    const u2 = simulateFreezes(daily, QUEST_ONLY_GOAL, '2026-06-15', { userId: 'u2' });
    expect(u1.frozenDays).not.toEqual(u2.frozenDays);
  });

  it('never exceeds maxHeld, however many quests are cleared', () => {
    // 28 full days accrue EIGHT grants between the two faucets (four from the
    // 7-day run, four from quest completions) and only maxHeld are ever held.
    // Asserted as an equality, not `<=`: measured, an uncapped walk reaches 8,
    // so `<=` would also pass on a broken cap that simply never granted.
    //
    // upTo is the day AFTER the last recorded day on purpose. Walking further
    // makes every unrecorded day a miss, which spends the held freezes bridging
    // them and lands the balance back at 0 — where `<=` passes for the wrong
    // reason entirely. This test was written that way first and caught here.
    const daily = questfulDays(1, 28);
    const r = simulateFreezes(daily, 50, '2026-06-29', { userId: 'u1' });
    expect(r.freezes).toBe(FREEZE.maxHeld);
  });

  it('bridges a real miss, and the streak survives it', () => {
    // The end-to-end claim, not the counter: 14 qualifying+questful days, then a
    // genuine miss, then a qualifying day. The miss must be rescued and the run
    // must span it.
    const daily = { ...questfulDays(1, 14), '2026-06-15': miss, ...questfulDays(16, 1) };
    const r = simulateFreezes(daily, 50, '2026-06-17', { userId: 'u1' });
    expect(r.frozenDays['2026-06-15']).toBe(true);
    expect(currentStreak(daily, 50, '2026-06-16', r.frozenDays)).toBe(16);
  });

  it('grades quests inline rather than calling deriveQuests per day', () => {
    // D1. deriveQuests re-derives the baseline by re-scanning the whole day map,
    // so one call per day makes this walk O(n²) inside a function App evaluates
    // during render. The walk must use pickQuests + a rolling window instead.
    // A static check, because the cost only shows up on a large day map and a
    // timing assertion would flake on a loaded machine.
    expect(
      streakSource,
      'streak.js must not reference deriveQuests anywhere — even in a comment. ' +
        'This is a plain source scan, deliberately: a timing assertion would flake. ' +
        'Grade quests inline with pickQuests + a rolling window instead.'
    ).not.toMatch(/deriveQuests/);
  });
});
