# Gamification Layer — Design

**Date:** 2026-06-08
**Status:** Approved direction, spec under review
**Goal:** Add XP, German-rank levels, a daily-goal ring, achievement badges, and synthesized sound + confetti — to make practice feel rewarding and pull the learner back daily — built almost entirely on top of the event log the app already keeps.

---

## 1. Core principle — derive, don't store

The app already records every graded answer in `state.daily`:

```
daily['YYYY-MM-DD'] = { total, byTab:{...}, byLevel:{ a1,a2,b1: {correct,almost,wrong} } }
```

So **XP, level, today's XP, and goal progress are all computed from `state.daily`** — never stored as counters. Benefits: zero migration, nothing to corrupt, and all past practice counts retroactively. A stored XP counter (the rejected alternative) would only count forward and could drift out of sync with the log.

Only three things genuinely need persistence (the user's *choices* and *celebration history*), namespaced under a new `state.gamification` object.

---

## 2. Storage — one new top-level key

```js
state.gamification = {
  goal: 50,            // chosen daily XP target (20 | 50 | 100); default 50
  soundOn: false,      // sound toggle; default off
  achievements: {},    // { <achievementId>: unlockedTimestampMs } — celebrated badges
  lastGoalMet: null,   // 'YYYY-MM-DD' of the last day the goal was celebrated (prevents re-firing)
}
```

`loadState()` callers must tolerate its absence (default the object). Existing keys (`stats`, `learnedWords`, `daily`, `items`, `srs`) are untouched.

---

## 3. Pure module: `src/lib/gamification.js` (fully unit-tested)

### Constants
```js
export const XP_PER_VERDICT = { correct: 10, almost: 6, wrong: 3 };
export const GOAL_PRESETS = { casual: 20, regular: 50, serious: 100 };
export const DEFAULT_GOAL = 50;
```

### XP
- `xpForDay(dayAggregate)` → sum over levels: `10·correct + 6·almost + 3·wrong`. Returns 0 for `undefined`.
- `totalXp(daily)` → Σ `xpForDay` over all day entries.
- `todayXp(daily, todayKey)` → `xpForDay(daily[todayKey])`.

### Levels — escalating curve + German ranks
Cumulative XP to **reach** level `L`: `threshold(L) = 25 · (L − 1) · L`
(L2=50, L3=150, L5=500, L10=2250, L20=9500; the L→L+1 cost is `50·L`, so it escalates).

- `levelFromXp(xp)` → `{ level, rankName, xpIntoLevel, xpToNext, progress }`
  - `level = max(1, floor((25 + sqrt(625 + 100·xp)) / 50))`
  - `xpIntoLevel = xp − threshold(level)`, `xpToNext = 50·level`, `progress = xpIntoLevel / xpToNext` (0–1)
- `RANKS` bands (by level): 1–2 **Anfänger**, 3–5 **Lernende**, 6–9 **Fortgeschritten**, 10–14 **Sehr gut**, 15–19 **Fließend**, 20+ **Muttersprachler**. `rankName(level)` looks up the band.

### Daily goal
- `goalProgress(todayXpValue, goal)` → `{ current, target, pct, met }` where `pct = min(1, current/target)`, `met = current ≥ target`.

### Achievements
```js
// ctx = { streak, totalExercises, masteredCount, decksMastered, level }
export const ACHIEVEMENTS = [ /* {id, category, name, icon, test(ctx)} */ ];
export function earnedAchievements(ctx) // → array of satisfied ids
```

| id | category | name | icon | rule |
|---|---|---|---|---|
| `streak3` | streak | Drei am Stück | 🔥 | streak ≥ 3 |
| `streak7` | streak | Wochenheld | 🔥 | streak ≥ 7 |
| `streak14` | streak | Zwei Wochen | 🔥 | streak ≥ 14 |
| `streak30` | streak | Monatsmeister | 👑 | streak ≥ 30 |
| `vol100` | volume | Erste Hundert | 💯 | totalExercises ≥ 100 |
| `vol500` | volume | Fünfhundert | 🏛️ | totalExercises ≥ 500 |
| `vol1000` | volume | Tausend | 🚀 | totalExercises ≥ 1000 |
| `words25` | volume | Wortschatz 25 | 📖 | masteredCount ≥ 25 |
| `words50` | volume | Wortschatz 50 | 📚 | masteredCount ≥ 50 |
| `deck1` | mastery | Deck-Meister | ✅ | decksMastered ≥ 1 |
| `allDecks` | mastery | Alle Decks | 🏆 | decksMastered ≥ 4 |

Context derivation (in App, from existing helpers/data):
- `streak` = `stats.streak`
- `totalExercises` = Σ `daily[*].total`
- `masteredCount` = `getMasteredCount(srs)` (from `srs.js`)
- `decksMastered` = count of `PRESET_DECKS` where all 10 cards are at `MASTERED_BOX` (Box 5)
- `level` = `levelFromXp(totalXp).level`

---

## 4. Sound: `src/lib/sound.js` (synthesized, no assets)

Web Audio API, lazily-created shared `AudioContext` (reused; created on first play, which always follows a user gesture so autoplay policy is satisfied).

```js
setSoundEnabled(bool)   // module flag, mirrors state.gamification.soundOn
playCorrect()           // short rising 'ding'
playLevelUp()           // 3-note ascending arpeggio
playAchievement()       // bright two-note chime
playGoalMet()           // warm confirming tone
```

Every play is a no-op when disabled or when `AudioContext` is unavailable (wrapped in try/catch). No files, no licensing, negligible bundle cost. **Confetti always fires regardless of the sound setting.**

---

## 5. Surfacing

### 5.1 Header (layout A) — `App.jsx` + `components/gamification/`
Right side becomes: **`LevelBadge`** · **STREAK chip** · **`GoalRing`**. The **LEARNED chip is removed from the header** (it reappears in the Stats Fortschritt section).

- `gamification/LevelBadge.jsx` — a circle showing the level number, wrapped by an SVG **XP ring** (green, `progress` 0–1 to next level). Tooltip/title shows the rank name. On an XP gain, a brief floating `+N` label (optional polish).
- `gamification/GoalRing.jsx` — an SVG ring (red) filling to `goalProgress.pct`, 🎯 in the center; turns green + gets a checkmark when `met`.

Mobile keeps all three compact (small circles + one chip), consistent with the existing responsive header.

### 5.2 Stats tab — new "Fortschritt" section (Section 0, above Today)
Composed in `StatsTab.jsx` from:
- `gamification/LevelCard.jsx` — big rank name + level, XP-to-next progress bar, total XP.
- `gamification/GoalPicker.jsx` — three chunky 3D-press buttons (Casual 20 / Regular 50 / Serious 100); selecting writes `gamification.goal` and dispatches the progress event.
- `gamification/BadgeGrid.jsx` — all `ACHIEVEMENTS` as tiles: earned = full color + unlock date; locked = greyed with the rule as hint.
- The **LEARNED** stat moves here as a small figure beside the level card.

### 5.3 Toasts — `components/ui/Toast.jsx` + a stack owned by `App`
`App` holds a `toasts` array; `ToastStack` renders them fixed near the top, each auto-dismissing after ~3.2s with a slide-in. Fired for:
- **Level-up** — “Level 7 — Fortgeschritten!” + confetti + `playLevelUp()`
- **Achievement unlock** — badge icon + name + confetti + `playAchievement()`
- **Goal met** — “Daily goal reached — 50 XP!” + confetti + `playGoalMet()`

---

## 6. Wiring — one decoupled event

`recordEvent(tab, level, verdict)` in `stats.js` is the single choke point every graded answer already flows through. After it saves, it dispatches:

```js
window.dispatchEvent(new CustomEvent('deutsch:progress'));
```

`App` subscribes once. It holds the previously-seen level in a `useRef` (`prevLevelRef`). On the event (and on mount/focus) it re-reads state and recomputes the derived gamification state, then:
1. Updates the header (`LevelBadge`/`GoalRing` reflect new XP live).
2. **Level-up:** if `level > prevLevelRef.current` → push level-up toast; set `prevLevelRef.current = level`.
3. **Achievements:** `earnedAchievements(ctx)` minus the keys already in `gamification.achievements` → for each new id, push a toast and persist `{ [id]: Date.now() }`.
4. **Goal met:** if `goalProgress.met` and `gamification.lastGoalMet !== todayKey` → push goal toast and set `lastGoalMet = todayKey`.

No prop-drilling through tabs; tabs are unchanged except they already call `recordEvent`.

### 6.1 First-run silent backfill (no toast avalanche)
Existing users already satisfy a streak, mastered words, a level, etc. On the **first computation of the session** (`prevLevelRef` unset) and especially on a **fresh `state.gamification`**:
- Initialize `prevLevelRef.current` to the current `level` (so the starting level is never toasted).
- Seed `gamification.achievements` with **all currently-earned ids** (timestamp = now) **without** pushing any toast — they're treated as already-acknowledged. Only ids earned *after* this seeding will toast.
- If the goal is already met for today on first load, set `lastGoalMet = todayKey` silently (no toast).

Net effect: a returning user sees their correct level/badges immediately and is only celebrated for *new* progress; a brand-new user starts at Level 1 with no badges and earns everything live.

---

## 7. Testing

- **`gamification.test.js`** — XP math (verdict weights, day/total/today), the level curve (boundaries at 0/49/50/500/2250, rank bands), `goalProgress` (under/at/over target), and **every achievement rule** (just-below / at threshold) + `earnedAchievements` set logic.
- **Component tests** — `LevelBadge` (renders level + ring progress), `GoalRing` (pct + met state), `Toast` (renders content, auto-dismiss via fake timers), `GoalPicker` (selecting calls back), `BadgeGrid` (earned vs locked rendering).
- Keeps the suite green and growing (currently 163); CI guards it.

---

## 8. Build sequence (for the plan)

1. `lib/gamification.js` + tests; `lib/sound.js`.
2. Storage: default `state.gamification`; `recordEvent` dispatches the progress event.
3. `components/gamification/` primitives: `LevelBadge`, `GoalRing` (+ tests).
4. Header (layout A) in `App.jsx`: add LevelBadge + GoalRing, remove LEARNED chip; derive gamification state; subscribe to `deutsch:progress`.
5. Toasts: `ui/Toast` + `ToastStack`; wire level-up / achievement / goal-met + sound.
6. Stats "Fortschritt" section: `LevelCard`, `GoalPicker`, `BadgeGrid` (+ tests); move LEARNED here.
7. Polish: `+N` XP flash, reduced-motion respect (confetti already guarded), final regression + screenshot pass.

Each step: lint + test + build + (UI steps) browser screenshot, its own commit. Additive/presentation — existing 163 tests stay green throughout.

---

## 9. Decisions locked (from brainstorm)
- XP: correct 10 / almost 6 / wrong 3 — every answer earns.
- Levels: escalating curve, German rank names.
- Header: **layout A** (level badge + streak + goal ring; LEARNED → Stats).
- Daily goal: user-picked XP preset (20/50/100), default 50, changeable in Stats.
- Achievements: Streak + Volume + Mastery categories (~11 badges).
- Sound: synthesized, **off by default**, toggle; confetti always.
