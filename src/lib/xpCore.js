// Dependency-free XP arithmetic. Single source for the daily-XP formula, used
// by both gamification.js (client) and the league weekly-XP helper (server).
import { XP_PER_VERDICT } from './gameConfig';

export function xpForDay(day) {
  if (!day || !day.byLevel) return 0;
  let xp = 0;
  for (const lv of Object.values(day.byLevel)) {
    xp +=
      (lv.correct ?? 0) * XP_PER_VERDICT.correct +
      (lv.almost ?? 0) * XP_PER_VERDICT.almost +
      (lv.wrong ?? 0) * XP_PER_VERDICT.wrong;
  }
  return xp + (day.bonusXp ?? 0);
}
