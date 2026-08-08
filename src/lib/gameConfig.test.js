import { describe, it, expect } from 'vitest';
import {
  XP_PER_VERDICT,
  GOAL_PRESETS,
  DEFAULT_GOAL,
  QUALIFYING_DAY,
  STREAK_MILESTONES,
  FREEZE,
  MULTIPLIER_TIERS,
  TRIAL_ROUND_CAP,
  TRIAL_REQUIRES,
} from './gameConfig';

describe('gameConfig', () => {
  it('exposes XP per verdict', () => {
    expect(XP_PER_VERDICT).toEqual({ correct: 10, almost: 6, wrong: 3 });
  });
  it('exposes goal presets and the default', () => {
    expect(GOAL_PRESETS).toEqual({ casual: 20, regular: 50, serious: 100 });
    expect(DEFAULT_GOAL).toBe(50);
  });
  it('uses a goal-based qualifying-day rule', () => {
    expect(QUALIFYING_DAY).toBe('goal');
  });
  it('defines streak milestones', () => {
    expect(STREAK_MILESTONES).toEqual([3, 7, 14, 30, 50, 100]);
  });
  it('defines the freeze economy', () => {
    expect(FREEZE).toEqual({ earnEveryDays: 7, maxHeld: 2 });
  });
  it('defines the guest-trial bounds', () => {
    expect(TRIAL_ROUND_CAP).toBe(60);
    expect(TRIAL_REQUIRES).toEqual({ allTabs: true, firstGoal: true });
  });
  it('defines multiplier tiers', () => {
    expect(MULTIPLIER_TIERS[0]).toEqual({ minStreak: 0, mult: 1.0 });
    expect(MULTIPLIER_TIERS.at(-1)).toEqual({ minStreak: 30, mult: 2.0 });
  });
});
