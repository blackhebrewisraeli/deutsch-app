// Streak derivation — pure, I/O-free. The streak is DERIVED from the daily log
// (consistent with how XP/levels work), never stored as a running counter.
import { xpForDay } from './gamification';
import { STREAK_MILESTONES } from './gameConfig';

// A calendar day qualifies toward the streak once its XP reaches the goal.
export function qualifies(day, goal) {
  return xpForDay(day) >= goal;
}

// Previous local-date key ('YYYY-MM-DD' → the day before). UTC math avoids DST drift.
function prevKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

// Consecutive qualifying days ending at today. Today is "in progress": if it
// hasn't qualified yet, the run is counted through yesterday (still alive today).
export function currentStreak(daily, goal, today) {
  let count = 0;
  let key = qualifies(daily[today], goal) ? today : prevKey(today);
  while (qualifies(daily[key], goal)) {
    count += 1;
    key = prevKey(key);
  }
  return count;
}

// Longest consecutive qualifying run anywhere in the log (the record).
export function bestStreakFromHistory(daily, goal) {
  const days = Object.keys(daily)
    .filter((k) => qualifies(daily[k], goal))
    .sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const key of days) {
    run = prev && prevKey(key) === prev ? run + 1 : 1;
    best = Math.max(best, run);
    prev = key;
  }
  return best;
}

// The highest milestone in (prev, next], or null. Fires a celebration the moment
// a streak reaches 3 / 7 / 14 / ….
export function crossedMilestone(prev, next) {
  const hit = STREAK_MILESTONES.filter((m) => m > prev && m <= next);
  return hit.length ? Math.max(...hit) : null;
}
