# Vocabulary management — Browse / Custom beside Practice

- **Date:** 2026-09-06
- **Status:** design, P1 ready to implement
- **Author:** Claude Code (from the 2026-09-06 discovery pass)
- **Predecessor:** #244 (`ui/vocab-centered-cards`) — Practice-column cleanup, merged first on purpose
- **Scope:** information architecture, edit policy, sync constraints, and the P1 file list.
  Application code for P1 lives on `feat/vocab-management-p1`, not in this document.

---

## 1 · What this is

The Vocab tab is a **practice session** with a cluttered picker, not a vocabulary
manager. Learners cannot browse a deck as a list, inspect a word, or edit a
custom card. Controls for generate, delete, auto-deck chips, and recall all
share one page.

This epic adds an inner tab strip so practice and management stop sharing that
column, then lands browse / inspect / custom-edit in small PRs on top of the
storage and sync contracts that already exist.

**P0 is done.** #244 merged as cleanup. Do not reopen it as the redesign vehicle.

---

## 2 · Ground truth (verified 2026-09-06 against `main` @ `fb31659`)

### 2.1 There is no management surface

[VocabTab.jsx](../../../src/components/VocabTab.jsx) is a two-column practice
page: [DeckPicker](../../../src/components/vocab/DeckPicker.jsx) on the left
(presets, custom rows + trash, auto-deck chips, generate form) and one card at
a time on the right. No table, no inspect drawer, no card editor.

`App.jsx` mounts VocabTab with `{tab === 'vocab' && …}`, so leaving the app-level
tab **unmounts** the tree and `deckId` resets to `greetings`.

### 2.2 What can already be written

| Action | Exists? | How |
| --- | --- | --- |
| Generate a custom deck | yes | AI, 10 cards, `newDeckId()`, cap 8 live / 100 cards |
| Delete a custom deck | yes | trash icon, **no confirm**, tombstone + `forgetDeck` |
| Rename a deck | no | |
| Edit / delete a card | no | |
| Add a card by hand | no | |
| Un-learn a word | no | learning is monotonic; `learnedWords` is union-merged |
| Reset SRS | no | |

### 2.3 Preset vs user content

- **Curated:** `greetings` / `food` / `travel` / `numbers` — 10 authored ids each
  in [decks.js](../../../src/packs/de/decks.js), resolved at build.
- **Auto:** ~23 lexicon views in [autoDecks.js](../../../src/packs/de/autoDecks.js)
  (Frequency, CEFR, Topics, grammar drills). Core 100 / Top 500 / CEFR decks
  are 100–500+ rows. Resolved lazily by [useAutoDeck.js](../../../src/components/vocab/useAutoDeck.js).
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

Keep the app-level **Vocab** tab. Add three inner tabs. Four will wrap or
overflow at 320px.

1. **Practice** (default) — today's recall UI. Generate/delete stay here through
   P3 and move to Custom in P4.
2. **Browse** — table/list of the **currently selected** deck (P1). P2 adds
   group/deck filters, status chips, and a read-only inspector.
3. **Custom** — the only writable surface (from P3). P1 is a view-only list
   plus the same table; generate/delete stay on Practice.

Status (New / Due / Learned / Mastered) is a **filter** on Browse/Custom from
P2, not a fourth tab.

`SegmentedPicker` is the wrong primitive (`role="group"` + `aria-pressed`, no
arrows). New `VocabModeTabs` is a real `tablist` / `tab` / `tabpanel` with
arrow-key roving tabindex and **manual selection** (arrows move focus;
Space / Enter / click commit), matching [LevelSwitcher.jsx](../../../src/components/ui/LevelSwitcher.jsx).
Switching away from Practice mid-card is a session change; selection-follows-focus
would commit that on the first arrow.

Inner `mode` lives in VocabTab. Leaving the app-level Vocab tab still remounts
and resets to Practice — same as today's `deckId` reset. Do not lift mode to
`App` in P1.

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

One function, used by the table and later by filters:

| Condition (first match) | Status |
| --- | --- |
| no `srs[deckId:cardId]` | `new` |
| `box === MASTERED_BOX` (5) | `mastered` |
| `nextDue <= now` | `due` |
| otherwise | `learned` |

`isLearned` still drives the Practice "✓ LEARNED" badge. It is **not** a
separate table status: a learned card that is due again shows as `due`.

---

## 6 · Phased PRs

| PR | What | Writes? |
| --- | --- | --- |
| **P0** | Merge #244 | no (done) |
| **P1** | Tab shell + view-only table for the selected deck. Auto decks: first 50 rows. Custom tab is view-only. | no |
| **P2** | Browse filters (group/deck/status) + read-only inspect. "Practice this" sets `deckId` and switches to Practice. | no |
| **P3** | Custom rename / edit `en`/`ipa`/glosses / delete card / confirm deck delete. | yes, existing helpers |
| **P4** | Practice picker becomes select-only. Generate + trash live on Custom. | no new contracts |
| **P5** | Optional: practice-from-row / due-only session. | no new keys |

---

## 7 · P1 file list (exact)

**Modify**

- `src/components/VocabTab.jsx`
- `src/components/VocabTab.test.jsx`

**Add**

- `src/components/vocab/VocabModeTabs.jsx` + `VocabModeTabs.test.jsx`
- `src/components/vocab/VocabBrowse.jsx` + `VocabBrowse.test.jsx`
- `src/components/vocab/VocabTable.jsx` + `VocabTable.test.jsx`

**Do not touch:** `App.jsx`, `customDecks.js`, `learnedWords.js`, `srs.js`,
`storage.js`, `sync/*`, `DeckPicker.jsx`, pack content.

---

## 8 · Out of scope

- Un-learn / SRS reset / pack-card overlays
- New or renamed `localStorage` keys
- Renaming `card.de` → `term`
- Manual "add a word" to pack decks
- Virtualizing the whole lexicon
- Fixing `DeckCompleteBanner` (already `// BUG:` from #244)
- Changing `MAX_CUSTOM_DECKS` (8) or generate-via-AI
- Chat / Translate / Alphabet
- Stats `VocabSrsWidget` still counting only the 40 curated cards

---

## 9 · Risks the later PRs must keep saying out loud

- Whole-deck LWW: two devices editing one custom deck drop one side's cards.
- Auto-deck size: never mount Top 500 as one table (P1 cap is 50).
- `recordVocabAnswer` already has its own `saveState` writer. Do not add a
  third in this epic.
- Table chrome stays language-blind: headers are Term / Meaning / IPA / Status,
  not "German". IPA renders through `TEXT.ipa` (JetBrains Mono).
