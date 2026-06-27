// Dependency-free XP arithmetic. Single source for the daily-XP formula, used
// by both gamification.js (client) and the league weekly-XP helper (server).
// NOTE: explicit .js extension is REQUIRED — this file is pulled into Vercel
// serverless functions (api/v1/league/refresh, profile) that run under native
// Node ESM, which does not resolve extensionless relative imports the way Vite
// does. Dropping the extension crashes those functions with ERR_MODULE_NOT_FOUND.
import { XP_PER_VERDICT } from './gameConfig.js';

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
