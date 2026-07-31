# Demo Readiness — TODO

Assessment date: 2026-07-13 · against `main` @ `ca95851` · live: https://deutsch-app-dusky.vercel.app
Revised 2026-07-29: #3, #4, #6 closed (PRs #64, #65); #13 and #14 added from a live pass.
Revised 2026-08-01: #18 fixed and #9 decided (PR #75); **#19 added and fixed** (PR #76) — found
by verifying the deployment rather than the artifact.

**Verified healthy** (2026-08-01, `main` @ `361fe20`): 802/802 tests green, lint and
`format:check` clean, live demo serves the 4,201-word lexicon with zero duplicate cards, PWA
installs and reloads offline.

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

- [x] **19. Lexicon fixes never reached returning visitors.** — FIXED 2026-08-01 in PR #76
  (`vite.config.js`, `src/packs/lexiconStore.js`) The homograph merge (#18) deployed correctly
  and reached **new visitors only**. Anyone who had opened the demo before that deploy kept the
  pre-merge 4,480-entry lexicon — duplicate cards included — for up to 30 days.

  `runtimeCaching` served `/lexicon/*.json` with `handler: 'CacheFirst'`. Three things combined:
  `CacheFirst` never consults the network once an entry exists; the URLs are unhashed
  (`/lexicon/chunk-00.json`), so a re-import writes new bytes to the same path and the cache key
  never changes; and `registerType: 'autoUpdate'` refreshes only the *precache* — runtime caches
  are not in the precache manifest and are never purged on activation. Nothing evicted
  `lexicon-json` until the 30-day expiry.

  **Fix:** `StaleWhileRevalidate` for lexicon JSON. The cache still answers instantly and still
  answers with no network, so offline is unchanged, but every online load revalidates in the
  background and the next load is current. Also guarded `resolveAutoDeck` against index/chunk
  skew: the index is fetched every load but a chunk only when a deck touches it, so a refreshed
  index can pair with a stale chunk — and chunk packing is positional, so *any* import that
  changes the entry count reshuffles ids. `resolveCard` dereferences its argument immediately,
  so one unresolvable row threw away the whole deck (`TypeError`, reproduced in tests before the
  fix). Unresolvable rows are now skipped with one warning per call.

  **Verified on a deployment, not in CI.** Seeding a returning visitor's cached chunk with a
  sentinel and reloading rendered the sentinel under `CacheFirst` on every reload; under
  `StaleWhileRevalidate` the cache entry was rewritten during that same load and the next load
  was correct. Production `sw.js` now contains `StaleWhileRevalidate` and zero `CacheFirst`.
  Offline re-verified with the network genuinely down (CDP `Offline`, control fetch failing):
  full reload, Vocab tab and Core 100 deck all render from cache.

  **Cost:** a returning visitor takes two to three loads to converge — the first still runs the
  old worker, which then hands over. That is inherent to replacing a service worker, and it
  self-heals without clearing site data, which the old behaviour never did.

  **The lesson worth keeping:** every gate was green and the origin served perfect bytes. The
  bug lived entirely between the CDN and the user. Verify the deployment, not the artifact.

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

- [x] **5. Tatoeba lemma stemming.** — WON'T FIX (decided 2026-07-29, measured) Exact-token matching
  already covers 4,770/5,000 lemmas (95.4%); light stemming rescues only **47** (0.9%) while
  adding a stemmer and false-match risk. Documented here so it stops resurfacing as an idea.

- [x] **14. Flashcard answers are raw Wiktionary glosses.** — FIXED in this branch
  (`scripts/import-lexicon/cleanGloss.js`) Three causes, not one: glosses carried grammar
  labels and a trailing parenthetical (21% of first glosses ran over 40 chars); records tagged
  `alt-of` shipped as their own flashcards, so *Raum* appeared twice — once as "space", once as
  "alternative form of Rahm"; and the pipeline filtered `form-of` senses but not `alt-of`.
  **Fix:** a pure `cleanGloss()` applied at import (strip leading `[label]`, cut at the first
  parenthetical, cap to 3 synonyms, fall back to raw when that empties), plus rejecting
  `alt-of` senses alongside `form-of`. Entry ids are derived from the raw gloss, so cleaning the display text does not rewrite ids — ids key saved learner progress (learnedWords, and srsKey in src/lib/srs.js), and an earlier run rewrote 187 of them before this was caught. First-gloss p90 length 61 → 32; glosses over 40 chars 929 → 230 (21.0% → 5.1%). The cut applies only to a TRAILING parenthetical: an embedded one is unwrapped, because cutting there left answers like "to" for holen and "indicating" for ein. Under the narrow `form of|inflection of|preterite` pattern, two meta-linguistic first glosses survive (adv:nach, n:gattin); recorded rather than patched, because matching English text would also delete common words whose good record exists alongside the junk one. Other meta-linguistic phrasings the pattern doesn't catch (e.g. "abbreviation of", "clipping of" — n:juli, n:wiener) also occur and pre-date this branch. Rejected during design: preferring a shorter later gloss, which *degrades* quality
  because Wiktionary orders senses by primacy (*Ergebnis* would go from "result, outcome,
  conclusion" to "earnings, profit").

---

## P2 — Credibility polish

- [x] **6. README is stale.** — FIXED in #65 (counts refreshed; lexicon surfaced in the feature
  list) Badge claims `Vitest 455 passing`; actual is **686**. The
  rich-lexicon feature set (4.4k words, conjugations, frequency/CEFR/topic decks, one-command
  reproducible import) is not represented in the feature list — for a demo, the README is the
  front door.

- [x] **7. Bundle is one 580 KB chunk** (172 KB gzip), over Vite's 500 KB warning. — ACCEPTED,
  not fixed. Acceptable but not great for a first-load demo; closed as a deliberate trade rather
  than work done, so the bundle is still a single chunk and Vite still warns on every build.
  Re-measured 2026-08-01 at `579.84 kB / 172.11 kB gzip` (was 577/171 when first filed).
  **If revisited:** route/tab-level `dynamic import()` or `manualChunks`.

- [x] **8. Nine lint warnings.** — FIXED `npm run lint` is now silent. They were not all unused
  `describe` imports as recorded: five were unused vitest imports (`describe`, `beforeEach`,
  `afterEach`), and four were dead code in the league API mocks — `memberCallCount` and
  `memberSelectCallCount` were incremented but never read, `membershipSelect` was built and
  never wired in (its body was duplicated inline), and a `...args` rest parameter was unused.
  The two counters were the only ones worth a second look: a counter that is incremented and
  never asserted can mean a dropped assertion. Neither was ever read anywhere in its file, so
  both were removed rather than given an invented assertion. `membershipSelect` is now used as
  the chain's `select`, which removes the duplication too.

- [x] **18. The same German word can appear on several cards.** — FIXED 2026-08-01 After the
  `alt-of` fix (#14) the remainder were legitimate homographs across parts of speech — `in` as
  preposition ("in, inside, within") and as adjective ("in, popular"), `Tag` as "day" and as
  "tag (label)", `aber` as conjunction and adverb: 258 groups, 279 extra cards. A deck could
  therefore show the same German word twice with different correct answers, and in multiple
  choice two options could both be defensible.
  Merged at import time by `scripts/import-lexicon/mergeHomographs.js`, which groups entries by
  the German the learner actually sees (`article ? article + ' ' + de : de`) and keeps one card
  per rendered form, answering with the first synonym of each sense joined by `" · "`, capped at
  two. 4,480 → 4,201 entries. The 52 gender-distinguished lemmas (`der Tor` fool / `das Tor`
  gate) are excluded structurally — the article is part of the key — so there is no exclusion
  list to maintain. The merge runs after `disambiguateIds`, so every surviving card keeps its
  id: **0 new ids** against the pre-merge baseline, and the 3,943 cards outside a merged group
  are byte-identical apart from CEFR. 41 cards shift CEFR band, because `assignCefrBands` is
  positional and now runs over 4,201 entries rather than 4,480.
  **Cost:** 279 ids retire. Progress on each surviving card is preserved; a learner who had
  learned a *secondary* sense's card loses that flag and its SRS scheduling. That is inherent to
  merging, not a defect.

---

## P3 — Ops & verification before announcing

- [x] **9. Confirm production feature flags.** — VERIFIED 2026-07-31, decision closed 2026-08-01.
  All three are set in Vercel Production and confirmed *active on the live site*, not merely
  configured: leagues (`LEAGUES` sub-tab renders in Stats), sync/auth (`Create account` /
  `Sign in` offered), Sentry (`window.__SENTRY__` present, SDK 10.59.0). Checked behaviourally
  rather than by reading env values, because `VITE_*` vars are inlined at build time — the
  configured value can drift from what the last build shipped.
  **DECIDED 2026-08-01 (owner):** the public demo keeps both leagues and accounts exposed.
  `VITE_LEAGUES_ENABLED` and `VITE_SYNC_ENABLED` stay `true` in Production — no change to ship.
  Worth watching: leagues render against a live cohort that a quiet demo can leave sparse, and
  sign-up collects real addresses through Resend.

- [x] **10. Local `.env` lacks the client flags.** — FIXED Added `VITE_LEAGUES_ENABLED=false`,
  `VITE_SYNC_ENABLED=false` and an empty `VITE_SENTRY_DSN` to the local `.env`, and documented
  all three in the tracked `.env.example`, which previously did not mention the two feature
  flags at all. Sentry stays empty locally on purpose: a DSN only permits *sending*, so local
  noise would pollute the production issue stream.

- [x] **11. Manual smoke pass on the live demo.** — DONE 2026-07-31 against
  https://deutsch-app-dusky.vercel.app, as a guest with storage, service worker and caches
  cleared first (an earlier run silently reused a primed profile and skipped the splash — the
  result looked like a finding and was not).
  - Desktop 1274px: splash → level pick → all five tabs render, 0 crashes.
  - Topic deck (Sports, 122 cards) and CEFR deck (B1, 2240 cards) both load with the bounded
    progress bar.
  - Custom deck generation: 10 cards in 4s via the AI lane.
  - Mobile 375px: all five tabs, 0px overflow each, page cannot scroll sideways, goal strip
    present on every tab.
  - 0 console errors across the whole pass.
  - PWA: service worker active at root scope; precache holds the shell (`index.html` 731 B,
    bundle 594 KB) plus a `lexicon-json` cache (10 entries); manifest is `standalone` with
    192/512 icons including maskable — installability criteria met.
  **Confirmed on a real device 2026-07-31:** offline reload works, and the install prompt
  appears. These two were the gap the automation could not close — neither a true offline
  reload nor the engagement-gated install banner is reachable from the harness, so the
  precache contents were only evidence that offline *should* work. Now verified directly.

- [x] **12. Anonymous-first check.** — PASSED A brand-new visitor (cleared profile) is offered
  `Continue without an account →` alongside sign-up, and reaches every demo surface with no
  auth wall: all five tabs, both auto-deck families, and AI deck generation all work
  unauthenticated.

---

## Suggested order

Closed: #1, #2 (PR #62) · #3, #4 (PR #64) · #6 (PR #65) · #13, #15 (PR #66) · #16, #17 ·
#18, #9 (PR #75) · #19 (PR #76). #5 is closed as won't-fix; #7 is annotated acceptable.

**Nothing is outstanding.** The last three to close:

1. **P3 #9** — DECIDED 2026-08-01: the public demo keeps leagues and accounts exposed; no flag
   change ships.
2. **P2 #18** — FIXED 2026-08-01: homographs are merged at import time, 4,480 → 4,201 entries,
   no surviving card's id changed.
3. **P0 #19** — FIXED 2026-08-01: the #18 fix was reaching new visitors only. Lexicon JSON is
   now revalidated instead of served cache-first.

#19 is the one to remember. It was found only by checking the live site *after* shipping, and
neither the test suite nor the CDN could have caught it — the origin was correct the whole time.
Any future change to `public/lexicon/` should be confirmed on the deployed site, from a browser
profile that has visited before, not just from a clean one.

#5 is won't-fix (measured). #7 is annotated acceptable. #8 is closed.
