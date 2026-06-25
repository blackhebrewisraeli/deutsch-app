import { describe, it, expect } from 'vitest';
import {
  XP_PER_VERDICT,
  GOAL_PRESETS,
  DEFAULT_GOAL,
  QUALIFYING_DAY,
  STREAK_MILESTONES,
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
});
