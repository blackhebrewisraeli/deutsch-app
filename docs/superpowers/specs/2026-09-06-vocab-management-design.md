# Vocabulary management — Browse / Custom beside Practice

- **Date:** 2026-09-06 · **revised 2026-09-13**
- **Status:** P0–P2 have landed, plus the Browse deck selector (#251–#254) and
  the delete confirm (#255). **The order of the two remaining phases is
  swapped: P4 now precedes P3** — see §6. The next PR is P4.
- **Author:** Claude Code. Revised after #255 so the document matches the
  merged tree, not the 2026-09-06 discovery.
- **Predecessor:** #244 (P0) → #245 (P1+P2) → #246 (alignment) → #247 (queue
  crash) → #251–#254 (Browse selector, mobile density) → #255 (delete confirm).
- **Verified against:** `main` @ `63383a6`, 237 files / 3030 tests.

---

## 1 · What this is

The Vocab tab used to be a **practice session** with a cluttered picker. Learners
could not browse a deck as a list or inspect a word. #245 added an inner tab
strip so practice and management stop sharing that column.

**P0 is done.** #244 merged as cleanup. Do not reopen it.

**#245 is done and stays.** It shipped more than the original P1 brief (see §6).
Fix-forward on copy and first-screen density; do not revert unless a later
product decision says the extra P2 surface was a mistake.

---

## 2 · Ground truth (re-verified 2026-09-13 against `main` @ `63383a6`)

### 2.1 Management surface that exists now

[VocabTab.jsx](../../../src/components/VocabTab.jsx) has three inner modes:

| Mode | What it is |
| --- | --- |
| **Practice** (default) | Today's recall UI. Generate / delete custom decks still live here **until P4**. |
| **Browse** | Table of the **currently selected** deck. Search, status chips, 50-row pager, expand-a-row details, Practise — **plus its own deck selector** since #251. |
| **Custom** | View-only list of live custom decks. Selecting one calls `selectDeck` and shows that deck's table. No generate / delete / edit. |

**`VocabTab` is wrapped in `PracticeLane`, and the earlier text here was
wrong.** [App.jsx:1234](../../../src/App.jsx) mounts `<PracticeLane level tab>`
around every practice tab; the bare `{tab === 'vocab' && …}` sits *inside* it.
When that (level, tab) has lesson units, `PracticeLane` moves **all** of
`VocabTab` into a **collapsed `<details>`** labelled "Reference & Bundled
Practice" (owner decision, 2026-09-04). Production `lessons` — queried
2026-09-13 — holds:

| level | tab | units | exercises |
| --- | --- | --- | --- |
| a1 | alphabet / chat / translate / **vocab** | 1 each | 5 / 2 / 5 / **5** |
| a2, b1 | — | 0 | 0 |

So at **a1, the only seeded level, the entire Vocab management surface opens
behind a closed disclosure**; at a2/b1 `PracticeLane` returns `children`
untouched. Every phase of this epic inherits that, P4 included (§9 R6).

Leaving the app-level tab still **unmounts** the tree: `deckId` resets to
`greetings` and `mode` resets to `practice`.

### 2.2 What can already be written

| Action | Exists? | How |
| --- | --- | --- |
| Generate a custom deck | yes | AI, 10 cards, `newDeckId()`, cap 8 live / 100 cards. **Practice only, until P4.** |
| Delete a custom deck | yes | trash on Practice → **inline Remove / Cancel confirm** (#255) → tombstone + `forgetDeck` |
| Select a deck from Browse | yes | `BrowseDeckSelect`, grouped `<select>`, custom decks in a "Your decks" optgroup (#251/#252) |
| Browse / search / page a deck | yes | #245 |
| Practise a row | yes | jumps that card to the front of the Practice queue |
| Rename a deck | no | P3 |
| Edit / delete a card | no | P3 |
| Add a card by hand | no | |
| Un-learn a word | no | learning is monotonic; `learnedWords` is union-merged |
| Reset SRS | no | |

### 2.3 Preset vs user content

- **Curated:** `greetings` / `food` / `travel` / `numbers` — 10 authored ids each
  in [decks.js](../../../src/packs/de/decks.js), resolved at build.
- **Auto:** ~23 lexicon views in [autoDecks.js](../../../src/packs/de/autoDecks.js)
  (Frequency, CEFR, Topics, grammar drills). Core 100 / Top 500 / CEFR decks
  are 100–500+ rows; CEFR B1 is 2,144. Resolved lazily by
  [useAutoDeck.js](../../../src/components/vocab/useAutoDeck.js).
- **Custom:** AI JSON `{ de, en, ipa? }` with `id = activePack.cardId(c)` =
  `card.de`. Stored in `state.decks`.

Pack content has **no overlay store**. Editing it would need a new
`localStorage` key, which AGENTS.md forbids without a Claude Code storage design.

### 2.4 Identity is the German surface form

```js
// packs/de/index.js
const cardId = (card) => card.de;
// lib/srs.js
srsKey(deckId, id) => `${deckId}:${id}`
```

Changing `de` is a new card. SRS rows and both learned maps key on the old id.
**`de` / `id` are frozen** on every edit path this epic ever grows.

`card.de` as a **field name** is the recorded exception in AGENTS.md. Do not
rename it to `term` in this epic.

### 2.5 Sync already has a deck story — do not invent a second one

| Slice | Shape | Merge | Implication |
| --- | --- | --- | --- |
| Custom decks | `state.decks[id] = { deckId, name, cards, updatedAt, deletedAt }` | `public.decks`, **whole-deck LWW** on `updatedAt` | An edit rewrites the whole deck. No per-card merge. Two devices editing the same deck drop one side. |
| Learned (legacy) | `learnedWords[cardId] = true` | `settings.data`, **union** | A deleted key is resurrected by any device that still holds it. |
| Learned (scoped) | `learnedByDeck[deckId][cardId] = true` | `settings.learned_by_deck`, **per-deck union** | Dropped on custom-deck delete via `forgetDeck`. |
| SRS | `srs['deckId:cardId']` | `public.srs_state` | Status column source. `recordVocabAnswer` writes via its own `saveState`. |

Storage key stays `deutsch-app-state-v1`. No rename, no new key.

---

## 3 · Information architecture

Keep the app-level **Vocab** tab. Three inner tabs. Four will wrap or overflow
at 320px.

1. **Practice** (default) — today's recall UI. **Through P3.5 it also owned
   generate and delete; P4 moves both to Custom and leaves Practice
   select-only.**
2. **Browse** — table/list of the **currently selected** deck. It is not a
   library of every word in the pack. Since #251 Browse has its own
   `BrowseDeckSelect`, so a deck change no longer requires a trip to Practice.
   #245 added in-deck search, status chips, a pager, expand-row inspect, and
   Practise.
3. **Custom** — **the writable surface from P4 onward.** P4 gives it generate
   + delete; P3 then adds rename and card edit. Before P4 it is view-only.

Status is a **filter** on Browse/Custom, not a fourth tab. The chips landed in
#245.

`SegmentedPicker` is the wrong primitive (`role="group"` + `aria-pressed`, no
arrows). `VocabModeTabs` is a real `tablist` / `tab` / `tabpanel` with
arrow-key roving tabindex and **manual selection** (arrows move focus;
Space / Enter / click commit), matching [LevelSwitcher.jsx](../../../src/components/ui/LevelSwitcher.jsx).
Switching away from Practice mid-card is a session change; selection-follows-focus
would commit that on the first arrow.

Inner `mode` lives in VocabTab. Leaving the app-level Vocab tab still remounts
and resets to Practice — same as today's `deckId` reset. Do not lift mode to
`App` until a later brief says so.

---

## 4 · Edit policy (load-bearing, all phases)

1. Pack content (curated + auto) is **view-only**.
2. Custom decks may edit `name`, `en`, `ipa`, and extra glosses. **`de` and
   `id` do not change.**
3. Learning stays monotonic. No un-learn, no SRS reset.
4. Custom writes go through `upsertDeck` / `deleteDeck` and dispatch
   `deutsch:progress`. Deleting the last card of a deck is `deleteDeck` (a
   tombstone) — `upsertDeck` already rejects an empty card list.
5. Confirm before a deck delete. **Shipped in #255** as a per-row inline
   Remove / Cancel strip (no typed phrase — that pattern is calibrated for
   account erasure, not one deck). The confirm **moves with the trash in P4**;
   it is not rebuilt.

---

## 5 · Status derivation

Two helpers exist and must not drift further:

**Table rows** (`toVocabRows` in [vocabRows.js](../../../src/lib/vocabRows.js))
keep a **base status** plus two flags, because a mastered card can also be due
and a learning card can also be learned:

| Field | Meaning |
| --- | --- |
| `status` | `new` (no SRS row) · `mastered` (`box === MASTERED_BOX`) · otherwise `learning` |
| `due` | no usable `nextDue`, or `nextDue <= now` |
| `learned` | `isLearned(...)` — the same maps as the Practice "✓ LEARNED" badge |

The Status column paints additive pills (Learning + Due, Learning + Learned,
Mastered + Due). Filter chips read those fields independently.

**Collapsed helper** (`statusForCard` in
[vocabStatus.js](../../../src/components/vocab/vocabStatus.js)) is first-match
for callers that still want one enum:

`new` → `mastered` → `due` → `learned` → `learning`

`learned` here is also `isLearned`, **not** "has an SRS row that is not due".
That older reading shipped in the first #245 commit and was corrected in the
same PR.

---

## 6 · Phased PRs

**The 2026-09-06 order was P3 → P4. It is now P4 → P3.** The original
rationale — "generate must stay beside where you pick decks" — expired when
#251 gave Browse its own selector: deck *selection* has already left Practice,
so the picker's only remaining unique job is generate + trash, which is exactly
what P4 relocates. Doing P3 first would also add rename/edit affordances to a
Custom surface that P4 immediately re-lays-out.

| PR | What | Writes? | Status |
| --- | --- | --- | --- |
| **P0** | Merge #244 | no | **done** |
| **P1** | Tab shell + view-only table for the selected deck | no | **done in #245** |
| **P2 (landed)** | In-deck search (umlaut / `ß` fold), status chips, 50-row **pager** (not a hard cap), Article / Level / Category columns, expand-row details, Practise-from-row. `VocabTable` takes derived `rows`. | no | **done in #245** |
| **P2 (left)** | ~~Group / deck filters on Browse~~ **done in #251–#254** (`BrowseDeckSelect`). What remains is only the **dedicated inspect panel** — inspect is still an expand-row. | no | **mostly done** |
| **P3.5** | Confirm before a deck delete | no new contract | **done in #255** |
| **P3.6** | a11y of that confirm: focus restore, live region, label the destructive button | no | **not started — prerequisite for P4** |
| **P4** | Practice picker becomes select-only. Generate + trash-with-confirm move to Custom, in a new `CustomDeckManager`. | no new contracts | **next** |
| **P3** | Custom rename / edit `en`/`ipa`/glosses / delete card | yes, existing helpers | **blocked on an owner decision — §9 R1** |
| **P5** | Optional: due-only session from Browse. Practise-from-row already landed. | no new keys | **not started** |

---

## 7 · Files that have landed

### 7.1 #245

**Modified**

- `src/components/VocabTab.jsx` + `VocabTab.test.jsx`
- `src/lib/textRules.js` + `textRules.test.js` (`SEARCH` rule set)

**Added**

- `src/components/vocab/VocabModeTabs.jsx` + test, `vocabModes.js`
- `src/components/vocab/VocabBrowse.jsx` + test
- `src/components/vocab/VocabBrowser.jsx` + test
- `src/components/vocab/VocabTable.jsx` + test
- `src/components/vocab/vocabStatus.js`
- `src/lib/vocabRows.js` + test

**Do not touch for leftover P2 or for copy/density follow-ups:** `App.jsx`,
`customDecks.js`, `learnedWords.js`, `srs.js`, `storage.js`, `sync/*`,
`DeckPicker.jsx`, pack content, any `localStorage` key.

`VocabTable` contract is `{ rows, expandedId, onToggleExpand, onPractice,
emptyMessage, mobile, caption }`. Do not pass `{ cards, deckId, srs, now }` —
that older signature rendered an empty table with no error.

### 7.2 Files that landed in #251–#255

**Added:** `src/components/vocab/BrowseDeckSelect.jsx` + test (#251).

**Modified:** `VocabTab.jsx` + test (#251–#253), `VocabBrowse.jsx` + test
(#251/#252/#254), `BrowseDeckSelect.test.jsx` (#254), `DeckPicker.jsx` + test
and `App.test.jsx` (#255).

`VocabTab.jsx` is now **676 lines** and still owns the SRS queue, four grading
paths, AI generation and all three panel mounts. P4 and P3 both touch it; the
extraction of a `PracticePane` is a separate mission and is **not** part of
either.

---

## 8 · Out of scope

- Un-learn / SRS reset / pack-card overlays
- New or renamed `localStorage` keys
- Renaming `card.de` → `term`
- Manual "add a word" to pack decks
- Virtualizing the whole lexicon (paging + search is the designed answer)
- Fixing `DeckCompleteBanner` (already `// BUG:` from #244)
- Changing `MAX_CUSTOM_DECKS` (8) or generate-via-AI
- Chat / Translate / Alphabet
- Stats `VocabSrsWidget` still counting only the 40 curated cards
- Preview-SSO / Google OAuth landing on Site URL — not a #245 regression

---

## 9 · Risks the later PRs must keep saying out loud

**R1 — a deleted card's learned entry can never be dropped. (Blocks P3, not P4.)**
[merge.js:140](../../../src/lib/sync/merge.js) settles decks by **whole-deck
LWW** on `updatedAt`; [merge.js:166](../../../src/lib/sync/merge.js) merges
`learnedByDeck` by **per-deck union with no card-level tombstone**. Deck
deletion survives this only because the *deck* tombstone carries it. Delete a
**card** and `learnedByDeck[deckId][cardId]` cannot be removed — any other
device re-unions it on the next pull — and
[`learnedCountOf`](../../../src/lib/learnedWords.js) iterates those values, so
Home's "words known" inflates permanently. There is no `forgetCard`, and adding
one is a **sync contract change**, i.e. its own epic. **P3 cannot start until
the owner picks: accept the drift (consistent with §4.3's monotonic rule), or
fund the contract change.**

**R2 — a rename is a whole-deck write.** `upsertDeck` bumps `updatedAt` across
the entire deck, so a rename on device A and a card edit on device B discard
one side's *cards*, not just the name.

**R3 — `upsertDeck` silently rejects an empty card list** (returns `base`
unchanged). Deleting the last card must route to `deleteDeck`, or the UI shows
a delete that did nothing.

**R4 — identity is frozen.** `cardId = card.de`. Editing `de` re-keys SRS and
both learned maps. Edit `en` / `ipa` / glosses only.

**R5 — orphaned SRS rows are benign.** [`getDueCards`](../../../src/lib/srs.js)
iterates the **deck**, not the srs map, so a deleted card's row is inert for the
queue. Do **not** add pruning.

**R6 — P4 relocates a write surface into a collapsed disclosure at a1.**
Per §2.1, `PracticeLane` buries all of `VocabTab` behind a closed `<details>`
whenever the level has lesson units — true at a1 and only a1. P4's thesis is
"Custom is the home of deck creation", and at the seeded level that home opens
closed. P4 does **not** make this worse (Practice is equally buried today) and
must **not** try to fix it — the disclosure is an owner decision from
2026-09-04. State it, ship P4, raise it separately.

**R7 — auto-deck size.** Never mount Top 500 or CEFR B1 as one table. Page size
is 50; search is the way through 2,144 rows.

**R8 — `recordVocabAnswer` already has its own `saveState` writer.** Do not add
a third in this epic.

**R9 — table chrome stays language-blind.** Headers are Term / Meaning / IPA /
Status (plus Article / Level / Category), not "German". IPA renders through
`TEXT.ipa` (JetBrains Mono).

---

## 10 · P4 in detail

### 10.1 The move

| Control | Today | After P4 |
| --- | --- | --- |
| Preset / auto deck list | `DeckPicker` on Practice | unchanged |
| Custom deck list, **selectable** | `DeckPicker` on Practice | **both** — Practice keeps select-only rows; Custom owns the managed list |
| Generate form (topic, button, at-cap note) | `DeckPicker` | **`CustomDeckManager` on Custom** |
| Trash + confirm | `DeckPicker` | **`CustomDeckManager` on Custom** |

### 10.2 Component boundary

`VocabBrowse`'s docstring says "view-only browse surface" and it serves **both**
Browse and Custom. Do not thread the seven generate/trash props through it.

- **New `src/components/vocab/CustomDeckManager.jsx`** owns the managed deck
  list (select + trash + confirm), the generate form, the at-cap note and the
  no-decks-yet copy.
- **`VocabBrowse` loses its `customDecks` prop and its whole `isCustomMode`
  branch**, and gains an explicit `showSelector` boolean. It becomes: optional
  selector + title, loading/error, table, `emptyMessage`. That is the component
  its docstring already claims it is.
- **`VocabTab`'s custom panel** renders `<CustomDeckManager …/>` followed by
  `<VocabBrowse showSelector={false} cards={customCards ?? []} …/>`.
- **`DeckPicker` drops** `onDelete`, `customTopic`, `onTopicChange`,
  `generating`, `onGenerate`, `atCap`, `maxDecks` — and the `pendingDeleteId`
  state goes with the confirm. It keeps custom decks **selectable**.

### 10.3 No new contracts

`App.jsx` is **not** touched: `onDeckGenerated` and `onDeckDeleted` already
reach `VocabTab`, which simply hands them to a different child. No storage key,
no sync change, no migration, no change to `customDecks.js`.

### 10.4 Discoverability

**Decision: no transitional pointer on Practice.** The mode tabs are visible
above the panel and one is literally labelled Custom; a pointer means new copy
in the pack for a surface the learner can already see. Owner may override.

`CUSTOM_EMPTY_COPY` must be reworded — it currently reads "Generate one on
Practice — this tab is view-only", which P4 makes false.

### 10.5 Sequencing

**P3.6 (the confirm's a11y) lands before P4.** The confirm code moves in P4, so
fixing it first means P4 relocates already-correct code instead of the a11y fix
having to chase a file that just moved. Both diffs stay honest.
