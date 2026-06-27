import { describe, it, expect } from 'vitest';
import {
  XP_PER_VERDICT,
  xpForDay,
  totalXp,
  todayXp,
  thresholdForLevel,
  levelFromXp,
  rankName,
  goalProgress,
  ACHIEVEMENTS,
  earnedAchievements,
  totalExercises,
  decksMastered,
  gamificationContext,
} from './gamification';
import { activePack } from '../packs';
import { srsKey, MASTERED_BOX } from './srs';

const day = (a1c = 0, a1a = 0, a1w = 0) => ({
  total: a1c + a1a + a1w,
  byTab: {},
  byLevel: {
    a1: { correct: a1c, almost: a1a, wrong: a1w },
    a2: { correct: 0, almost: 0, wrong: 0 },
    b1: { correct: 0, almost: 0, wrong: 0 },
  },
});

describe('XP', () => {
  it('weights verdicts 10 / 6 / 3', () => {
    expect(XP_PER_VERDICT).toEqual({ correct: 10, almost: 6, wrong: 3 });
    expect(xpForDay(day(2, 1, 1))).toBe(20 + 6 + 3); // 29
  });
  it('xpForDay is 0 for undefined / empty', () => {
    expect(xpForDay(undefined)).toBe(0);
    expect(xpForDay({})).toBe(0);
  });
  it('xpForDay adds the day bonus XP', () => {
    expect(xpForDay({ byLevel: { a1: { correct: 5, almost: 0, wrong: 0 } }, bonusXp: 7 })).toBe(57);
  });
  it('totalXp sums all days; todayXp reads one', () => {
    const daily = { '2026-06-01': day(1, 0, 0), '2026-06-02': day(0, 0, 2) };
    expect(totalXp(daily)).toBe(10 + 6);
    expect(todayXp(daily, '2026-06-02')).toBe(6);
    expect(todayXp(daily, '2026-06-09')).toBe(0);
  });
});

describe('levels', () => {
  it('threshold(L) = 25(L-1)L', () => {
    expect(thresholdForLevel(1)).toBe(0);
    expect(thresholdForLevel(2)).toBe(50);
    expect(thresholdForLevel(5)).toBe(500);
    expect(thresholdForLevel(10)).toBe(2250);
  });
  it('levelFromXp finds the level + progress', () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(49).level).toBe(1);
    expect(levelFromXp(50).level).toBe(2);
    expect(levelFromXp(500).level).toBe(5);
    const l = levelFromXp(75); // level 2 (base 50), xpToNext 100, into 25
    expect(l).toMatchObject({ level: 2, xpIntoLevel: 25, xpToNext: 100 });
    expect(l.progress).toBeCloseTo(0.25);
  });
  it('rankName uses German bands', () => {
    expect(rankName(1)).toBe('Anfänger');
    expect(rankName(3)).toBe('Lernende');
    expect(rankName(6)).toBe('Fortgeschritten');
    expect(rankName(10)).toBe('Sehr gut');
    expect(rankName(15)).toBe('Fließend');
    expect(rankName(20)).toBe('Muttersprachler');
  });
});

describe('goalProgress', () => {
  it('reports under / at / over target', () => {
    expect(goalProgress(20, 50)).toMatchObject({ current: 20, target: 50, met: false });
    expect(goalProgress(20, 50).pct).toBeCloseTo(0.4);
    expect(goalProgress(50, 50).met).toBe(true);
    expect(goalProgress(80, 50).pct).toBe(1); // capped
  });
});

describe('achievements', () => {
  const ctx = (o) => ({
    streak: 0,
    totalExercises: 0,
    masteredCount: 0,
    decksMastered: 0,
    level: 1,
    ...o,
  });
  it('has 12 with unique ids', () => {
    expect(ACHIEVEMENTS).toHaveLength(12);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(12);
  });
  it('streak/volume/mastery rules fire at thresholds', () => {
    expect(earnedAchievements(ctx({ streak: 2 }))).not.toContain('streak3');
    expect(earnedAchievements(ctx({ streak: 3 }))).toContain('streak3');
    expect(earnedAchievements(ctx({ totalExercises: 100 }))).toContain('vol100');
    expect(earnedAchievements(ctx({ masteredCount: 25 }))).toContain('words25');
    expect(earnedAchievements(ctx({ decksMastered: 1 }))).toContain('deck1');
    expect(earnedAchievements(ctx({ decksMastered: 4 }))).toEqual(
      expect.arrayContaining(['deck1', 'allDecks'])
    );
  });
  it('leagueChampion fires at leagueWins >= 1', () => {
    expect(earnedAchievements(ctx({ leagueWins: 0 }))).not.toContain('leagueChampion');
    expect(earnedAchievements(ctx({ leagueWins: 1 }))).toContain('leagueChampion');
    expect(earnedAchievements(ctx({ leagueWins: 3 }))).toContain('leagueChampion');
  });
});

describe('context derivation', () => {
  it('totalExercises sums day.total', () => {
    expect(totalExercises({ a: { total: 3 }, b: { total: 4 } })).toBe(7);
  });
  it('decksMastered counts fully Box-5 preset decks', () => {
    expect(decksMastered({})).toBe(0);
  });
  it('decksMastered counts a preset deck fully mastered by id', () => {
    const srs = {};
    for (const card of activePack.content.decks.greetings) {
      srs[srsKey('greetings', card.id)] = {
        box: MASTERED_BOX,
        nextDue: 0,
        lastReviewed: 0,
        reps: 9,
      };
    }
    expect(decksMastered(srs)).toBe(1);
  });
  it('gamificationContext assembles from state', () => {
    const state = { stats: { streak: 5 }, daily: { d: { total: 2, byLevel: {} } }, srs: {} };
    const c = gamificationContext(state);
    expect(c.streak).toBe(5);
    expect(c.totalExercises).toBe(2);
    expect(c.decksMastered).toBe(0);
    expect(typeof c.level).toBe('number');
  });
});
