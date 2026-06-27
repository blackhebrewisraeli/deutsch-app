import { xpForDay } from '../../src/lib/xpCore.js';

// ISO date strings ('YYYY-MM-DD') compare correctly lexicographically.
export function weeklyXpFromRows(rows, periodStart) {
  let xp = 0;
  for (const row of rows ?? []) {
    if (row.day >= periodStart) xp += xpForDay(row.counters);
  }
  return xp;
}
