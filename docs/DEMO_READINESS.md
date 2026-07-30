# Demo Readiness — TODO

Assessment date: 2026-07-13 · against `main` @ `ca95851` · live: https://deutsch-app-dusky.vercel.app
Revised 2026-07-29: #3, #4, #6 closed (PRs #64, #65); #13 and #14 added from a live pass.

**Verified healthy:** build passes (1.8s), 686/686 tests green, lint 0 errors, live demo
returns 200 and already serves the regenerated 4,480-word lexicon, PWA precache 591 KiB.

---

## P0 — Demo blockers (visible breakage today)

- [x] **1. Seven of eight Topic decks are empty.** — FIXED in #62 (rebuilt from real tags; all 8 decks now 46-291 cards, guarded by autoDecks.population.test.js) `src/packs/de/autoDecks.js` filters on
  guessed tags (`travel`, `home`, `people`, `work`, `body`, `nature`, `time`) that do not
  exist in the imported data. Only `food` matches (16 entries). A visitor clicking six of
  the eight Topic chips gets an empty deck.
  **Actual top tags:** `lifestyle` 234, `sciences` 201, `natural-sciences` 163, `hobbies` 156,
  `sports` 129, `physical-sciences` 128, `government` 126, `politics` 111, `mathematics` 100,
  `engineering` 98, `business` 78, `law` 59.
  **Fix:** rebuild the allow-list from real tag counts; drop or merge sparse ones; add a
  data-driven test asserting every shipped auto-deck resolves to ≥N cards so this cannot
  regress silently.

- [x] **2. Frequency decks under-deliver on their names.** — FIXED in #62 (new `top` rule; Core 100 now yields exactly 100) "Core 100" resolves to **8 cards**,
  "Top 500" to **114**. The top frequency ranks are function words (articles, pronouns,
  conjunctions) that the import filters drop (no article / form-of / no example), so few
  survive in the low-rank band.
  **Fix:** band by percentile over *kept* entries rather than raw Leipzig rank, or rename
  the decks to describe what they actually contain.

- [x] **13. Vocab progress dots blew out page width on lexicon decks.** — FIXED in this branch
  (`src/components/ui/DeckProgress.jsx`) `VocabTab` rendered one 26px dot per card
  unconditionally, inside a `justify-content: space-between` row where it was the only
  unbounded child. It was sized for 10-card decks; with the 4,424-word lexicon, Core 100 pushed
  page `scrollWidth` to 3,551px (2.8x the 1,274px viewport) and B1 to 69,023px (54x) while
  mounting 2,212 needless DOM nodes.
  **Fix:** extract `DeckProgress` — keep the dot strip at ≤12 cards, switch above that to a
  fixed-width bar plus an `N / M LEARNED` count. Bounded DOM (5 nodes) and bounded width at any
  deck size; verified `scrollWidth === clientWidth` on B1 at 1274px, and at mobile width the
  progress row's `scrollWidth === clientWidth` with the dot strip shrinking to fit.

- [x] **15. The app scrolled sideways on a phone.** — FIXED in this branch (`VocabTab`,
  `ChatTab`, `AlphabetTab`, `UI.Hero`, `App` header) Measured at a real 375px viewport, four
  separate causes, all pre-existing and independent of #13:
  - Chat's deck/panel grid used a bare `1fr` track, which keeps `min-width: auto` and so
    refuses to shrink below its content — **190px** past the viewport. Same pattern in
    `VocabTab` (40px) and latent in `AlphabetTab`. All now `minmax(0, 1fr)`.
  - The flashcard face paired 48px padding with a 64px display word, giving it a 408px
    min-content ("bestimmen" alone is 312px). Padding and font step down on mobile and the
    word may now break.
  - `Hero`'s title was a flat 72px; "Wortschatz" renders 370px wide. Now `min(72px, 13vw)` —
    identical on desktop, scales only when narrow.
  - The header cluster measured 389px. The goal ring is dropped below 640px, and `GoalStrip`
    now renders on every tab at mobile so the daily-goal signal moves rather than disappears
    (it was previously scoped to Vocab and Translate, which would have left Chat, Alphabet and
    Stats with no indicator at all). Desktop is untouched: ring in the header everywhere,
    strip on the two practice tabs.

  All five tabs now measure `scrollWidth === clientWidth` at 375px and the page cannot scroll
  horizontally.

- [x] **16. The header still overflowed a 320px screen.** — FIXED (`App`, `UI.StatBlock`) After
  #15 the cluster was 25px over at 320px (original iPhone SE). Nothing there was expendable —
  the streak block carries the "streak at risk" pulse that `GoalStrip` has no equivalent for —
  so instead: the `STREAK` caption is dropped at mobile (the block goes 111px → 81px, keeping
  flame, count and pulse), the wordmark scales with the viewport (`min(26px, 6.5vw)`: 36px
  desktop, 24.4px at 375, 20.8px at 320), and the header chrome tightens (padding 16px → 10px,
  cluster gap 10px → 6px). Verified at 320px: 0 overflow with 9px slack, and still 0 with a
  probed worst case of a 3-digit streak plus a 2-digit level. Desktop is untouched — 36px
  wordmark, `20px 32px` padding, caption and ring both present.

  One dead end worth recording: `minWidth: 0` on the wordmark block also reported 0 overflow,
  but only because the `nowrap` text then spilled *over* the level badge. The metric said
  fixed while the screenshot showed a rendering bug — measure the pixels, not just the numbers.

- [x] **17. Everything above was verified on an empty account.** — FIXED (`App`, `useWindowWidth`,
  `LevelCard`, `GoalPicker`, `StatsTab`, `VocabTab`, `AlphabetTab`, `ReviewFeed`,
  `TodaySnapshot`, `VocabSrsWidget`, `WelcomeBanner`) #16 was checked by overwriting rendered
  values in the DOM, which missed elements that only exist for a real user. Seeding 365
  qualifying days (`daily[date] = { byLevel: { a1: { correct: 6 } } }` — note `xpForDay`
  returns 0 without `byLevel`) produced level 30, streak 365 **and a freeze chip that a fresh
  account never renders**, and with it:
  - the header ran **34px** past 320px, not 0. Fixed by dropping the wordmark below a new
    `bp.tiny` (360px): every remaining widget is the only surface for its signal — the freeze
    count appears nowhere else in the app — so decoration gives way. 64px slack now, enough for
    a 4-digit streak.
  - the **Stats tab overflowed at 375px too** (23px) and at 320px (78px), from `LevelCard`'s
    `auto 1fr auto` refusing to shrink below a level-30 rank name, then the goal picker's
    `1fr 1fr 1fr`.

  Every `gridTemplateColumns` in the codebase now uses `minmax(0, …)`; a bare `1fr` had caused
  this in four separate places (vocab grid, chat grid, `LevelCard`, `GoalPicker`). Verified
  with the seeded year-long account: all five tabs `scrollWidth === clientWidth` at 320px and
  375px, page cannot scroll horizontally, desktop unchanged.

---

## P1 — Content quality

- [x] **3. German-only examples are discarded.** — FIXED in #64 (`examples[].en` nullable across
  all three gates; import re-run) `validate.js` + `cleanExamples` +
  `pickExamples` require every example to have both `de` and `en`, but **4,545** German lemma
  entries in Wiktextract carry examples with no English translation, so they are thrown away —
  a likely large share of the **537** words dropped for "no example" in the last import.
  `VocabTab` renders only `examples[0].de`, so the English is never displayed anyway.
  **Fix:** make `examples[].en` nullable across the three gates; re-run the import.
  *(Designed and measured; ready to implement.)*

- [x] **4. CEFR bands are lopsided.** — FIXED in #64 (position-based bands over kept entries;
  now A1 885 · A2 1,327 · B1 2,212) A1 284 · A2 567 · **B1 3,567** (81% of the lexicon).
  CEFR is derived from raw frequency rank, but kept entries skew to higher ranks, so the B1
  deck is enormous and A1 is thin.
  **Fix:** derive bands from percentiles over kept entries.

- [ ] **5. Tatoeba lemma stemming — measured, recommend WON'T FIX.** Exact-token matching
  already covers 4,770/5,000 lemmas (95.4%); light stemming rescues only **47** (0.9%) while
  adding a stemmer and false-match risk. Documented here so it stops resurfacing as an idea.

- [x] **14. Flashcard answers are raw Wiktionary glosses.** — FIXED in this branch
  (`scripts/import-lexicon/cleanGloss.js`) Three causes, not one: glosses carried grammar
  labels and a trailing parenthetical (21% of first glosses ran over 40 chars); records tagged
  `alt-of` shipped as their own flashcards, so *Raum* appeared twice — once as "space", once as
  "alternative form of Rahm"; and the pipeline filtered `form-of` senses but not `alt-of`.
  **Fix:** a pure `cleanGloss()` applied at import (strip leading `[label]`, cut at the first
  parenthetical, cap to 3 synonyms, fall back to raw when that empties), plus rejecting
  `alt-of` senses alongside `form-of`. Entry ids are derived from the raw gloss, so cleaning the display text does not rewrite ids — ids key saved learner progress (learnedWords, and srsKey in src/lib/srs.js), and an earlier run rewrote 187 of them before this was caught. First-gloss p90 length 61 → 30; glosses over 40 chars 929 → 177. Two meta-linguistic first glosses survive (adv:nach, n:gattin); recorded rather than patched, because matching English text would also delete common words whose good record exists alongside the junk one. Rejected during design: preferring a shorter later gloss, which *degrades* quality
  because Wiktionary orders senses by primacy (*Ergebnis* would go from "result, outcome,
  conclusion" to "earnings, profit").

---

## P2 — Credibility polish

- [x] **6. README is stale.** — FIXED in #65 (counts refreshed; lexicon surfaced in the feature
  list) Badge claims `Vitest 455 passing`; actual is **686**. The
  rich-lexicon feature set (4.4k words, conjugations, frequency/CEFR/topic decks, one-command
  reproducible import) is not represented in the feature list — for a demo, the README is the
  front door.

- [ ] **7. Bundle is one 577 KB chunk** (171 KB gzip), over Vite's 500 KB warning. Acceptable
  but not great for a first-load demo. **Fix:** route/tab-level `dynamic import()` or
  `manualChunks`.

- [ ] **8. Nine lint warnings** (unused `describe` imports in test files). Zero errors.

- [ ] **18. The same German word can appear on several cards.** 333 surface forms resolve to
  more than one entry, adding 370 extra cards. Some are junk and were removed with the `alt-of`
  fix (#14), but the rest are legitimate homographs across parts of speech — `in` as preposition
  ("in, inside, within, at") and as adjective ("in, popular"), `Tag` as "day" and as "tag
  (label)", `aber` as conjunction and adverb. A deck can therefore show the same German word
  twice with different correct answers, and in multiple choice two options can both be
  defensible. **Fix:** needs a product decision — merge homographs into one card with combined
  glosses, prefer the highest-frequency part of speech, or leave as-is and accept it.

---

## P3 — Ops & verification before announcing

- [ ] **9. Confirm production feature flags** are in the intended demo state:
  `VITE_LEAGUES_ENABLED`, `VITE_SYNC_ENABLED`, `VITE_SENTRY_DSN`. Decide whether a public
  demo should expose leagues/accounts at all.

- [ ] **10. Local `.env` lacks the client flags** (`VITE_LEAGUES_ENABLED`, `VITE_SYNC_ENABLED`,
  `VITE_SENTRY_DSN`), so local dev never exercises leagues, sync, or error reporting. Add them
  (even as `false`) so local matches deployed behaviour.

- [ ] **11. Manual smoke pass on the live demo** — desktop + mobile: splash → level pick →
  each of the five tabs → generate a custom deck → open a Topic and a CEFR deck → reload
  offline (PWA) → install prompt.

- [ ] **12. Anonymous-first check:** confirm a brand-new visitor with no account can reach and
  use every demo-relevant surface without hitting an auth wall.

---

## Suggested order

Closed: #1, #2 (PR #62) · #3, #4 (PR #64) · #6 (PR #65) · #13, #15 (PR #66) · #16, #17.
#5 is closed as won't-fix.

Remaining, in order:

1. **P1 #14** — raw glosses are the most visible content problem left; needs a design pass and
   an import re-run.
2. **P3 #9–#12** — verification pass immediately before announcing.

#7, #8 are nice-to-have.
