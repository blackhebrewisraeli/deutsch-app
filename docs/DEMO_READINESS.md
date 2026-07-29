# Demo Readiness — TODO

Assessment date: 2026-07-13 · against `main` @ `ca95851` · live: https://deutsch-app-dusky.vercel.app
Revised 2026-07-29: #3, #4, #6 closed (PRs #64, #65); #13 and #14 added from a live pass.

**Verified healthy:** build passes (1.8s), 686/686 tests green, lint 0 errors, live demo
returns 200 and already serves the regenerated 4,418-word lexicon, PWA precache 591 KiB.

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
  - The header cluster measured 389px. The goal ring is dropped below 640px; it duplicates
    the goal strip under the nav.

  All five tabs now measure `scrollWidth === clientWidth` at 375px and the page cannot scroll
  horizontally. **Still open:** at 320px (original iPhone SE) the header is 25px over, and on
  the Chat/Alphabet/Stats tabs mobile users no longer see any daily-goal indicator, since
  `GoalStrip` only renders on Vocab and Translate.

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

- [ ] **14. Flashcard answers are raw Wiktionary glosses.** Some are long or meta-linguistic, and
  `VocabTab` renders them verbatim — as multiple-choice options and as the revealed answer.
  Seen on the live demo: an option reading "ARCHAIC FORM OF STANDEN, FIRST/THIRD-PERSON PLURAL
  PRETERITE OF STEHEN", and the correct answer for *in* being "[WITH DATIVE] IN, INSIDE, WITHIN,
  AT (INSIDE A BUILDING)". A learner cannot meaningfully choose between options like these, and
  they make the demo look unfinished.
  **Fix:** needs its own design pass. Gloss cleanup belongs in the import pipeline
  (`scripts/import-lexicon/parseWiktextract.js` — strip bracketed grammar labels, drop
  `form of` glosses, truncate to the first sense) and requires an import re-run. Deliberately
  not attempted as part of #13.

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

Closed: #1, #2 (PR #62) · #3, #4 (PR #64) · #6 (PR #65) · #13, #15 (this branch).
#5 is closed as won't-fix.

Remaining, in order:

1. **P1 #14** — raw glosses are the most visible content problem left; needs a design pass and
   an import re-run.
2. **P3 #9–#12** — verification pass immediately before announcing.

#7, #8 are nice-to-have.
