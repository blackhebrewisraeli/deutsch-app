# Practice gated by classified proficiency (Phase 2)

**Status:** implemented
**Date:** 2026-09-18
**Depends on:** [Phase 1 placement classification](./2026-09-18-placement-classification-design.md)

Phase 1 writes a CEFR code through `setUserLevel` / `deutsch-level`. Translate
already maps that code to one exercise kind via `LEVEL_MODES` (A1 tiles, A2
blanks, B1 free typing). Phase 2 makes classified proficiency the source of
truth for **which kinds of practice may run**, so a beginner cannot reach
independent sentence translation by picking a harder control.

Chat vocab constraints, interest packs, and multi-model AI stay later phases.

## Contract

### Source of truth

The stored CEFR code (`getUserLevel()` / `deutsch-level`) is the classified
level. Practice reads it; it does not offer a parallel difficulty picker.

Changing it for a learner is **Retake placement** (Settings and StatusChip,
already in Phase 1). Sync pulling a level from another device still writes
through `writeLevel` and is classification, not a local difficulty choice.

### Allowed modes

Helpers live in `src/lib/levelGate.js`. They are language-blind: they talk
about CEFR codes and pack-authored `auto.level` fields, not German.

| Classified | Translate UI (default = `LEVEL_MODES[level]`) | Engine-allowed set |
| ---------- | --------------------------------------------- | ------------------ |
| `a1`       | Word tiles only                               | `a1`               |
| `a2`       | Fill the blanks only                          | `a1`, `a2`         |
| `b1`       | Free typing                                   | `a1`, `a2`, `b1`   |

Translate stays **one mode, the classified level's `LEVEL_MODES` entry**. There
is no in-tab mode picker — adding one would reintroduce free difficulty choice
inside the allowed band, and the existing 1:1 mapping already matches the
product (beginners assemble, mid levels complete blanks, B1 types).

The **engine-allowed set is cumulative** so that:

- an A2/B1 learner may still open A1-labelled vocab decks
- a review item whose context is a *lower* band is not treated as forbidden
- a caller that requests a mode **above** classified is clamped down, never up

B1 free typing is B1+ only. `clampMode('b1', 'a1')` returns `'a1'`.

### Enforcement (engine, not only UI)

| Surface | Gate |
| ------- | ---- |
| `clampMode` / `isModeAllowed` | Single source for "may this mode run?" |
| `TranslateTab` | Renders `clampMode(level, getUserLevel())` — a `level="b1"` prop on an A1 learner still mounts tiles |
| `generateMoreSentences` | Clamps before asking the model for a bank |
| `PracticeLane` / `useLessons` | Fetches and records against the clamped level |
| `recordEvent` | Awards XP and writes `byLevel` for the clamped code, so a buggy caller cannot bank B1 XP for an A1 learner |
| `recordItem` | When `context` is a CEFR code, it is clamped the same way (translate review keys) |
| Vocab auto-decks | `isDeckAllowedForLevel` hides pack rows whose `auto.level` is above classified |
| Home `resolveRecommended` | Drops missions/fallbacks whose `level`, `mode`, or CEFR-tagged `deckId` is above classified |
| Stats review | Must **not** call `writeLevel` — reviewing a leftover B1 item must not reclassify |

Alphabet has no CEFR mode switch; Chat pedagogy still receives the classified
level (vocab *constraints* inside Chat are Phase 3).

VocabModeTabs themselves are Practice / Browse / Custom — they do not switch
CEFR. The CEFR difficulty escape on Vocab was the auto-deck cascade
(`cefr-b1`, `artikel-b1`, …), which this phase gates.

### XP

`LEVEL_MULTIPLIERS` (`a1: 1`, `a2: 1.25`, `b1: 1.5`) stay as a classified-level
bonus for account holders, compounding with the streak multiplier. They are no
longer a reason to *pick* a harder control:

- the Settings copy sits next to the classified name, not next to a picker
- `recordEvent` applies the multiplier to `clampMode(requested, classified)`

An A1 learner cannot earn the B1 1.5× by passing `'b1'` into `recordEvent`.
Streak and verdict XP (`XP_PER_VERDICT`) are unchanged — those are performance.

### Manual override

Settings still contains `LevelSwitcher`, but only inside a collapsed
**Advanced — override classification** disclosure. It writes through
`writeLevel` (same as placement and sync) so tests, signed-in sync debugging,
and a stuck learner can still set a code without retaking.

It is not on the StatusChip, not on Translate, and not in the first screen of
Settings. Opening it *is* changing classification; after that the gates follow
the new code. Learners are told to retake placement instead.

### Home recommendations

Pack fallbacks (`continue-quiz` → Translate, `review-vocab` → Vocab) name tabs,
not modes, so they inherit the classified level at the destination. Anything
that *does* name a mode, a CEFR code, or a CEFR-tagged deck is filtered.

## Out of scope

- Chat vocab constraints / interest packs / multi-model AI (phases 3–5)
- Placement scoring
- Supabase migrations / production MCP writes
- Renaming `deutsch-level` or `card.de`
- A pedagogy framework for unleveled decks (Core 100, Topics, custom)
