# Placement access paths

**Status:** implemented
**Date:** 2026-09-18
**Depends on:** [Phase 1 placement classification](./2026-09-18-placement-classification-design.md)

Three ways a learner reaches the CEFR placement test. Scoring, item banks, and
XP (none) stay in Phase 1. This spec only names **when the overlay may open**.

## Contract

### Path 1 — first registration / first-time device

`PlacementTest` is the only way a new profile gets a CEFR code. There is no
free A1/A2/B1 picker on entry.

It runs when `!hasStoredLevel()` after WelcomeGate (guest continue) **and**
when a signed-in session has no valid stored CEFR code yet — a newly created
account on a fresh device must not skip into the shell on a silent A1 default.
`readLevel()` still falls back to `a1` for readers, but it does not write the
key, and `hasStoredLevel()` stays false until placement (or the Advanced
override) writes a real code.

A stored but corrupt `deutsch-level` is treated as unset, same as Phase 1.

First-time placement is not cancellable (`allowCancel={hasStoredLevel()}`).

### Path 2 — Settings / StatusChip retake

Returning learners retake from Settings → Lernen → **Retake placement**, or
from the StatusChip sheet. A live practice session still asks before the
overlay opens. The Advanced manual override stays behind
`Advanced — override classification`. This path does not depend on deck count.

### Path 3 — after 3 completed decks

A one-shot, dismissible Home banner invites a retake when the learner first
crosses **3 completed curated decks**. It is not a hard block.

**Completed** means the existing `deckProgressFor` row for that deck has
`total > 0` and `done >= total` — every card is learned. That is the same
finished-deck arithmetic missions already use (`deck-unfinished` ignores a
finished deck) and the same count Vocab's `DeckCompleteBanner` celebrates.
It is **not** SRS Box-5 `decksMastered`.

The count is over the pack's preset decks — the object App already hands to
`deckProgressFor` (`PRESET_DECKS`). Custom and interest decks are not in that
list and do not count. Distinct deck ids, not sessions.

Threshold = **3**. Crossing it once surfaces the offer. Completing a fourth
deck does not re-nag.

### Offer persistence

Additive field on the existing `deutsch-app-state-v1` blob (no new
localStorage key, no rename):

```js
placementOffer: {
  milestone: 3,
  shownAt,      // ms — Home actually showed the banner
  dismissedAt,  // ms — Not now, or Retake from the banner
}
```

- `shownAt` is written the first time the banner is visible on Home, so a
  reload does not spam the same invite. If the learner never visits Home after
  crossing 3, `shownAt` stays unset and the next session may still offer.
- `dismissedAt` is written on **Not now** and on **Retake** from the banner.
  Settings / StatusChip remain available regardless.
- The field is allowlisted on the settings jsonb (same pattern as
  `enabledInterests`) and follows whole-row LWW. No schema migration.

### Out of scope

Placement scoring, item banks, Chat UX, interest packs, model picker,
Supabase migrations, storage key renames, XP from the test (already none).
