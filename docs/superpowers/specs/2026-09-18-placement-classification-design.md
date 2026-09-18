# Placement classification (Phase 1 MVP)

**Status:** implemented
**Date:** 2026-09-18

Short offline CEFR placement that sets the learner's practice level. Later
phases gate chat vocab and other surfaces off this level — they are out of
scope here. The level already drives Translate via `LEVEL_MODES` (A1 tiles,
A2 blanks, B1 free typing).

## Contract

### When it runs

- **First-time:** `!hasStoredLevel()` after the WelcomeGate (or immediately
  when auth is unconfigured), including a newly signed-in account with no
  CEFR code yet. There is no free A1/A2/B1 picker on entry.
- **Retake:** Settings → "Retake placement", or the StatusChip sheet in the
  header. A live practice session asks before the overlay opens.
- **After 3 completed decks:** a one-shot Home invite. See
  `2026-09-18-placement-access-paths-design.md`.

A stored but corrupt `deutsch-level` is treated as unset and shows placement.

### Items

Nine items, three per band, sliced from the active pack's
`content.translateSentences` banks — the same A1 tiles, A2 blanks, and B1
sentences Translate already uses. B1 cannot be AI-graded offline, so those
three items are multiple-choice over the pack's `de` strings.

The set is deterministic (front of each bank). Tile/option order is shuffled
at render time.

### Scoring

Each item is 1 or 0. A band **passes** at 2/3 correct.

| A1 pass | A2 pass | B1 pass | Result |
| ------- | ------- | ------- | ------ |
| no      | *       | *       | `a1`   |
| yes     | no      | *       | `a1`   |
| yes     | yes     | no      | `a2`   |
| yes     | yes     | yes     | `b1`   |

Someone who cannot assemble A1 tiles is not placed at A2 because they guessed
a blank. Classification lives in `src/lib/placement.js` (`classifyBands`,
`scorePlacement`). The test does **not** award XP or write SRS.

### Persistence

- The CEFR code is written with `setUserLevel` / `writeLevel`. That keeps
  `deutsch-level`, `LEVEL_CHANGE_EVENT`, and `levelUpdatedAt` (settings LWW)
  working for signed-in sync. **The storage key is not renamed.**
- Metadata is additive on the existing `deutsch-app-state-v1` blob:

  ```js
  placement: {
    takenAt,       // ms
    source: 'placement',
    level,         // 'a1' | 'a2' | 'b1'
    correct, total,
    bands: { a1, a2, b1 }, // per-band correct counts
  }
  ```

  It travels through `settingsToRow` / `settingsFromRow` and follows the
  **level clock** in `mergeSettings`, not whole-row `settingsUpdatedAt`.

### Remaining manual override

Phase 2 demotes this: Settings keeps `LevelSwitcher` only behind **Advanced —
override classification**. StatusChip and Translate have no free switcher —
retake is the learner path. See
`2026-09-18-practice-level-gating-design.md`.

## Out of scope (later phases)

- Gating Chat / vocab / interest packs off the classified level
- AI-backed B1 free-typing items in the test itself
- Supabase schema changes
- Renaming `card.de` or `deutsch-level`
