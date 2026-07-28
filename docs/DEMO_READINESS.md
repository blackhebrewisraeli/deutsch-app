# Demo Readiness — TODO

Assessment date: 2026-07-13 · against `main` @ `ca95851` · live: https://deutsch-app-dusky.vercel.app

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

---

## P1 — Content quality

- [ ] **3. German-only examples are discarded.** `validate.js` + `cleanExamples` +
  `pickExamples` require every example to have both `de` and `en`, but **4,545** German lemma
  entries in Wiktextract carry examples with no English translation, so they are thrown away —
  a likely large share of the **537** words dropped for "no example" in the last import.
  `VocabTab` renders only `examples[0].de`, so the English is never displayed anyway.
  **Fix:** make `examples[].en` nullable across the three gates; re-run the import.
  *(Designed and measured; ready to implement.)*

- [ ] **4. CEFR bands are lopsided.** A1 284 · A2 567 · **B1 3,567** (81% of the lexicon).
  CEFR is derived from raw frequency rank, but kept entries skew to higher ranks, so the B1
  deck is enormous and A1 is thin.
  **Fix:** derive bands from percentiles over kept entries.

- [ ] **5. Tatoeba lemma stemming — measured, recommend WON'T FIX.** Exact-token matching
  already covers 4,770/5,000 lemmas (95.4%); light stemming rescues only **47** (0.9%) while
  adding a stemmer and false-match risk. Documented here so it stops resurfacing as an idea.

---

## P2 — Credibility polish

- [ ] **6. README is stale.** Badge claims `Vitest 455 passing`; actual is **686**. The
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

1. **P0 #1 and #2** — these are visibly broken to anyone clicking around; fix before any demo.
2. **P1 #3 and #4** — one import re-run can land both (bands + examples together).
3. **P2 #6** — README, since it is the first thing a visitor reads.
4. **P3 #9–#12** — verification pass immediately before announcing.

#7, #8 are nice-to-have. #5 is closed as won't-fix.
