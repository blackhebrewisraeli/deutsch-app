# Demo Readiness — TODO

Assessment date: 2026-07-13 · against `main` @ `ca95851` · live: https://deutsch-app-dusky.vercel.app
Revised 2026-07-29: #3, #4, #6 closed (PRs #64, #65); #13 and #14 added from a live pass.
Revised 2026-08-01: #18 fixed and #9 decided (PR #75); **#19 added and fixed** (PR #76) — found
by verifying the deployment rather than the artifact.
Revised 2026-08-07: **#7 closed as genuinely fixed** (PR #91), having been accepted-not-fixed
since it was filed. Light/dark theming with per-pack accents landed in between (#83–#85, #90).

**Verified healthy** (2026-08-07, `main` @ `5d9400a`): 1040/1040 tests green, lint and
`format:check` clean, live demo serves the 4,201-word lexicon with zero duplicate cards, PWA
installs and reloads offline, critical-path bundle 296 KB (92.89 KB gzip).

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

- [x] **7. Bundle was one 580 KB chunk** (172 KB gzip), over Vite's 500 KB warning. — **FIXED
  2026-08-07 in PR #91**, having been accepted-not-fixed since it was filed. The entry is
  rewritten rather than annotated because every clause of it had become false: the bundle is no
  longer a single chunk, and Vite no longer warns.

  | | critical path | gzip |
  | --- | ---: | ---: |
  | before (`8a4cda0`) | 592.32 KB, one chunk | 176.16 KB |
  | after (`5d9400a`) | **296.11 KB** | **92.89 KB** |

  Supabase (212 KB) and the `?vitals=1` overlay (4.79 KB) became lazy chunks, so a guest who
  never signs in never downloads the auth SDK. Verified end to end in a production build, not
  inferred from the build table: with no session key present the Supabase chunk is **never
  requested** — only the 296 KB entry chunk — while a seeded session loads it and renders the
  account chip with no signed-out flash across 60 samples over 3 s.

  Two details worth preserving, because both are easy to undo by accident:
  - Sentry is imported by **named export** (`import('@sentry/react').then(({ init, captureException }) => …)`)
    so Rollup does not retain `replayIntegration`, which drags in 258 KB of `@sentry/replay` the
    app never uses. A bare namespace import gives most of the saving back.
  - `mayHaveSession()` is deliberately **fail-open**: it guesses from supabase-js's
    `sb-<ref>-auth-token` key, and every ambiguous case loads the SDK. If that key ever changes,
    the worst outcome is loading exactly as before — never someone silently appearing signed out.

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
  **DECIDED 2026-08-01 (owner):** keep both leagues and accounts exposed. Briefly reversed the
  same day while the backend was down, then restored. Final state: **both on.**

  **The outage.** The Supabase project behind production, `Sprachschule`
  (`xcnnlczvxmuwcqwychox`), was **paused** — Supabase status `INACTIVE`, which free-tier projects
  enter automatically after roughly a week of inactivity. On the live site that meant clicking
  *Send me a sign-in link* did nothing at all: no error, no confirmation, no disabled state.
  Accounts, sync and leagues were dead while still being advertised.

  Item #9's earlier "confirmed active on the live site" check saw the UI *render*; it never
  exercised a round trip. That is exactly how this hid, and it is the check to keep: **render is
  not reach.**

  **A pause is indistinguishable from a deletion by DNS alone.** `xcnnlczvxmuwcqwychox.supabase.co`
  returned NXDOMAIN from Google, Cloudflare and Quad9 while `supabase.co` itself resolved — this
  was initially read as the project having been deleted, which was wrong. Supabase tears down the
  API subdomain when it pauses a project. The Management API (`list_projects`, on a different and
  fully reachable host) reports `status` directly and is the authoritative check. Use it first.

  **Restored 2026-08-01.** `restore_project` → `COMING_UP` → `ACTIVE_HEALTHY`. **All data intact:**
  8 public tables, migrations schema present, 11 MB, the single account and its 39 SRS rows and
  39 learned flags all still there. Nothing was lost to the pause.

  A second lesson from the restore: querying while status was `COMING_UP` returned zero tables and
  zero users, which looks exactly like data loss. It was a partially-initialised database. **Wait
  for `ACTIVE_HEALTHY` before drawing any conclusion about contents.**

  **Final production state.** `VITE_LEAGUES_ENABLED=true`, `VITE_SYNC_ENABLED=true`,
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` restored to the Production scope, redeployed.
  Verified by round trip, not by rendering: the app POSTs to `/auth/v1/otp` and reaches the
  backend; the only failure in testing was Resend correctly rejecting an `example.com` test
  address (`550 Invalid to field`), which confirms SMTP is connected. Leagues, the account
  section and the header chip all render again.

  **A real bug the outage exposed, fixed in PR #79.** `VITE_SYNC_ENABLED` gates the sync *engine*
  (`App.jsx`), not the account UI. `WelcomeGate` gated on `isAuthConfigured()` but `AccountChip`
  and `AccountSection` rendered unconditionally, so with the backend gone the splash went clean
  while the header and Stats kept offering a dead sign-in. All three now check
  `isAuthConfigured()`; a signed-in user still keeps a way to sign out. This stands on its own
  merits — dead affordances should never render, whatever the cause.

  **Recurrence risk — mitigated 2026-08-01.** Free-tier projects pause again after about a week
  of inactivity. `.github/workflows/uptime.yml` now runs every 6 hours and fails loudly if any
  hop is down: the demo root, the lexicon manifest (`total > 0`), GoTrue `/health`, GoTrue
  `/settings` returning parseable JSON, and PostgREST answering at all. Alerting is GitHub's
  built-in notification on a failed scheduled run.

  Three things it deliberately does *not* do. It never `POST`s to `/auth/v1/otp`, so it never
  sends mail. It does not assert that PostgREST returns 200 for the anon key — the
  `revoke_legacy_data_api_privileges` migration leaves `anon` with **no table grants at all**, so
  401 is the healthy answer there and only 000/5xx is a fault. And it does not claim to prove the
  database itself is up, only that the Supabase API surface answers.

  The 6-hourly request should also keep the project from auto-pausing, since API traffic counts
  as activity — but that is a side effect, not the mechanism. The monitor's job is to say so when
  it pauses anyway. Note GitHub disables scheduled workflows after 60 days of repo inactivity.

  **Was open during the outage, now resolved:** the server-side `SUPABASE_URL` and
  `SUPABASE_SERVICE_ROLE_KEY` were never changed, so they pointed at the paused host and durable
  rate limiting fell back to a per-instance memory store. With the project restored they resolve
  again and durable rate limiting is live.

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
#18, #9 (PR #75) · #19 (PR #76) · #7 (PR #91). #5 is closed as won't-fix.

**Nothing is outstanding.** The last three to close:

1. **P3 #9** — DECIDED 2026-08-01: the demo keeps leagues and accounts exposed. Briefly turned
   off the same day because the Supabase project had auto-paused (free tier) and both were dead
   while still advertised; the project was restored with all data intact and both are back on.
   Verified by an auth round trip rather than by the UI rendering — that distinction is what let
   the outage hide in the first place.
2. **P2 #18** — FIXED 2026-08-01: homographs are merged at import time, 4,480 → 4,201 entries,
   no surviving card's id changed.
3. **P0 #19** — FIXED 2026-08-01: the #18 fix was reaching new visitors only. Lexicon JSON is
   now revalidated instead of served cache-first.

#19 is the one to remember. It was found only by checking the live site *after* shipping, and
neither the test suite nor the CDN could have caught it — the origin was correct the whole time.
Any future change to `public/lexicon/` should be confirmed on the deployed site, from a browser
profile that has visited before, not just from a clean one.

#5 is won't-fix (measured). #7 is fixed (PR #91). #8 is closed.
