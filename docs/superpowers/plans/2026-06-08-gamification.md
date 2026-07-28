# Gamification Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add XP, German-rank levels, a daily-goal ring, achievement badges, and synthesized sound + confetti — derived from the existing `state.daily` event log (no migration) — surfaced in the header, a new Stats "Fortschritt" section, and celebration toasts.

**Architecture:** A pure `lib/gamification.js` computes XP/level/goal/achievements from existing state. `recordEvent` dispatches one `deutsch:progress` window event; `App` subscribes, recomputes, updates the header live, and fires toasts (with optional synth sound). New UI lives in `components/gamification/` + `components/ui/Toast.jsx`.

**Tech Stack:** React 18, Vite, inline-style tokens (`src/lib/theme.js`), Vitest + React Testing Library (163 tests today), Web Audio API.

**Branch:** `gamification` (created; spec committed).

---

## Conventions for every task

- **Additive / presentation-only.** No existing logic changes. The 163 current tests must stay green.
- **Verification per task:**
  1. `npm test` → `Tests N passed (N)` (N grows as we add tests)
  2. `npm run lint` → clean
  3. `npm run build` → `✓ built`
  4. UI tasks: dev-server browser screenshot of the affected surface.
- **Commit** at the end of each task with the message shown.
- Component tests are co-located `*.test.jsx`; lib tests `*.test.js`.

---

## File Structure

**Create:**
- `src/lib/gamification.js` — XP, levels, goal, achievements, context derivation (pure).
- `src/lib/gamification.test.js` — unit tests.
- `src/lib/sound.js` — Web Audio synth SFX + enable flag.
- `src/components/gamification/LevelBadge.jsx` (+ `.test.jsx`) — header level circle + XP ring.
- `src/components/gamification/GoalRing.jsx` (+ `.test.jsx`) — header daily-goal ring.
- `src/components/ui/Toast.jsx` (+ `.test.jsx`) — `ToastStack` + `Toast` item.
- `src/components/gamification/LevelCard.jsx` — Stats: rank/level/XP card.
- `src/components/gamification/GoalPicker.jsx` (+ `.test.jsx`) — Stats: goal preset buttons.
- `src/components/gamification/BadgeGrid.jsx` (+ `.test.jsx`) — Stats: achievement tiles.

**Modify:**
- `src/lib/stats.js` — `recordEvent` dispatches `deutsch:progress`.
- `src/App.jsx` — header layout A; derive gamification state; subscribe to event; first-run backfill; toasts + sound.
- `src/components/StatsTab.jsx` — new "Fortschritt" section; move LEARNED here.

---

## Task 1: `lib/gamification.js` (pure core) + tests

**Files:**
- Create: `src/lib/gamification.js`, `src/lib/gamification.test.js`

- [x] **Step 1: Write the failing test.** Create `src/lib/gamification.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  XP_PER_VERDICT, GOAL_PRESETS, DEFAULT_GOAL,
  xpForDay, totalXp, todayXp,
  thresholdForLevel, levelFromXp, rankName,
  goalProgress, ACHIEVEMENTS, earnedAchievements,
  totalExercises, decksMastered, gamificationContext,
} from './gamification';

const day = (a1c = 0, a1a = 0, a1w = 0) => ({
  total: a1c + a1a + a1w,
  byTab: {},
  byLevel: {
    a1: { correct: a1c, almost: a1a, wrong: a1w },
    a2: { correct: 0, almost: 0, wrong: 0 },
    b1: { correct: 0, almost: 0, wrong: 0 },
  },
});

describe('XP', () => {
  it('weights verdicts 10 / 6 / 3', () => {
    expect(XP_PER_VERDICT).toEqual({ correct: 10, almost: 6, wrong: 3 });
    expect(xpForDay(day(2, 1, 1))).toBe(20 + 6 + 3); // 29
  });
  it('xpForDay is 0 for undefined / empty', () => {
    expect(xpForDay(undefined)).toBe(0);
    expect(xpForDay({})).toBe(0);
  });
  it('totalXp sums all days; todayXp reads one', () => {
    const daily = { '2026-06-01': day(1, 0, 0), '2026-06-02': day(0, 0, 2) };
    expect(totalXp(daily)).toBe(10 + 6);
    expect(todayXp(daily, '2026-06-02')).toBe(6);
    expect(todayXp(daily, '2026-06-09')).toBe(0);
  });
});

describe('levels', () => {
  it('threshold(L) = 25(L-1)L', () => {
    expect(thresholdForLevel(1)).toBe(0);
    expect(thresholdForLevel(2)).toBe(50);
    expect(thresholdForLevel(5)).toBe(500);
    expect(thresholdForLevel(10)).toBe(2250);
  });
  it('levelFromXp finds the level + progress', () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(49).level).toBe(1);
    expect(levelFromXp(50).level).toBe(2);
    expect(levelFromXp(500).level).toBe(5);
    const l = levelFromXp(75); // level 2 (base 50), xpToNext 100, into 25
    expect(l).toMatchObject({ level: 2, xpIntoLevel: 25, xpToNext: 100 });
    expect(l.progress).toBeCloseTo(0.25);
  });
  it('rankName uses German bands', () => {
    expect(rankName(1)).toBe('Anfänger');
    expect(rankName(3)).toBe('Lernende');
    expect(rankName(6)).toBe('Fortgeschritten');
    expect(rankName(10)).toBe('Sehr gut');
    expect(rankName(15)).toBe('Fließend');
    expect(rankName(20)).toBe('Muttersprachler');
  });
});

describe('goalProgress', () => {
  it('reports under / at / over target', () => {
    expect(goalProgress(20, 50)).toMatchObject({ current: 20, target: 50, met: false });
    expect(goalProgress(20, 50).pct).toBeCloseTo(0.4);
    expect(goalProgress(50, 50).met).toBe(true);
    expect(goalProgress(80, 50).pct).toBe(1); // capped
  });
});

describe('achievements', () => {
  const ctx = (o) => ({ streak: 0, totalExercises: 0, masteredCount: 0, decksMastered: 0, level: 1, ...o });
  it('has 11 with unique ids', () => {
    expect(ACHIEVEMENTS).toHaveLength(11);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(11);
  });
  it('streak/volume/mastery rules fire at thresholds', () => {
    expect(earnedAchievements(ctx({ streak: 2 }))).not.toContain('streak3');
    expect(earnedAchievements(ctx({ streak: 3 }))).toContain('streak3');
    expect(earnedAchievements(ctx({ totalExercises: 100 }))).toContain('vol100');
    expect(earnedAchievements(ctx({ masteredCount: 25 }))).toContain('words25');
    expect(earnedAchievements(ctx({ decksMastered: 1 }))).toContain('deck1');
    expect(earnedAchievements(ctx({ decksMastered: 4 }))).toEqual(
      expect.arrayContaining(['deck1', 'allDecks'])
    );
  });
});

describe('context derivation', () => {
  it('totalExercises sums day.total', () => {
    expect(totalExercises({ a: { total: 3 }, b: { total: 4 } })).toBe(7);
  });
  it('decksMastered counts fully Box-5 preset decks', () => {
    // empty srs → 0 decks mastered
    expect(decksMastered({})).toBe(0);
  });
  it('gamificationContext assembles from state', () => {
    const state = { stats: { streak: 5 }, daily: { d: { total: 2, byLevel: {} } }, srs: {} };
    const c = gamificationContext(state);
    expect(c.streak).toBe(5);
    expect(c.totalExercises).toBe(2);
    expect(c.decksMastered).toBe(0);
    expect(typeof c.level).toBe('number');
  });
});
```

- [x] **Step 2: Run it — expect failure.** Run: `npx vitest run src/lib/gamification.test.js` → FAIL (module not found).

- [x] **Step 3: Implement `src/lib/gamification.js`:**

```js
// Gamification — XP, levels, daily goal, achievements. PURE (no storage/DOM).
// XP is DERIVED from the existing state.daily log — nothing is stored as a
// running counter, so all past practice counts and there is no migration.

import { getMasteredCount, srsKey, MASTERED_BOX } from './srs';
import { PRESET_DECKS } from '../data/content';

export const XP_PER_VERDICT = { correct: 10, almost: 6, wrong: 3 };
export const GOAL_PRESETS = { casual: 20, regular: 50, serious: 100 };
export const DEFAULT_GOAL = 50;

// ─── XP ───────────────────────────────────────────────────────
export function xpForDay(day) {
  if (!day || !day.byLevel) return 0;
  let xp = 0;
  for (const lv of Object.values(day.byLevel)) {
    xp +=
      (lv.correct ?? 0) * XP_PER_VERDICT.correct +
      (lv.almost ?? 0) * XP_PER_VERDICT.almost +
      (lv.wrong ?? 0) * XP_PER_VERDICT.wrong;
  }
  return xp;
}

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
  { id: 'streak3', category: 'streak', name: 'Drei am Stück', icon: '🔥', test: (c) => c.streak >= 3 },
  { id: 'streak7', category: 'streak', name: 'Wochenheld', icon: '🔥', test: (c) => c.streak >= 7 },
  { id: 'streak14', category: 'streak', name: 'Zwei Wochen', icon: '🔥', test: (c) => c.streak >= 14 },
  { id: 'streak30', category: 'streak', name: 'Monatsmeister', icon: '👑', test: (c) => c.streak >= 30 },
  { id: 'vol100', category: 'volume', name: 'Erste Hundert', icon: '💯', test: (c) => c.totalExercises >= 100 },
  { id: 'vol500', category: 'volume', name: 'Fünfhundert', icon: '🏛️', test: (c) => c.totalExercises >= 500 },
  { id: 'vol1000', category: 'volume', name: 'Tausend', icon: '🚀', test: (c) => c.totalExercises >= 1000 },
  { id: 'words25', category: 'volume', name: 'Wortschatz 25', icon: '📖', test: (c) => c.masteredCount >= 25 },
  { id: 'words50', category: 'volume', name: 'Wortschatz 50', icon: '📚', test: (c) => c.masteredCount >= 50 },
  { id: 'deck1', category: 'mastery', name: 'Deck-Meister', icon: '✅', test: (c) => c.decksMastered >= 1 },
  { id: 'allDecks', category: 'mastery', name: 'Alle Decks', icon: '🏆', test: (c) => c.decksMastered >= 4 },
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
    if (deck.every((card) => srs?.[srsKey(deckId, card.de)]?.box === MASTERED_BOX)) n += 1;
  }
  return n;
}

export function gamificationContext(state) {
  const daily = state.daily ?? {};
  const srs = state.srs ?? {};
  return {
    streak: state.stats?.streak ?? 0,
    totalExercises: totalExercises(daily),
    masteredCount: getMasteredCount(srs),
    decksMastered: decksMastered(srs),
    level: levelFromXp(totalXp(daily)).level,
  };
}
```

- [x] **Step 4: Run tests — expect pass.** Run: `npx vitest run src/lib/gamification.test.js` → PASS.

- [x] **Step 5: Commit.**

```bash
git add src/lib/gamification.js src/lib/gamification.test.js
git commit -m "feat(gamification): pure XP/level/goal/achievement engine + tests"
```

---

## Task 2: `lib/sound.js` + `recordEvent` dispatches the progress event

**Files:**
- Create: `src/lib/sound.js`
- Modify: `src/lib/stats.js` (the `recordEvent` function)

- [x] **Step 1: Create `src/lib/sound.js`** (no test — Web Audio is unavailable in jsdom; functions no-op safely there):

```js
// Synthesized sound effects via Web Audio — no asset files. No-op unless enabled
// and an AudioContext is available (so it's safe in jsdom / SSR / muted state).
let enabled = false;
let ctx = null;

export function setSoundEnabled(on) {
  enabled = !!on;
}

function audioCtx() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = AC ? new AC() : null;
  } catch {
    ctx = null;
  }
  return ctx;
}

function playNotes(notes) {
  if (!enabled) return;
  const ac = audioCtx();
  if (!ac) return;
  try {
    if (ac.state === 'suspended') ac.resume();
    const now = ac.currentTime;
    for (const n of notes) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = n.freq;
      const t0 = now + n.start;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.18, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);
      osc.connect(gain).connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + n.dur + 0.02);
    }
  } catch {
    /* ignore audio errors */
  }
}

export const playCorrect = () =>
  playNotes([{ freq: 660, start: 0, dur: 0.12 }, { freq: 880, start: 0.08, dur: 0.14 }]);
export const playLevelUp = () =>
  playNotes([
    { freq: 523, start: 0, dur: 0.16 },
    { freq: 659, start: 0.12, dur: 0.16 },
    { freq: 784, start: 0.24, dur: 0.28 },
  ]);
export const playAchievement = () =>
  playNotes([{ freq: 784, start: 0, dur: 0.16 }, { freq: 1047, start: 0.12, dur: 0.3 }]);
export const playGoalMet = () =>
  playNotes([{ freq: 587, start: 0, dur: 0.16 }, { freq: 880, start: 0.12, dur: 0.26 }]);
```

- [x] **Step 2: Add the progress event to `recordEvent`.** In `src/lib/stats.js`, the current function is:

```js
export function recordEvent(tab, level, verdict) {
  try {
    const state = loadState() ?? {};
    const daily = applyEvent(state.daily ?? {}, todayKey(), tab, level, verdict);
    saveState({ ...state, daily });
  } catch {
    // recordEvent is best-effort — never throw into the React tree
  }
}
```

Change the body so it dispatches after a successful save:

```js
export function recordEvent(tab, level, verdict) {
  try {
    const state = loadState() ?? {};
    const daily = applyEvent(state.daily ?? {}, todayKey(), tab, level, verdict);
    saveState({ ...state, daily });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('deutsch:progress'));
    }
  } catch {
    // recordEvent is best-effort — never throw into the React tree
  }
}
```

- [x] **Step 3: Verify the existing stats tests still pass.** Run: `npx vitest run src/lib/stats.test.js` → PASS (the `recordEvent` tests run in jsdom where `window` exists; dispatch is harmless and uncaught by those tests).

- [x] **Step 4: Full verify.** `npm run lint && npm run build && npm test` → clean / `✓ built` / all pass.

- [x] **Step 5: Commit.**

```bash
git add src/lib/sound.js src/lib/stats.js
git commit -m "feat(gamification): synth sound module + recordEvent fires deutsch:progress"
```

---

## Task 3: Header primitives — `LevelBadge` + `GoalRing` (+ tests)

**Files:**
- Create: `src/components/gamification/LevelBadge.jsx`, `LevelBadge.test.jsx`, `GoalRing.jsx`, `GoalRing.test.jsx`

- [x] **Step 1: Create `src/components/gamification/LevelBadge.jsx`:**

```jsx
import { COLORS, FONTS, FONT_WEIGHT } from '../../lib/theme';

// Circle showing the level number, wrapped by an SVG XP ring (green) that fills
// to `progress` (0–1) toward the next level. `rank` shown via title on hover.
export default function LevelBadge({ level, progress, rank, size = 52 }) {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <div
      title={rank ? `${rank} · Level ${level}` : `Level ${level}`}
      style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e7dcae" strokeWidth="5" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={COLORS.green}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: FONTS.display,
          fontWeight: FONT_WEIGHT.black,
          fontSize: size * 0.36,
          color: COLORS.ink,
        }}
      >
        {level}
      </div>
    </div>
  );
}
```

- [x] **Step 2: Create `src/components/gamification/LevelBadge.test.jsx`:**

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LevelBadge from './LevelBadge';

describe('LevelBadge', () => {
  it('shows the level number', () => {
    render(<LevelBadge level={7} progress={0.5} rank="Fortgeschritten" />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });
  it('exposes the rank + level via title', () => {
    render(<LevelBadge level={7} progress={0.5} rank="Fortgeschritten" />);
    expect(screen.getByTitle('Fortgeschritten · Level 7')).toBeInTheDocument();
  });
});
```

- [x] **Step 3: Create `src/components/gamification/GoalRing.jsx`:**

```jsx
import { COLORS } from '../../lib/theme';

// Daily-goal ring: red ring fills to `pct` (0–1); turns green with a ✓ when met.
export default function GoalRing({ pct, met, size = 48 }) {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, pct));
  const color = met ? COLORS.green : COLORS.red;
  return (
    <div
      title={met ? 'Daily goal reached!' : `Daily goal · ${Math.round(clamped * 100)}%`}
      style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e7dcae" strokeWidth="5" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.34,
        }}
      >
        {met ? '✓' : '🎯'}
      </div>
    </div>
  );
}
```

- [x] **Step 4: Create `src/components/gamification/GoalRing.test.jsx`:**

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import GoalRing from './GoalRing';

describe('GoalRing', () => {
  it('shows the target emoji while in progress', () => {
    render(<GoalRing pct={0.4} met={false} />);
    expect(screen.getByText('🎯')).toBeInTheDocument();
    expect(screen.getByTitle('Daily goal · 40%')).toBeInTheDocument();
  });
  it('shows a check when met', () => {
    render(<GoalRing pct={1} met />);
    expect(screen.getByText('✓')).toBeInTheDocument();
    expect(screen.getByTitle('Daily goal reached!')).toBeInTheDocument();
  });
});
```

- [x] **Step 5: Verify + commit.** `npm test` (4 new pass) + `npm run lint` + `npm run build`.

```bash
git add src/components/gamification/LevelBadge.jsx src/components/gamification/LevelBadge.test.jsx src/components/gamification/GoalRing.jsx src/components/gamification/GoalRing.test.jsx
git commit -m "feat(gamification): LevelBadge + GoalRing header primitives + tests"
```

---

## Task 4: Header layout A + gamification state + progress subscription

**Files:**
- Modify: `src/App.jsx`

This is the wiring task. No new tests (covered by lib + primitive tests + manual screenshot); existing 167 stay green.

- [x] **Step 1: Imports.** Add to `src/App.jsx` imports (near the other `./lib` + `./components` imports):

```jsx
import { loadState, saveState } from './lib/storage';
import { todayKey } from './lib/stats';
import {
  totalXp,
  todayXp,
  levelFromXp,
  goalProgress,
  earnedAchievements,
  gamificationContext,
  DEFAULT_GOAL,
} from './lib/gamification';
import { setSoundEnabled, playLevelUp, playAchievement, playGoalMet } from './lib/sound';
import LevelBadge from './components/gamification/LevelBadge';
import GoalRing from './components/gamification/GoalRing';
```

(`loadState` is already imported — don't duplicate; ensure `saveState` is included.)

- [x] **Step 2: Gamification state + a derive helper.** Inside `App()`, after the existing `const [streakBurst, setStreakBurst] = useState(false);` line, add:

```jsx
  // Gamification — derived from storage, refreshed on every `deutsch:progress`.
  const prevLevelRef = useRef(null);
  const deriveGame = () => {
    const s = loadState() ?? {};
    const daily = s.daily ?? {};
    return {
      lvl: levelFromXp(totalXp(daily)),
      goal: goalProgress(todayXp(daily, todayKey()), s.gamification?.goal),
    };
  };
  const [game, setGame] = useState(deriveGame);
```

(`game.lvl` is the `levelFromXp` result `{ level, rankName, progress, ... }`; `game.goal` is the `goalProgress` result `{ pct, met, ... }`. The effect in Step 3 calls `setGame(deriveGame())` to refresh after each progress event.)

- [x] **Step 3: First-run backfill + progress reactions.** Add this effect after the existing streak-milestone effect:

```jsx
  useEffect(() => {
    function applyProgress() {
      const s = loadState() ?? {};
      const g = s.gamification ?? { goal: DEFAULT_GOAL, soundOn: false, achievements: {}, lastGoalMet: null };
      const ctx = gamificationContext(s);
      const lvlInfo = levelFromXp(totalXp(s.daily ?? {}));
      const earned = earnedAchievements(ctx);
      const tKey = todayKey();
      const goal = goalProgress(todayXp(s.daily ?? {}, tKey), g.goal);

      const firstRun = prevLevelRef.current === null;
      const nextG = { ...g, achievements: { ...g.achievements } };
      const newToasts = [];

      if (firstRun) {
        // Silent backfill: acknowledge everything already true; never toast it.
        for (const id of earned) if (!(id in nextG.achievements)) nextG.achievements[id] = Date.now();
        if (goal.met) nextG.lastGoalMet = tKey;
        prevLevelRef.current = lvlInfo.level;
      } else {
        if (lvlInfo.level > prevLevelRef.current) {
          newToasts.push({ kind: 'level', title: `Level ${lvlInfo.level}`, sub: lvlInfo.rankName, icon: '⭐' });
        }
        prevLevelRef.current = lvlInfo.level;
        for (const id of earned) {
          if (!(id in nextG.achievements)) {
            nextG.achievements[id] = Date.now();
            newToasts.push({ kind: 'ach', id });
          }
        }
        if (goal.met && nextG.lastGoalMet !== tKey) {
          nextG.lastGoalMet = tKey;
          newToasts.push({ kind: 'goal', title: 'Tagesziel erreicht!', sub: `${goal.target} XP`, icon: '🎯' });
        }
      }

      // Persist gamification changes (merge — never clobber other keys)
      saveState({ ...s, gamification: nextG });
      setSoundEnabled(!!nextG.soundOn);
      setGame(deriveGame());

      if (newToasts.length) {
        pushToasts(newToasts);
        setStreakBurst(true);
        setTimeout(() => setStreakBurst(false), 1600);
        if (nextG.soundOn) {
          newToasts.forEach((t) => {
            if (t.kind === 'level') playLevelUp();
            else if (t.kind === 'ach') playAchievement();
            else if (t.kind === 'goal') playGoalMet();
          });
        }
      }
    }

    applyProgress(); // run once on mount (does the silent backfill)
    window.addEventListener('deutsch:progress', applyProgress);
    window.addEventListener('focus', applyProgress);
    return () => {
      window.removeEventListener('deutsch:progress', applyProgress);
      window.removeEventListener('focus', applyProgress);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run-once subscription
  }, []);
```

NOTE: `pushToasts` comes from Task 5 (the toast stack). Until Task 5 lands, temporarily define `const pushToasts = () => {};` near the top of `App()` so this compiles; Task 5 replaces it with the real toast state. (Flagged again in Task 5.)

- [x] **Step 4: `useRef` import.** Ensure `useRef` is imported from React at the top: `import { useState, useEffect, useRef } from 'react';`

- [x] **Step 5: Header — add LevelBadge + GoalRing, remove LEARNED.** Replace the header right-side block (currently the two `StatBlock`s for STREAK + LEARNED) with:

```jsx
        <div style={{ display: 'flex', gap: mobile ? 10 : 16, alignItems: 'center' }}>
          <LevelBadge
            level={game.lvl.level}
            progress={game.lvl.progress}
            rank={game.lvl.rankName}
            size={mobile ? 42 : 52}
          />
          <StatBlock
            label="STREAK"
            value={stats.streak}
            icon={<Flame size={mobile ? 12 : 14} />}
            accent
            pulsing={streakPulsing}
          />
          <GoalRing pct={game.goal.pct} met={game.goal.met} size={mobile ? 40 : 48} />
        </div>
```

(Removes the LEARNED `StatBlock` — it reappears in Stats in Task 6. Leave the `Check` icon import; it's reused in Stats. If lint flags `Check` as unused after this task, leave it — Task 6 uses it. If you prefer zero interim warnings, this task and Task 6 can be committed together.)

- [x] **Step 6: Verify.** `npm test` (all pass) + `npm run lint` + `npm run build`. Dev server → seed some `daily` data (or just practice) → header shows the level badge with XP ring + goal ring; no error in console.

- [x] **Step 7: Commit.**

```bash
git add src/App.jsx
git commit -m "feat(gamification): header layout A + derive state + progress subscription + backfill"
```

---

## Task 5: Toasts — `ui/Toast` + wire celebrations

**Files:**
- Create: `src/components/ui/Toast.jsx`, `src/components/ui/Toast.test.jsx`
- Modify: `src/App.jsx` (replace the temporary `pushToasts` stub with real toast state + render `<ToastStack/>`)

- [x] **Step 1: Create `src/components/ui/Toast.jsx`:**

```jsx
import { useEffect } from 'react';
import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, RADIUS, SHADOW, SPACE } from '../../lib/theme';

// One auto-dismissing toast. `onDone` is called after the lifetime elapses.
export function Toast({ icon, title, sub, onDone, ttl = 3200 }) {
  useEffect(() => {
    const t = setTimeout(onDone, ttl);
    return () => clearTimeout(t);
  }, [onDone, ttl]);

  return (
    <div
      className="slide-up"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE[3],
        background: COLORS.ink,
        color: COLORS.paper,
        borderRadius: RADIUS.lg,
        boxShadow: SHADOW.bar,
        padding: `${SPACE[3]}px ${SPACE[5]}px`,
        minWidth: 240,
        pointerEvents: 'auto',
      }}
    >
      <span style={{ fontSize: 26 }}>{icon}</span>
      <div>
        <div style={{ fontFamily: FONTS.display, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.lg }}>
          {title}
        </div>
        {sub && (
          <div style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag, color: COLORS.gold }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

// Fixed stack of toasts near the top-center. `toasts` = [{id, icon, title, sub}].
export default function ToastStack({ toasts, onDismiss }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <Toast key={t.id} icon={t.icon} title={t.title} sub={t.sub} onDone={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}
```

- [x] **Step 2: Create `src/components/ui/Toast.test.jsx`:**

```jsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import ToastStack, { Toast } from './Toast';

afterEach(() => vi.useRealTimers());

describe('Toast', () => {
  it('renders title + sub', () => {
    render(<Toast icon="⭐" title="Level 7" sub="Fortgeschritten" onDone={() => {}} />);
    expect(screen.getByText('Level 7')).toBeInTheDocument();
    expect(screen.getByText('Fortgeschritten')).toBeInTheDocument();
  });
  it('calls onDone after its ttl', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<Toast icon="⭐" title="X" onDone={onDone} ttl={1000} />);
    expect(onDone).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1000));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('ToastStack', () => {
  it('renders one toast per item', () => {
    const toasts = [
      { id: 1, icon: '⭐', title: 'A' },
      { id: 2, icon: '🏆', title: 'B' },
    ];
    render(<ToastStack toasts={toasts} onDismiss={() => {}} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });
});
```

- [x] **Step 3: Wire real toast state in `App.jsx`.** Remove the temporary `const pushToasts = () => {};` stub. Add near the top of `App()`:

```jsx
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);
  const pushToasts = (items) => {
    setToasts((cur) => [
      ...cur,
      ...items.map((it) => {
        const id = ++toastIdRef.current;
        if (it.kind === 'ach') {
          const a = ACHIEVEMENTS.find((x) => x.id === it.id);
          return { id, icon: a?.icon ?? '🏅', title: a?.name ?? 'Achievement', sub: 'Achievement freigeschaltet' };
        }
        return { id, icon: it.icon, title: it.title, sub: it.sub };
      }),
    ]);
  };
  const dismissToast = (id) => setToasts((cur) => cur.filter((t) => t.id !== id));
```

Add `ACHIEVEMENTS` to the gamification import in App.jsx. Render `<ToastStack toasts={toasts} onDismiss={dismissToast} />` just inside the root `<div>` (next to the existing streak `<Confetti/>` block). Import: `import ToastStack from './components/ui/Toast';`

- [x] **Step 4: Verify.** `npm test` (Toast tests pass) + lint + build. Dev server: trigger a level-up by seeding XP just below a threshold and answering once → toast slides in, confetti fires, auto-dismisses.

- [x] **Step 5: Commit.**

```bash
git add src/components/ui/Toast.jsx src/components/ui/Toast.test.jsx src/App.jsx
git commit -m "feat(gamification): toast stack + wire level-up/achievement/goal celebrations"
```

---

## Task 6: Stats "Fortschritt" section — LevelCard, GoalPicker, BadgeGrid

**Files:**
- Create: `src/components/gamification/LevelCard.jsx`, `GoalPicker.jsx`, `GoalPicker.test.jsx`, `BadgeGrid.jsx`, `BadgeGrid.test.jsx`
- Modify: `src/components/StatsTab.jsx`

- [x] **Step 1: `LevelCard.jsx`** — rank + level + XP-to-next bar + total XP + LEARNED figure. Props: `{ lvl, totalXp, learnedCount }` where `lvl` is the `levelFromXp` result.

```jsx
import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, SPACE, RADIUS, SHADOW } from '../../lib/theme';

export default function LevelCard({ lvl, totalXp, learnedCount }) {
  return (
    <div
      style={{
        borderRadius: RADIUS.lg,
        boxShadow: SHADOW.card,
        background: COLORS.card,
        padding: SPACE[6],
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: SPACE[6],
        alignItems: 'center',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: FONTS.display,
            fontWeight: FONT_WEIGHT.black,
            fontSize: FONT_SIZE['6xl'],
            color: COLORS.ink,
            lineHeight: 1,
          }}
        >
          {lvl.level}
        </div>
        <div style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag, letterSpacing: LETTER_SPACING.caps, color: COLORS.mute }}>
          LEVEL
        </div>
      </div>
      <div>
        <div style={{ fontFamily: FONTS.display, fontSize: FONT_SIZE['2xl'], fontWeight: FONT_WEIGHT.bold, color: COLORS.ink }}>
          {lvl.rankName}
        </div>
        <div style={{ height: 12, borderRadius: RADIUS.pill, background: COLORS.paperDeep, overflow: 'hidden', margin: `${SPACE[2]}px 0` }}>
          <div style={{ width: `${Math.round(lvl.progress * 100)}%`, height: '100%', background: COLORS.green, transition: 'width 0.4s ease' }} />
        </div>
        <div style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.sm, color: COLORS.mute }}>
          {lvl.xpIntoLevel} / {lvl.xpToNext} XP to next · {totalXp} XP total
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: FONTS.display, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE['4xl'], color: COLORS.ink }}>
          {learnedCount}
        </div>
        <div style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag, letterSpacing: LETTER_SPACING.caps, color: COLORS.mute }}>
          LEARNED
        </div>
      </div>
    </div>
  );
}
```

- [x] **Step 2: `GoalPicker.jsx` + test.** Three 3D-press buttons; selecting calls `onPick(xpValue)`. Props: `{ goal, onPick }`.

```jsx
import { GOAL_PRESETS } from '../../lib/gamification';
import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, SPACE, RADIUS, SHADOW } from '../../lib/theme';

const OPTIONS = [
  { key: 'casual', label: 'Casual', xp: GOAL_PRESETS.casual },
  { key: 'regular', label: 'Regular', xp: GOAL_PRESETS.regular },
  { key: 'serious', label: 'Serious', xp: GOAL_PRESETS.serious },
];

export default function GoalPicker({ goal, onPick }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: SPACE[3] }}>
      {OPTIONS.map((o) => {
        const active = goal === o.xp;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onPick(o.xp)}
            style={{
              border: 'none',
              borderRadius: RADIUS.md,
              boxShadow: `0 4px 0 ${active ? COLORS.greenDeep : COLORS.lip}`,
              background: active ? COLORS.green : COLORS.card,
              color: active ? COLORS.paper : COLORS.ink,
              padding: SPACE[4],
              cursor: 'pointer',
              fontFamily: FONTS.mono,
              textAlign: 'center',
            }}
          >
            <div style={{ fontWeight: FONT_WEIGHT.bold, letterSpacing: LETTER_SPACING.widest, fontSize: FONT_SIZE.sm }}>
              {o.label.toUpperCase()}
            </div>
            <div style={{ fontFamily: FONTS.display, fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold }}>{o.xp} XP</div>
          </button>
        );
      })}
    </div>
  );
}
```

```jsx
// GoalPicker.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GoalPicker from './GoalPicker';

describe('GoalPicker', () => {
  it('renders the three presets', () => {
    render(<GoalPicker goal={50} onPick={() => {}} />);
    expect(screen.getByText('20 XP')).toBeInTheDocument();
    expect(screen.getByText('50 XP')).toBeInTheDocument();
    expect(screen.getByText('100 XP')).toBeInTheDocument();
  });
  it('calls onPick with the chosen XP value', async () => {
    const onPick = vi.fn();
    render(<GoalPicker goal={50} onPick={onPick} />);
    await userEvent.click(screen.getByText('100 XP'));
    expect(onPick).toHaveBeenCalledWith(100);
  });
});
```

- [x] **Step 3: `BadgeGrid.jsx` + test.** All `ACHIEVEMENTS` as tiles; earned = color, locked = greyed. Props: `{ achievements }` (the persisted `{id: ts}` map).

```jsx
import { ACHIEVEMENTS } from '../../lib/gamification';
import { COLORS, FONTS, FONT_SIZE, LETTER_SPACING, SPACE, RADIUS, SHADOW } from '../../lib/theme';

export default function BadgeGrid({ achievements }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: SPACE[3] }}>
      {ACHIEVEMENTS.map((a) => {
        const earned = !!achievements?.[a.id];
        return (
          <div
            key={a.id}
            title={a.name}
            style={{
              borderRadius: RADIUS.md,
              boxShadow: earned ? SHADOW.card : 'none',
              background: earned ? COLORS.card : COLORS.paperDeep,
              opacity: earned ? 1 : 0.55,
              padding: SPACE[4],
              textAlign: 'center',
              filter: earned ? 'none' : 'grayscale(1)',
            }}
          >
            <div style={{ fontSize: 30 }}>{a.icon}</div>
            <div style={{ fontFamily: FONTS.display, fontSize: FONT_SIZE.base, fontWeight: 600, color: COLORS.ink, marginTop: SPACE[1] }}>
              {a.name}
            </div>
            <div style={{ fontFamily: FONTS.mono, fontSize: 9, letterSpacing: LETTER_SPACING.caps, color: COLORS.mute, marginTop: 2 }}>
              {earned ? 'FREIGESCHALTET' : 'GESPERRT'}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

```jsx
// BadgeGrid.test.jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BadgeGrid from './BadgeGrid';

describe('BadgeGrid', () => {
  it('marks earned vs locked badges', () => {
    render(<BadgeGrid achievements={{ streak3: 123 }} />);
    expect(screen.getByText('Drei am Stück')).toBeInTheDocument();
    // 1 earned, the rest (10) locked
    expect(screen.getAllByText('FREIGESCHALTET')).toHaveLength(1);
    expect(screen.getAllByText('GESPERRT')).toHaveLength(10);
  });
});
```

- [x] **Step 4: Add the Fortschritt section to `StatsTab.jsx`.** Import the three components + `levelFromXp`, `totalXp` from gamification. The component already reads `state` via `loadState()` and derives `daily`, `srs`, `stats`. Add at the top of the rendered sections (before "A · Today"):

```jsx
        <section>
          <SectionLabel num="0" text="Fortschritt" />
          <LevelCard lvl={levelFromXp(totalXp(daily))} totalXp={totalXp(daily)} learnedCount={stats.learnedCount ?? 0} />
          <div style={{ marginTop: SPACE[4] }}>
            <SectionLabel num="·" text="Daily goal" />
            <GoalPicker
              goal={state.gamification?.goal ?? DEFAULT_GOAL}
              onPick={(xp) => {
                const s = loadState() ?? {};
                const g = { ...(s.gamification ?? { soundOn: false, achievements: {}, lastGoalMet: null }), goal: xp };
                saveState({ ...s, gamification: g });
                setState(loadState() ?? {});
                window.dispatchEvent(new CustomEvent('deutsch:progress'));
              }}
            />
          </div>
          <div style={{ marginTop: SPACE[4] }}>
            <SectionLabel num="·" text="Badges" />
            <BadgeGrid achievements={state.gamification?.achievements ?? {}} />
          </div>
        </section>
```

Add imports to `StatsTab.jsx`: `saveState` from `../lib/storage`; `levelFromXp, totalXp, DEFAULT_GOAL` from `../lib/gamification`; the three components from `./gamification/...`. (`SPACE` is already imported.)

- [x] **Step 5: Verify.** `npm test` (GoalPicker + BadgeGrid pass) + lint + build. Dev server → Stats tab shows the Fortschritt card, goal picker (selecting changes the active button + header ring target), and the badge grid (earned vs locked).

- [x] **Step 6: Commit.**

```bash
git add src/components/gamification/LevelCard.jsx src/components/gamification/GoalPicker.jsx src/components/gamification/GoalPicker.test.jsx src/components/gamification/BadgeGrid.jsx src/components/gamification/BadgeGrid.test.jsx src/components/StatsTab.jsx
git commit -m "feat(gamification): Stats Fortschritt section — level card, goal picker, badge grid"
```

---

## Task 7: Polish + sound toggle + final regression

**Files:**
- Modify: `src/components/StatsTab.jsx` (sound toggle), `src/App.jsx` (ensure `setSoundEnabled` reflects state on load)

- [x] **Step 1: Sound toggle.** In the Fortschritt section (StatsTab), under the goal picker, add a mute toggle:

```jsx
          <button
            type="button"
            onClick={() => {
              const s = loadState() ?? {};
              const cur = s.gamification ?? { goal: DEFAULT_GOAL, achievements: {}, lastGoalMet: null };
              const g = { ...cur, soundOn: !cur.soundOn };
              saveState({ ...s, gamification: g });
              setState(loadState() ?? {});
              window.dispatchEvent(new CustomEvent('deutsch:progress'));
            }}
            style={{
              marginTop: SPACE[4],
              border: 'none',
              borderRadius: RADIUS.md,
              boxShadow: `0 4px 0 ${COLORS.lip}`,
              background: COLORS.card,
              color: COLORS.ink,
              padding: `${SPACE[2]}px ${SPACE[4]}px`,
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.sm,
              letterSpacing: LETTER_SPACING.widest,
              cursor: 'pointer',
            }}
          >
            {(state.gamification?.soundOn ?? false) ? '🔊 SOUND: ON' : '🔇 SOUND: OFF'}
          </button>
```

(Requires `RADIUS`, `COLORS`, `FONTS`, `FONT_SIZE`, `LETTER_SPACING` in StatsTab imports — add any missing.)

- [x] **Step 2: Sound reflects persisted state on load.** Confirm Task 4's `applyProgress` calls `setSoundEnabled(!!nextG.soundOn)` (it does) so the flag is correct on first mount and after every toggle.

- [x] **Step 3: Full regression.** `npm test` (all pass — expect ~180) + `npm run lint` (clean) + `npm run build` (`✓ built`).

- [x] **Step 4: Whole-app screenshot tour.** Dev server; seed rich state; screenshot the header (badge + streak + goal ring), a level-up toast, and the Stats Fortschritt section. Confirm reduced-motion still disables confetti (the `Confetti` `.confetti-layer` guard already handles this).

- [x] **Step 5: Commit.**

```bash
git add src/components/StatsTab.jsx src/App.jsx
git commit -m "feat(gamification): sound toggle in Stats + final polish"
```

---

## Final: finish the branch

- [x] `npm test` + `npm run lint` + `npm run build` all green.
- [x] Use the `superpowers:finishing-a-development-branch` skill to merge/PR `gamification`.

---

## Notes for the executor

- **Never clobber storage.** Every `saveState` must spread the freshly `loadState()`-ed object first (`{ ...s, gamification: g }`) — the `daily`/`items`/`srs`/`stats` keys are written by other code paths.
- **Backfill is one-shot per mount** via `prevLevelRef === null`. Don't add it to other effects.
- **`recordEvent` already runs in every tab** — no tab files change in this plan.
- **`Check` icon import in App.jsx** becomes unused when LEARNED leaves the header (Task 4) and is not re-added to App (it moved to Stats as text). Remove the `Check` import from App.jsx in Task 4 if lint flags it.
