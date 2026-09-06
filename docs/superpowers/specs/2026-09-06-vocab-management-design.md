# Vocabulary management — Browse / Custom beside Practice

- **Date:** 2026-09-06
- **Status:** P1 and most of P2 landed in #245 (`d91886c`). Remaining work is
  leftover P2 (group/deck filters) plus P3–P5. Do not start P3 writes from this
  document.
- **Author:** Claude Code (2026-09-06 discovery). Updated after #245 so the
  document matches the merged tree, not the original P1 brief.
- **Predecessor:** #244 (`ui/vocab-centered-cards`) — Practice-column cleanup.
- **Landed:** #245 (`feat/vocab-management-p1`) — tab shell, searchable table,
  status chips, pager, row inspect, Practise-from-row.

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

## 2 · Ground truth (verified 2026-09-06 against `main` @ `d91886c`)

### 2.1 Management surface that exists now

[VocabTab.jsx](../../../src/components/VocabTab.jsx) has three inner modes:

| Mode | What it is |
| --- | --- |
| **Practice** (default) | Today's recall UI. Generate / delete custom decks still live here. |
| **Browse** | Table of the **currently selected** deck — not the whole lexicon. Search, status chips, 50-row pager, expand-a-row details, Practise. |
| **Custom** | View-only list of live custom decks. Selecting one calls `setDeckId` and shows that deck's table. No generate / delete / edit. |

`App.jsx` still mounts VocabTab with `{tab === 'vocab' && …}`, so leaving the
app-level tab **unmounts** the tree: `deckId` resets to `greetings` and `mode`
resets to `practice`.

### 2.2 What can already be written

| Action | Exists? | How |
| --- | --- | --- |
| Generate a custom deck | yes | AI, 10 cards, `newDeckId()`, cap 8 live / 100 cards. **Practice only.** |
| Delete a custom deck | yes | trash icon on Practice, **no confirm**, tombstone + `forgetDeck` |
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

1. **Practice** (default) — today's recall UI. Generate/delete stay here through
   P3 and move to Custom in P4.
2. **Browse** — table/list of the **currently selected** deck. It is not a
   library of every word in the pack. Deck changes still happen on Practice
   (or by picking a custom deck on Custom). #245 already added in-deck search,
   status chips, a pager, expand-row inspect, and Practise.
3. **Custom** — the only writable surface **from P3**. Until then it is
   view-only: a list of live custom decks plus the same table. Generate/delete
   stay on Practice.

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
5. Confirm before a deck delete (P3). Today's trash has no confirm.

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

| PR | What | Writes? | Status |
| --- | --- | --- | --- |
| **P0** | Merge #244 | no | **done** |
| **P1** | Tab shell + view-only table for the selected deck. Custom tab is view-only. | no | **done in #245** |
| **P2 (landed)** | In-deck search (umlaut / `ß` fold), status chips, 50-row **pager** (not a hard cap), Article / Level / Category columns, expand-row details, Practise-from-row. `VocabTable` takes derived `rows`. | no | **done in #245** — the original brief called P1 "cap-50-only"; that is stale. CEFR B1 (2,144 cards) is reachable page by page. |
| **P2 (left)** | Group / deck filters on Browse so a learner can change deck without returning to Practice. A dedicated inspect panel (today's inspect is an expand row). | no | **not started** |
| **P3** | Custom rename / edit `en`/`ipa`/glosses / delete card / confirm deck delete. | yes, existing helpers | **not started** |
| **P4** | Practice picker becomes select-only. Generate + trash live on Custom. | no new contracts | **not started** |
| **P5** | Optional: due-only session from Browse. Practise-from-row already landed. | no new keys | **not started** |

---

## 7 · Files that landed in #245

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

- Whole-deck LWW: two devices editing one custom deck drop one side's cards.
- Auto-deck size: never mount Top 500 (or CEFR B1) as one table. Page size is
  50; the pager reaches the rest. Search is the way through a 2,144-row deck.
- `recordVocabAnswer` already has its own `saveState` writer. Do not add a
  third in this epic.
- Table chrome stays language-blind: headers are Term / Meaning / IPA / Status
  (plus Article / Level / Category), not "German". IPA renders through
  `TEXT.ipa` (JetBrains Mono).
- Browse is the selected deck. Adding group/deck filters is leftover P2, not
  a silent extra column.
- Custom is view-only until P3. Do not add edit/delete/card-write on a
  "small UX" pass.
