import { describe, it, expect } from 'vitest';
import { deriveMissions, MISSION_PRIORITY, MISSION_CAP, EVENING_HOUR } from './missions';

// 09:00 — before the streak-risk hour, so nothing fires on the clock alone.
const MORNING = new Date('2026-08-29T09:00:00');
const EVENING = new Date(`2026-08-29T${String(EVENING_HOUR).padStart(2, '0')}:30:00`);

const metGoal = { current: 50, target: 50, met: true };
const openGoal = { current: 20, target: 50, met: false };

/** Nothing to do: every source empty and the goal already met. */
const quiet = {
  srsDue: 0,
  goal: metGoal,
  streak: 0,
  reviewItems: [],
  decks: [],
  league: null,
  achievements: [],
  achievementCtx: null,
  earned: [],
  now: MORNING,
  lastTab: 'chat',
};

const ids = (missions) => missions.map((m) => m.id);

describe('deriveMissions', () => {
  it('returns nothing when there is nothing to do', () => {
    expect(deriveMissions(quiet)).toEqual([]);
  });

  it('is pure — the same input twice gives the same answer', () => {
    const input = { ...quiet, srsDue: 4, goal: openGoal };
    expect(deriveMissions(input)).toEqual(deriveMissions(input));
  });

  describe('each mission fires only on its own condition', () => {
    it('srs-due counts the cards waiting, and routes to Vocab', () => {
      const [m] = deriveMissions({ ...quiet, srsDue: 12 });
      expect(m).toMatchObject({ id: 'srs-due', count: 12, tab: 'vocab' });
    });

    it('srs-due stays away at zero due cards', () => {
      expect(ids(deriveMissions({ ...quiet, srsDue: 0 }))).not.toContain('srs-due');
    });

    it('goal-remaining counts the XP still needed', () => {
      const [m] = deriveMissions({ ...quiet, goal: openGoal });
      expect(m).toMatchObject({ id: 'goal-remaining', count: 30 });
    });

    it('goal-remaining stays away once the goal is met', () => {
      expect(ids(deriveMissions({ ...quiet, goal: metGoal }))).not.toContain('goal-remaining');
    });

    it('goal-remaining routes to the last practised tab, not a fixed one', () => {
      const [m] = deriveMissions({ ...quiet, goal: openGoal, lastTab: 'translate' });
      expect(m.tab).toBe('translate');
    });

    it('streak-risk fires in the evening with a live streak and an unmet goal', () => {
      const out = deriveMissions({ ...quiet, streak: 6, goal: openGoal, now: EVENING });
      expect(ids(out)).toContain('streak-risk');
      expect(out.find((m) => m.id === 'streak-risk').count).toBe(6);
    });

    it.each([
      ['it is still morning', { streak: 6, goal: openGoal, now: MORNING }],
      ['there is no streak to lose', { streak: 0, goal: openGoal, now: EVENING }],
      ['the goal is already met', { streak: 6, goal: metGoal, now: EVENING }],
    ])('streak-risk stays away when %s', (_label, patch) => {
      expect(ids(deriveMissions({ ...quiet, ...patch }))).not.toContain('streak-risk');
    });

    it('revisit-wrong counts the items and routes to the first one’s own tab', () => {
      const reviewItems = [
        { tab: 'translate', label: 'der Hund' },
        { tab: 'vocab', label: 'die Katze' },
      ];
      const [m] = deriveMissions({ ...quiet, reviewItems });
      expect(m).toMatchObject({ id: 'revisit-wrong', count: 2, tab: 'translate' });
    });

    it('deck-unfinished fires for a started deck and ignores untouched or finished ones', () => {
      const decks = [
        { deckId: 'untouched', done: 0, total: 10 },
        { deckId: 'finished', done: 10, total: 10 },
        { deckId: 'started', done: 3, total: 10 },
      ];
      const [m] = deriveMissions({ ...quiet, decks });
      expect(m).toMatchObject({ id: 'deck-unfinished', tab: 'vocab', count: 7 });
      expect(m.deckId).toBe('started');
    });

    it('league-position fires only inside the demotion zone', () => {
      const inZone = { rank: 24, inDemotionZone: true };
      const safe = { rank: 3, inDemotionZone: false };
      expect(ids(deriveMissions({ ...quiet, league: inZone }))).toContain('league-position');
      expect(ids(deriveMissions({ ...quiet, league: safe }))).not.toContain('league-position');
      expect(ids(deriveMissions({ ...quiet, league: null }))).not.toContain('league-position');
    });

    // "Within one step" is not readable from a boolean predicate, so it is
    // probed: nudge each numeric context field by one and see if the predicate
    // flips. That keeps the rule generic instead of hardcoding thresholds.
    it('badge-near fires for an achievement exactly one step away', () => {
      const achievements = [{ id: 'streak7', name: 'Wochenheld', test: (c) => c.streak >= 7 }];
      const out = deriveMissions({
        ...quiet,
        achievements,
        achievementCtx: { streak: 6, totalExercises: 0 },
      });
      expect(out.find((m) => m.id === 'badge-near')).toMatchObject({ badgeId: 'streak7' });
    });

    it('badge-near ignores one already earned and one still far off', () => {
      const achievements = [
        { id: 'streak3', name: 'Drei', test: (c) => c.streak >= 3 },
        { id: 'streak30', name: 'Monat', test: (c) => c.streak >= 30 },
      ];
      const out = deriveMissions({
        ...quiet,
        achievements,
        achievementCtx: { streak: 4 },
        earned: ['streak3'],
      });
      expect(ids(out)).not.toContain('badge-near');
    });
  });

  describe('ordering and cap', () => {
    // Everything at once, so the order is the only thing under test.
    const everything = {
      ...quiet,
      srsDue: 3,
      goal: openGoal,
      streak: 5,
      now: EVENING,
      reviewItems: [{ tab: 'vocab', label: 'x' }],
      decks: [{ deckId: 'd', done: 1, total: 4 }],
      league: { rank: 24, inDemotionZone: true },
      achievements: [{ id: 'streak7', name: 'W', test: (c) => c.streak >= 7 }],
      achievementCtx: { streak: 6 },
    };

    it('orders by the declared priority', () => {
      // Derive against a raised cap so ordering is visible past five.
      const out = deriveMissions({ ...everything, cap: MISSION_PRIORITY.length });
      expect(ids(out)).toEqual(MISSION_PRIORITY);
    });

    it('caps the board at five so it stays a glance', () => {
      const out = deriveMissions(everything);
      expect(out).toHaveLength(MISSION_CAP);
      // The five kept are the five highest-priority ones.
      expect(ids(out)).toEqual(MISSION_PRIORITY.slice(0, MISSION_CAP));
    });

    it('gives every mission a priority matching its place in the order', () => {
      const out = deriveMissions({ ...everything, cap: MISSION_PRIORITY.length });
      out.forEach((m) => expect(m.priority).toBe(MISSION_PRIORITY.indexOf(m.id)));
    });
  });

  describe('it returns data, never copy', () => {
    // The engine is language-blind: German lives in the pack. A mission
    // carrying a human-readable string would put copy in src/lib and break
    // that rule silently.
    it('carries no prose on any mission', () => {
      const out = deriveMissions({
        ...quiet,
        srsDue: 3,
        goal: openGoal,
        reviewItems: [{ tab: 'vocab', label: 'die Katze' }],
      });
      expect(out.length).toBeGreaterThan(0);
      for (const mission of out) {
        for (const [key, value] of Object.entries(mission)) {
          if (typeof value !== 'string') continue;
          // ids, tab names and deck/badge ids are identifiers, not sentences.
          expect(value, `${key} looks like prose`).toMatch(/^[a-z0-9:_-]+$/i);
        }
      }
    });
  });

  describe('missing or malformed input', () => {
    it('survives an entirely empty call', () => {
      expect(() => deriveMissions()).not.toThrow();
      expect(deriveMissions()).toEqual([]);
    });

    it('survives null collections rather than throwing on Home, the landing tab', () => {
      expect(() =>
        deriveMissions({ ...quiet, reviewItems: null, decks: null, achievements: null })
      ).not.toThrow();
    });
  });
});
