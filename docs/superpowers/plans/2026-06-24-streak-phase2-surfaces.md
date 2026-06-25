# Streak & Daily-Goal Drama — Phase 2: Surfaces & Moments (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Move the (now honest) streak into view and make hitting/extending it feel like a moment — an in-play goal strip, an animated goal ring, and celebrations for securing the streak, beating the record, and hitting milestones.

**Architecture:** Add `STREAK_MILESTONES` to `gameConfig` and a pure `crossedMilestone()` to `streak.js`. Extend `App.applyProgress` (the existing toast-diff pattern) with streak-secured / new-record / milestone toasts via a `prevStreakRef`, retiring the old `%7` effect. `deriveGame()` gains `streak`. A new `<GoalStrip>` renders in the exercise area; `GoalRing` animates its fill.

**Tech Stack:** React 18, Vitest, inline styles + the existing `<style>` keyframes block in App.jsx.

## Global Constraints

- Tests: Vitest `globals: false`; co-locate `*.test.js(x)`.
- All thresholds live in `gameConfig` (no magic numbers).
- Reuse existing celebration infra (`pushToasts`, `Confetti`/`streakBurst`, sounds). Honor `prefers-reduced-motion`.
- Land on `feat/streak-drama-phases-2-4`. Never bypass `.husky/pre-commit`.

---

### Task 1: `STREAK_MILESTONES` in gameConfig

**Files:** Modify `src/lib/gameConfig.js`; Modify `src/lib/gameConfig.test.js`

- [ ] **Step 1: Add the failing test** to `gameConfig.test.js`:

```js
import { STREAK_MILESTONES } from './gameConfig';

it('defines streak milestones', () => {
  expect(STREAK_MILESTONES).toEqual([3, 7, 14, 30, 50, 100]);
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/gameConfig.test.js` → FAIL.
- [ ] **Step 3: Add to `gameConfig.js`:**

```js
// Streak lengths that earn a celebration (replaces the old every-7-days burst).
export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100];
```

- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `git add src/lib/gameConfig.js src/lib/gameConfig.test.js && git commit -m "feat(streak): STREAK_MILESTONES config"`

---

### Task 2: `streak.crossedMilestone(prev, next)`

Returns the highest milestone in `(prev, next]` — i.e. one the streak just reached — or `null`.

**Files:** Modify `src/lib/streak.js`, `src/lib/streak.test.js`

- [ ] **Step 1: Add failing tests:**

```js
import { crossedMilestone } from './streak';

describe('crossedMilestone', () => {
  it('returns the milestone just reached', () => {
    expect(crossedMilestone(2, 3)).toBe(3);
    expect(crossedMilestone(6, 7)).toBe(7);
  });
  it('returns null when no milestone is crossed', () => {
    expect(crossedMilestone(3, 4)).toBeNull();
    expect(crossedMilestone(7, 7)).toBeNull();
  });
  it('returns the highest milestone when several are crossed at once', () => {
    expect(crossedMilestone(1, 8)).toBe(7);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/streak.test.js` → FAIL.
- [ ] **Step 3: Implement** (add to `streak.js`, importing the config):

```js
import { STREAK_MILESTONES } from './gameConfig';

// The highest milestone in (prev, next], or null. Used to fire a celebration
// the moment a streak reaches 3 / 7 / 14 / ….
export function crossedMilestone(prev, next) {
  const hit = STREAK_MILESTONES.filter((m) => m > prev && m <= next);
  return hit.length ? Math.max(...hit) : null;
}
```

- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `git add src/lib/streak.js src/lib/streak.test.js && git commit -m "feat(streak): crossedMilestone(prev, next)"`

---

### Task 3: Streak celebrations in `App.applyProgress`

Fire toasts when the streak is **secured/extended**, hits a **new record**, or crosses a **milestone**. Retire the old `%7` effect. Extend `deriveGame` with `streak`.

**Files:** Modify `src/App.jsx`

**Interfaces:** Consumes `crossedMilestone` from `streak.js`; reuses `pushToasts`, `setStreakBurst`, `playGoalMet`.

- [ ] **Step 1: Import** `crossedMilestone` (extend the existing streak import):

```js
import { currentStreak, bestStreakFromHistory, qualifies, crossedMilestone } from './lib/streak';
```

- [ ] **Step 2: Add a `prevStreakRef`** next to `prevLevelRef` (~line 51):

```js
const prevStreakRef = useRef(null);
```

- [ ] **Step 3: Extend `deriveGame`** (~line 52-59) to expose the streak:

```js
const deriveGame = () => {
  const s = loadState() ?? {};
  const daily = s.daily ?? {};
  const goalXp = s.gamification?.goal ?? DEFAULT_GOAL;
  return {
    lvl: levelFromXp(totalXp(daily)),
    goal: goalProgress(todayXp(daily, todayKey()), goalXp),
    streak: currentStreak(daily, goalXp, todayKey()),
  };
};
```

- [ ] **Step 4: Remove the old `%7` milestone effect** (the `useEffect` at ~lines 85-92, the one commented "Celebrate streak milestones (every 7 days)"). Delete the whole effect.

- [ ] **Step 5: Add streak toasts in `applyProgress`.** Replace the streak/bestStreak block (the lines from `const tStreak = ...` through `setStats((prev) => ({ ...prev, streak: tStreak }));`) with:

```js
      const tStreak = currentStreak(s.daily ?? {}, g.goal, tKey);
      const histBest = bestStreakFromHistory(s.daily ?? {}, g.goal);
      const prevBest = g.bestStreak ?? 0;
      nextG.bestStreak = firstRun
        ? Math.max(prevBest, histBest, s.stats?.streak ?? 0)
        : Math.max(prevBest, histBest, tStreak);

      if (firstRun) {
        prevStreakRef.current = tStreak;
      } else {
        const prevStreak = prevStreakRef.current ?? 0;
        if (tStreak > prevStreak) {
          newToasts.push({ kind: 'streak', title: `Streak → ${tStreak}`, sub: 'gesichert!', icon: '🔥' });
          if (tStreak > prevBest) {
            newToasts.push({ kind: 'record', title: 'Neuer Rekord!', sub: `${tStreak} Tage`, icon: '🏆' });
          }
          const milestone = crossedMilestone(prevStreak, tStreak);
          if (milestone) {
            newToasts.push({ kind: 'milestone', title: `${milestone}-Tage-Streak!`, sub: 'Meilenstein', icon: '⚡' });
          }
        }
        prevStreakRef.current = tStreak;
      }
      setStats((prev) => ({ ...prev, streak: tStreak }));
```

- [ ] **Step 6: Add a sound for the new kinds** in the `if (nextG.soundOn)` loop (~line 165): add `else if (t.kind === 'streak' || t.kind === 'record' || t.kind === 'milestone') playGoalMet();`

- [ ] **Step 7: Run** `npm test` → PASS (App a11y tests unaffected; no reader changed). Targeted: also `npx vitest run src/lib/streak.test.js`.

- [ ] **Step 8: Commit** `git add src/App.jsx && git commit -m "feat(streak): secured/record/milestone celebrations; retire %7 burst"`

---

### Task 4: Animate the `GoalRing`

**Files:** Modify `src/components/gamification/GoalRing.jsx`

- [ ] **Step 1:** Add a CSS transition to the progress circle so the fill animates, and scale the ✓ in on `met`. In `GoalRing.jsx`, on the second (colored) `<circle>`, add:

```jsx
        style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
```

and on the center glyph `<div>`, when `met`, add `animation: 'pop 0.3s ease-out'` (the `pop` keyframe already exists in App.jsx's global `<style>`):

```jsx
          ...(met ? { animation: 'pop 0.4s ease-out' } : {}),
```

- [ ] **Step 2:** Existing `GoalRing.test.jsx` still passes (renders both states). Run `npx vitest run src/components/gamification/GoalRing.test.jsx` → PASS.
- [ ] **Step 3: Commit** `git add src/components/gamification/GoalRing.jsx && git commit -m "feat(streak): animate the goal ring fill + met pop"`

---

### Task 5: In-play `<GoalStrip>` in the exercise area

A slim strip — `🔥{streak} · {todayXp}/{goal} XP` — shown above exercise tabs, filling as you answer.

**Files:** Create `src/components/gamification/GoalStrip.jsx`, `src/components/gamification/GoalStrip.test.jsx`; Modify `src/App.jsx` (render it)

- [ ] **Step 1: Failing test** `GoalStrip.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import GoalStrip from './GoalStrip';

describe('GoalStrip', () => {
  it('shows the streak and today XP toward the goal', () => {
    render(<GoalStrip streak={5} current={30} target={50} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('30 / 50 XP')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/components/gamification/GoalStrip.test.jsx` → FAIL.
- [ ] **Step 3: Implement `GoalStrip.jsx`:**

```jsx
import { Flame } from 'lucide-react';
import { COLORS, FONTS, FONT_SIZE, LETTER_SPACING, SPACE, RADIUS, BORDER } from '../../lib/theme';

// Slim in-play strip: current streak + today's XP filling toward the daily goal.
export default function GoalStrip({ streak, current, target }) {
  const pct = target > 0 ? Math.min(1, current / target) : 0;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE[3],
        padding: `${SPACE[2]}px ${SPACE[3]}px`,
        marginBottom: SPACE[5],
        background: COLORS.paperDeep,
        border: BORDER.standard,
        borderRadius: RADIUS.lg,
        fontFamily: FONTS.mono,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: COLORS.red, fontWeight: 700 }}>
        <Flame size={14} /> {streak}
      </span>
      <div style={{ flex: 1, height: 6, background: COLORS.card, borderRadius: RADIUS.pill, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct * 100}%`,
            background: pct >= 1 ? COLORS.green : COLORS.gold,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
      <span style={{ fontSize: FONT_SIZE.tag, letterSpacing: LETTER_SPACING.wide, color: COLORS.mute }}>
        {current} / {target} XP
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Wire into App.** Import `GoalStrip`; in `<main>`, render it above the active exercise tab (translate/vocab) using `game`:

```jsx
{(tab === 'translate' || tab === 'vocab') && (
  <GoalStrip streak={game.streak} current={game.goal.current} target={game.goal.target} />
)}
```

- [ ] **Step 6: Run** `npm test` → PASS.
- [ ] **Step 7: Commit** `git add src/components/gamification/GoalStrip.jsx src/components/gamification/GoalStrip.test.jsx src/App.jsx && git commit -m "feat(streak): in-play goal strip on exercise tabs"`

---

## Self-Review

- **Spec §7 coverage:** in-play goal strip ✅ (Task 5) · animated GoalRing ✅ (Task 4) · streak-secured/record/milestone moments ✅ (Tasks 2–3) · `STREAK_MILESTONES` replaces `%7` ✅ (Tasks 1, 3). Flame at-risk cue already shipped in Phase 1.
- **Deferred to Phase 4:** the `+XP ×mult🔥` FeedbackPanel flourish (needs the multiplier). Phase 3 = freeze.
- **Types:** `crossedMilestone(prev, next)`, `deriveGame().streak`, `GoalStrip({ streak, current, target })` used consistently.
