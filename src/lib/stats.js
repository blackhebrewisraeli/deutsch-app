// Stats engine — pure helpers + an imperative recorder.
//
// Storage shape (extends `deutsch-app-state-v1`):
//   {
//     stats:        { streak, learnedCount, lastVisit },   // unchanged
//     learnedWords: { word: bool },                         // unchanged
//     daily: {                                              // NEW (Stats tab)
//       'YYYY-MM-DD': {
//         total:   number,
//         byTab:   { chat, alphabet, vocab, translate },
//         byLevel: { a1, a2, b1: { correct, almost, wrong } }
//       }
//     }
//   }
//
// Pure helpers (testable in isolation): everything except `recordEvent`.

import { loadState, saveState } from './storage';

export const TABS = ['chat', 'alphabet', 'vocab', 'translate'];
export const LEVELS = ['a1', 'a2', 'b1'];
export const VERDICTS = ['correct', 'almost', 'wrong'];

// ─── Date helpers ─────────────────────────────────────────────

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

// ─── Aggregate construction ───────────────────────────────────

export function emptyDayAggregate() {
  const byTab = {};
  for (const tab of TABS) byTab[tab] = 0;

  const byLevel = {};
  for (const level of LEVELS) {
    byLevel[level] = {};
    for (const verdict of VERDICTS) byLevel[level][verdict] = 0;
  }

  return { total: 0, byTab, byLevel };
}

// ─── Event application ───────────────────────────────────────

export function applyEvent(daily, dateKey, tab, level, verdict) {
  if (!TABS.includes(tab)) throw new Error(`Invalid tab: ${tab}`);
  if (!LEVELS.includes(level)) throw new Error(`Invalid level: ${level}`);
  if (!VERDICTS.includes(verdict)) throw new Error(`Invalid verdict: ${verdict}`);

  const prev = daily[dateKey] ?? emptyDayAggregate();
  const next = {
    total: prev.total + 1,
    byTab: { ...prev.byTab, [tab]: prev.byTab[tab] + 1 },
    byLevel: {
      ...prev.byLevel,
      [level]: {
        ...prev.byLevel[level],
        [verdict]: prev.byLevel[level][verdict] + 1,
      },
    },
  };

  return { ...daily, [dateKey]: next };
}

// ─── Heatmap ──────────────────────────────────────────────────

function intensityFor(total) {
  if (total === 0) return 0;
  if (total <= 3) return 1;
  if (total <= 9) return 2;
  if (total <= 19) return 3;
  return 4;
}

export function getHeatmapData(daily, endDate, days) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(endDate, -i);
    const key = todayKey(d);
    const total = daily[key]?.total ?? 0;
    out.push({ date: key, total, intensity: intensityFor(total) });
  }
  return out;
}

// ─── Range queries ────────────────────────────────────────────

function inRange(key, fromKey, toKey) {
  if (fromKey && key < fromKey) return false;
  if (toKey && key > toKey) return false;
  return true;
}

export function getPerTabBreakdown(daily, fromKey, toKey) {
  const out = {};
  for (const tab of TABS) out[tab] = 0;

  for (const [key, day] of Object.entries(daily)) {
    if (!inRange(key, fromKey, toKey)) continue;
    for (const tab of TABS) out[tab] += day.byTab[tab] ?? 0;
  }
  return out;
}

export function getAccuracyByLevel(daily, fromKey, toKey) {
  const out = {};
  for (const level of LEVELS) {
    out[level] = {};
    for (const verdict of VERDICTS) out[level][verdict] = 0;
  }

  for (const [key, day] of Object.entries(daily)) {
    if (!inRange(key, fromKey, toKey)) continue;
    for (const level of LEVELS) {
      for (const verdict of VERDICTS) {
        out[level][verdict] += day.byLevel[level]?.[verdict] ?? 0;
      }
    }
  }
  return out;
}

// ─── Today snapshot ──────────────────────────────────────────

export function getTodaySnapshot(daily, stats, dateKey) {
  const today = daily[dateKey];
  const exercises = today?.total ?? 0;
  const accuracy = { correct: 0, almost: 0, wrong: 0 };
  if (today) {
    for (const level of LEVELS) {
      for (const v of VERDICTS) {
        accuracy[v] += today.byLevel[level]?.[v] ?? 0;
      }
    }
  }
  return { exercises, accuracy, streak: stats?.streak ?? 0 };
}

// ─── Imperative recorder (uses storage) ──────────────────────

export function recordEvent(tab, level, verdict) {
  try {
    const state = loadState() ?? {};
    const daily = applyEvent(state.daily ?? {}, todayKey(), tab, level, verdict);
    saveState({ ...state, daily });
  } catch {
    // recordEvent is best-effort — never throw into the React tree
  }
}
