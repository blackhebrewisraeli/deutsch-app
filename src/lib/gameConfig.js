// gameConfig — central game-balance tunables. Change a knob here and it
// propagates. Mirrors theme.js (design tokens) and packs (content): one place
// to tune the game so gameplay stays easy to evolve.
export const XP_PER_VERDICT = { correct: 10, almost: 6, wrong: 3 };
export const GOAL_PRESETS = { casual: 20, regular: 50, serious: 100 };
export const DEFAULT_GOAL = 50;

// A day counts toward the streak when its XP reaches the daily goal.
export const QUALIFYING_DAY = 'goal';

// Streak lengths that earn a celebration (replaces the old every-7-days burst).
export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100];
