// Streak derivation — pure, I/O-free. The streak is DERIVED from the daily log
// (consistent with how XP/levels work), never stored as a running counter.
import { xpForDay } from './gamification';
import { STREAK_MILESTONES, FREEZE, DEFAULT_GOAL, MULTIPLIER_TIERS } from './gameConfig';

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

// Next local-date key ('YYYY-MM-DD' → the day after).
function nextKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

// A day "counts" toward the streak if it qualifies on its own or a freeze
// rescued it (it's in frozenDays).
function countsDay(daily, frozenDays, goal, key) {
  return qualifies(daily[key], goal) || !!frozenDays[key];
}

// Consecutive qualifying days ending at today. Today is "in progress": if it
// hasn't qualified yet, the run is counted through yesterday (still alive today).
export function currentStreak(daily, goal, today, frozenDays = {}) {
  let count = 0;
  let key = countsDay(daily, frozenDays, goal, today) ? today : prevKey(today);
  while (countsDay(daily, frozenDays, goal, key)) {
    count += 1;
    key = prevKey(key);
  }
  return count;
}

// Longest consecutive qualifying run anywhere in the log (the record).
export function bestStreakFromHistory(daily, goal, frozenDays = {}) {
  const days = [...new Set([...Object.keys(daily), ...Object.keys(frozenDays)])]
    .filter((k) => countsDay(daily, frozenDays, goal, k))
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

// Forward calendar walk from the first activity day to `upTo` (exclusive),
// auto-earning a freeze every FREEZE.earnEveryDays qualifying days (cap maxHeld)
// and spending one to bridge a miss; a miss with no freeze breaks the run.
// Pure + deterministic from daily+goal — so the resulting frozenDays is sync-safe.
export function simulateFreezes(daily, goal, upTo) {
  const keys = Object.keys(daily).sort();
  if (keys.length === 0) return { frozenDays: {}, freezes: 0 };
  let run = 0;
  let freezes = 0;
  const frozenDays = {};
  for (let d = keys[0]; d < upTo; d = nextKey(d)) {
    if (qualifies(daily[d], goal)) {
      run += 1;
      if (run % FREEZE.earnEveryDays === 0) freezes = Math.min(freezes + 1, FREEZE.maxHeld);
    } else if (freezes > 0) {
      freezes -= 1;
      frozenDays[d] = true; // bridge — the run survives
    } else {
      run = 0;
      freezes = 0; // run broke; freezes reset with it
    }
  }
  return { frozenDays, freezes };
}

// Day-rollover reconcile: recompute rescued days + the record from history.
// Idempotent — frozenDays is a pure function of daily+goal.
export function reconcile(state, today) {
  const daily = state.daily ?? {};
  const g = state.gamification ?? {};
  const goal = g.goal ?? DEFAULT_GOAL;
  const sim = simulateFreezes(daily, goal, today);
  const frozenDays = { ...(g.frozenDays ?? {}), ...sim.frozenDays };
  const best = Math.max(g.bestStreak ?? 0, bestStreakFromHistory(daily, goal, frozenDays));
  return { frozenDays, bestStreak: best, lastReconcileDay: today };
}

// Freezes the user holds entering `today` (for the ❄️×N indicator).
export function freezesAvailable(state, today) {
  const daily = state.daily ?? {};
  const goal = state.gamification?.goal ?? DEFAULT_GOAL;
  return simulateFreezes(daily, goal, today).freezes;
}

// XP multiplier for a streak length — the highest tier it reaches.
export function multiplier(streakLen) {
  let m = 1;
  for (const tier of MULTIPLIER_TIERS) if (streakLen >= tier.minStreak) m = tier.mult;
  return m;
}
