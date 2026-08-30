# Deck Collection — many custom decks, one slot's worth of new machinery

- **Date:** 2026-08-30
- **Status:** design, ready for a plan
- **Author:** Claude Code
- **Scope:** planning only. No application code for this epic.
- **Predecessor:** `2026-08-30-custom-decks-sync.md` (#197–#201), which parked this as phase 4 and
  built the storage on a primary key that already anticipates it.

---

## 1 · What this is

A learner gets one custom deck. Generating a second replaces the first. This epic gives them
several, named, with a cap.

**The headline finding is that the storage and sync lane already supports this today**, and has
since #200. The work is UI, id generation, and one rule about where a cap may be enforced.

---

## 2 · Ground truth (verified 2026-08-30, against code and measurement)

### 2.1 Storage and sync are already deck-agnostic — this is not a sync epic

Every function in the persistence path iterates an arbitrary map of deck ids:

| Layer | Function | Already handles N decks? |
| --- | --- | --- |
| local blob | `readDecks`, `upsertDeck`, `deleteDeck`, `liveDecks`, `cardsFor` | yes — `Object.entries` |
| merge | `mergeDecks` | yes — union of deck ids, per-deck LWW |
| adapters | `decksToRows`, `decksFromRows` | yes — one row per entry |
| database | `decks` PK `(user_id, pack_id, deck_id)` | yes — designed for it |
| mastery | `learnedByDeck`, `forgetDeck` | yes — keyed by deck id |
| SRS | `srsKey = '<deckId>:<cardId>'` | yes — always was |
| export | `EXPORTED_TABLES.decks` | yes — whole table |

Nothing above changes. The brief asks how to "ensure the sync engine handles multiple generated
decks efficiently"; the honest answer is that it already does, because #200 was built on the
table's composite key rather than on the single slot the UI happened to expose.

### 2.2 Every single-slot assumption is in three files, and all of it is UI

Thirteen sites hardcode `'custom'` / `CUSTOM_DECK_ID`, and not one is in the persistence path:

- **`App.jsx`** (4) — generate, delete, forget-mastery, and the `customCards` prop.
- **`VocabTab.jsx`** (3) — `deckId === 'custom'` for the active deck, the fallback effect, and
  `setDeckId('custom')` after generating.
- **`DeckPicker.jsx`** (6) — one rendering block for a single row.

So the epic's real surface is: render a list, generate into a new id, and thread a deck id through
three call sites.

### 2.3 The existing deck needs no migration

`'custom'` is just a key in the map. When the collection arrives it becomes one member of it, with
its cards, its `updatedAt`, its scoped mastery and its SRS rows all intact and already keyed
correctly. **There is no migration in this epic, and no database change of any kind.**

### 2.4 A deck costs 602 bytes — the cap is a UX decision, not a storage one

Measured against the real card shape the prompt asks for (`de`, `en`, `ipa`, exactly 10 cards):

| | bytes |
| --- | --- |
| one AI-generated deck | **602** |
| one curated-shaped deck (glosses, article, plural) | 2,633 |
| 20 AI decks | ~12 KB |

The state blob is already ~330 KB on a mature account. Twenty decks add under 4% of that.

**So no cap can be justified by storage, and the spec should not pretend otherwise.** The cap
exists because a picker with thirty rows is unusable, and because an unbounded list invites the
lexicon-sized overflow that once dragged the deck progress row 54× wider than the viewport.

### 2.5 Summary

| Question asked | Verified answer |
| --- | --- |
| How does local state expand? | **It does not** — `state.decks` is already a map (§2.1, §2.3). |
| How does sync handle many decks? | **Unchanged** — union by deck id, one row each (§2.1). |
| New table / column / migration? | **None.** |
| What actually changes? | Deck id generation, three UI files, and a cap (§3–§5). |
| What sizes the cap? | Legibility, not bytes (§2.4). |

---

## 3 · Design A — deck identity

### 3.1 Ids must be unique across devices, or decks are silently lost

This is the one genuinely new correctness problem. `mergeDecks` resolves a shared id by per-deck
LWW, so **if two devices independently mint the same id for different decks, one deck is discarded
without a trace.** Identity is therefore a data-safety concern, not a tidiness one.

```
deckId = `custom-${crypto.randomUUID()}`     // 122 bits — collision is not a real event
```

with a fallback for any context where `crypto.randomUUID` is unavailable:

```
`custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
```

**Decision D1: random ids, never derived from content.** A hash of the topic would make two decks
about "weather" collide *by design*, and regenerating a topic would silently overwrite the earlier
deck — the exact failure the random id exists to prevent.

**Implementation risk to check, not assume:** `crypto.randomUUID` needs a secure context, and the
test environment is jsdom. Node provides it, but the plan should verify it under vitest's jsdom
rather than discovering the gap in CI.

### 3.2 Names are the topic, and duplicates are allowed

The learner already types a topic; that is the name. Two decks may share one — their ids differ,
the rows are distinct, and forbidding it would mean explaining a rule nobody asked for. Renaming is
**out of scope** (§7) and recorded as an open question.

---

## 4 · Design B — the cap, and the one place it must not live

### 4.1 The cap is enforced on CREATION only. Never in the merge

This is the most important rule in the epic, and it follows directly from what the previous two
taught us.

Two devices, offline, cap of 8. Device A makes 8 decks; device B makes 8. They sync, and
`mergeDecks` unions them into 16. If the merge enforced the cap it would have to **drop eight decks
the learner legitimately created** — and dropping them would not even work, because removal from a
union-merged map does not stick without a tombstone: the other device pushes them straight back on
the next reconcile.

So:

- **Creation** checks the cap and refuses. A local precondition, in the UI and in `upsertDeck`.
- **Merge** never checks it. Sync may legitimately exceed the cap, and the UI must render whatever
  arrives.
- **Nothing is ever deleted to satisfy a cap.** A learner over the cap simply cannot generate more
  until they remove one.

### 4.2 The cap counts LIVE decks, not entries

Deleting a deck leaves a tombstone (`deletedAt`), and tombstones live in the same map. Counting raw
entries would mean a learner who generates and deletes eight times is locked out by their own
history.

```
atCap = Object.keys(liveDecks(decks)).length >= MAX_CUSTOM_DECKS
```

`liveDecks` already exists for exactly this distinction.

### 4.3 The number

**`MAX_CUSTOM_DECKS = 8`**, in `gameConfig.js` alongside every other tunable. Eight is a scannable
list and comfortably more than the one deck learners have today. It is a product guess, not a
measurement — §2.4 shows storage does not constrain it, and there is no usage data on how many
decks people want, because they have never been able to make two.

---

## 5 · Design C — the UI

### 5.1 DeckPicker renders a list

The single custom row becomes a section of rows, each carrying select and remove as **siblings**
(never nested — a `<button>` inside a `<button>` is invalid and browsers silently un-nest it, which
is why #201 put Remove beside the row rather than inside it).

At the cap, the generate control is disabled and says why. Below the cap it behaves as it does now.

### 5.2 VocabTab stops asking "is this the custom deck?"

`deckId === 'custom'` becomes a lookup in the deck map. The three sites generalise:

```
activeDeck  = cardsFor(decks, deckId) ?? (isAuto ? asyncDeck : PRESET_DECKS[deckId] ?? [])
fallback    = if the selected deck is gone (deleted here, or tombstoned on another device)
generate    = setDeckId(newlyCreatedId)   // not the literal 'custom'
```

The fallback effect already exists and already covers the sync case; it only needs to test
membership rather than a literal.

### 5.3 App threads a deck id

`handleDeckGenerated` mints an id; `handleDeckDeleted(deckId)` and `forgetDeck(deckId)` take one
instead of assuming. `customCards` gives way to passing the deck map, which VocabTab already needs
for §5.2.

---

## 6 · What this epic does NOT need

Worth stating, because the instinct on a "collection" feature is to reach for all of them:

- **No migration.** §2.3.
- **No schema change.** §2.1.
- **No sync change.** §2.1 — and any apparent need for one is a signal the design has drifted.
- **No new endpoint or cron.**
- **No cap in the merge.** §4.1 — actively harmful.

---

## 7 · Explicitly out of scope

- **Renaming a deck.** The topic is the name; editing it is a separate, small feature.
- **Reordering, folders, sharing.**
- **Regenerating a deck in place** (same id, new cards). Tempting, and it interacts with `updatedAt`
  and mastery in ways that want their own thought.
- **Tombstone retention.** Still parked from the custom-decks epic; more decks means more
  tombstones, which makes it slightly more pressing but not urgent at this scale.

---

## 8 · Testing

- **Id uniqueness under concurrency.** Generate many ids in a tight loop and assert no duplicates.
  A weak generator passes a single-call test trivially — the assertion has to be about a population.
- **The merge ignores the cap.** Union two deck maps that each sit at the cap and assert the result
  holds all of them, with none dropped. **Stage this red** against a version that enforces the cap
  in `mergeDecks`, or it is a test of a rule that was never at risk.
- **The cap counts live decks.** Fill to the cap, delete one, assert generation is possible again —
  and that the tombstone still exists. This is the assertion that fails if someone counts
  `Object.keys(decks)`.
- **Deleting one deck leaves the others alone**, including their scoped mastery: `forgetDeck` must
  drop only the named deck's entry from `learnedByDeck`.
- **Selecting a deck that is then deleted on another device** falls back rather than rendering an
  empty deck — the existing effect, now over a collection.
- **A round trip through the sync adapters with N decks** produces N rows and reads back N decks.
- **DeckPicker**: remove is a sibling of select, not nested; the generate control is disabled at
  the cap and enabled below it.

---

## 9 · Phasing

| # | PR | Migration | Visible |
| --- | --- | --- | --- |
| 1 | `newDeckId()` + cap constant + cap-aware `upsertDeck` + tests | none | no |
| 2 | App/VocabTab take a deck id instead of assuming `'custom'` | none | no |
| 3 | DeckPicker renders the collection; generate targets a new id | none | **yes** |

1 → 2 → 3. Phase 2 is a pure refactor and should not change behaviour: with one deck in the map it
must produce exactly today's app, which is the safest way to land the id threading.

---

## 10 · Open questions

1. **Should custom decks feed `deck-unfinished`?** They are ten cards and genuinely finishable, so
   they are better mission material than the auto decks. It changes a number on Home, so it wants
   its own call. (Carried over from the custom-decks spec's §9.2.)
2. **Rename?** §7 defers it. If it lands, it is `name` only — never the id, which must stay stable
   for the merge.
3. **Is 8 right?** A guess (§4.3). Nobody has ever had two decks, so there is no data. Worth
   revisiting once there is.
4. **What happens above the cap after a sync?** §4.1 allows it deliberately. The UI should probably
   say something rather than silently refusing to generate — but "you have 16 decks, which is more
   than the limit" is an awkward sentence and may not be worth writing.
