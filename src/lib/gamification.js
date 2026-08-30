// Gamification — XP, levels, daily goal, achievements. PURE (no storage/DOM).
// XP is DERIVED from the existing state.daily log — nothing is stored as a
// running counter, so all past practice counts and there is no migration.

import { getMasteredCount, srsKey, MASTERED_BOX } from './srs';
import { activePack } from '../packs';
import { XP_PER_VERDICT, GOAL_PRESETS, DEFAULT_GOAL } from './gameConfig';
import { xpForDay } from './xpCore';
const { decks: PRESET_DECKS } = activePack.content;

// Balance constants now live in gameConfig; re-exported for back-compat so
// existing importers (App, GoalPicker, tests) keep working unchanged.
export { XP_PER_VERDICT, GOAL_PRESETS, DEFAULT_GOAL };

// ─── XP ───────────────────────────────────────────────────────
export { xpForDay };

export function totalXp(daily) {
  return Object.values(daily ?? {}).reduce((sum, d) => sum + xpForDay(d), 0);
}

export function todayXp(daily, today) {
  return xpForDay((daily ?? {})[today]);
}

// ─── Levels ───────────────────────────────────────────────────
// Cumulative XP to REACH level L: threshold(L) = 25·(L-1)·L  (L→L+1 costs 50·L).
const RANKS = [
  { min: 1, name: 'Anfänger' },
  { min: 3, name: 'Lernende' },
  { min: 6, name: 'Fortgeschritten' },
  { min: 10, name: 'Sehr gut' },
  { min: 15, name: 'Fließend' },
  { min: 20, name: 'Muttersprachler' },
];

export function thresholdForLevel(level) {
  return 25 * (level - 1) * level;
}

export function rankName(level) {
  let name = RANKS[0].name;
  for (const r of RANKS) if (level >= r.min) name = r.name;
  return name;
}

export function levelFromXp(xp) {
  const x = Math.max(0, xp);
  const level = Math.max(1, Math.floor((25 + Math.sqrt(625 + 100 * x)) / 50));
  const base = thresholdForLevel(level);
  const xpToNext = 50 * level; // threshold(level+1) - threshold(level)
  const xpIntoLevel = x - base;
  return {
    level,
    rankName: rankName(level),
    xpIntoLevel,
    xpToNext,
    progress: xpToNext === 0 ? 0 : xpIntoLevel / xpToNext,
  };
}

// ─── Daily goal ──────────────────────────────────────────────
export function goalProgress(today, goal) {
  const target = goal || DEFAULT_GOAL;
  return {
    current: today,
    target,
    pct: target === 0 ? 0 : Math.min(1, today / target),
    met: today >= target,
  };
}

// ─── Achievements ────────────────────────────────────────────
// ctx = { streak, totalExercises, masteredCount, decksMastered, level }
export const ACHIEVEMENTS = [
  {
    id: 'streak3',
    category: 'streak',
    name: 'Drei am Stück',
    icon: '🔥',
    test: (c) => c.streak >= 3,
  },
  { id: 'streak7', category: 'streak', name: 'Wochenheld', icon: '🔥', test: (c) => c.streak >= 7 },
  {
    id: 'streak14',
    category: 'streak',
    name: 'Zwei Wochen',
    icon: '🔥',
    test: (c) => c.streak >= 14,
  },
  {
    id: 'streak30',
    category: 'streak',
    name: 'Monatsmeister',
    icon: '👑',
    test: (c) => c.streak >= 30,
  },
  {
    id: 'vol100',
    category: 'volume',
    name: 'Erste Hundert',
    icon: '💯',
    test: (c) => c.totalExercises >= 100,
  },
  {
    id: 'vol500',
    category: 'volume',
    name: 'Fünfhundert',
    icon: '🏛️',
    test: (c) => c.totalExercises >= 500,
  },
  {
    id: 'vol1000',
    category: 'volume',
    name: 'Tausend',
    icon: '🚀',
    test: (c) => c.totalExercises >= 1000,
  },
  {
    id: 'words25',
    category: 'volume',
    name: 'Wortschatz 25',
    icon: '📖',
    test: (c) => c.masteredCount >= 25,
  },
  {
    id: 'words50',
    category: 'volume',
    name: 'Wortschatz 50',
    icon: '📚',
    test: (c) => c.masteredCount >= 50,
  },
  {
    id: 'deck1',
    category: 'mastery',
    name: 'Deck-Meister',
    icon: '✅',
    test: (c) => c.decksMastered >= 1,
  },
  {
    id: 'allDecks',
    category: 'mastery',
    name: 'Alle Decks',
    icon: '🏆',
    test: (c) => c.decksMastered >= 4,
  },
  {
    id: 'quests10',
    category: 'quests',
    name: 'Aufgabenjäger',
    icon: '🗂️',
    test: (c) => c.questsCompleted >= 10,
  },
  {
    id: 'quests50',
    category: 'quests',
    name: 'Aufgabenmeister',
    icon: '🏅',
    test: (c) => c.questsCompleted >= 50,
  },
  {
    id: 'questPerfectDay',
    category: 'quests',
    name: 'Tagwerk',
    icon: '🌟',
    test: (c) => c.questPerfectDays >= 1,
  },
  {
    id: 'leagueChampion',
    category: 'mastery',
    name: 'Liga-Meister',
    icon: '🥇',
    test: (c) => c.leagueWins >= 1,
  },
];

export function earnedAchievements(ctx) {
  return ACHIEVEMENTS.filter((a) => a.test(ctx)).map((a) => a.id);
}

// ─── Context derivation (from full state) ────────────────────
export function totalExercises(daily) {
  return Object.values(daily ?? {}).reduce((sum, d) => sum + (d.total ?? 0), 0);
}

export function decksMastered(srs) {
  let n = 0;
  for (const [deckId, deck] of Object.entries(PRESET_DECKS)) {
    if (deck.every((card) => srs?.[srsKey(deckId, card.id)]?.box === MASTERED_BOX)) n += 1;
  }
  return n;
}

/**
 * @param {object} state
 * @param {{completed?: number, perfectDays?: number}} [questCtx] quest history,
 *   INJECTED rather than imported. lib/quests.js reads TABS from lib/stats.js,
 *   and importing it here closed a cycle that left TABS undefined at module
 *   load — 15 test files failed to collect. Injection also matches how
 *   deriveMissions and deckProgressFor take their inputs.
 */
export function gamificationContext(state, questCtx = {}) {
  const daily = state.daily ?? {};
  const srs = state.srs ?? {};
  const { completed = 0, perfectDays = 0 } = questCtx ?? {};
  return {
    streak: state.stats?.streak ?? 0,
    totalExercises: totalExercises(daily),
    masteredCount: getMasteredCount(srs),
    decksMastered: decksMastered(srs),
    level: levelFromXp(totalXp(daily)).level,
    leagueWins: state.stats?.leagueWins ?? 0,
    questsCompleted: completed,
    questPerfectDays: perfectDays,
  };
}
