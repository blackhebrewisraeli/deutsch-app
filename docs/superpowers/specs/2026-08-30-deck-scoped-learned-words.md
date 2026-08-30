# Deck-scoping `learnedWords` — the card-id collision

- **Date:** 2026-08-30
- **Status:** design, ready for a plan
- **Author:** Claude Code
- **Scope:** planning only. No application code for this epic.
- **Predecessor:** `2026-08-30-custom-decks-sync.md` (#197–#201), whose §2.5 and decision D2 recorded
  this collision and contained it rather than fixing it.

---

## 1 · What this is

`learnedWords` is keyed by **card id alone**, and a card id is the German word itself
(`packs/de/index.js:21` — `const cardId = (card) => card.de`). SRS is deck-scoped
(`srs.js:35` — `srsKey = (deckId, id) => \`${deckId}:${id}\``); mastery is not. So learning a word in
one deck marks it learned in every other deck that contains it.

This epic gives mastery the deck dimension SRS already has, **without any learner losing progress**,
across a fleet of offline-first devices that will be running two different app versions at once.

---

## 2 · Ground truth (verified 2026-08-30, against code, the shipped lexicon, and production)

**Four of the assumptions behind this epic's framing did not survive.** One removes the headline
risk, one makes the bug far larger than "custom decks polluting curated", one shrinks the blast
radius, and one relocates the real hazard entirely.

### 2.1 `learnedWords` is UNION-merged, not last-write-wins

The brief's central worry — that LWW merges during the rollout window will clobber progress — does
not apply to this field. `mergeSettings` carves it out explicitly (`sync/merge.js`):

```js
// learnedWords: union — a word stays learned if either device has it (#41).
learnedWords[word] = Boolean(lw?.[word] || rw?.[word]);
```

Key-wise union with a Boolean OR. Two devices on different app versions writing **different key
spaces** (`Hallo` vs `greetings:Hallo`) do not fight: the union simply carries both.

This has a second consequence that shapes the whole plan: **you cannot delete a key from a
union-merged map while any device still holds it.** The other device's next push resurrects it.
That is the same problem tombstones solved for decks, and it is why §6 defers pruning rather than
attempting it now.

### 2.2 The collision is already pervasive in production — it is not a custom-deck problem

Measured against the shipped lexicon (`public/lexicon/de`, 4,288 index rows / 4,294 entries) over
exactly the decks that can mark a word learned (§2.4):

| | |
| --- | --- |
| distinct card ids across those decks | **4,243** |
| ids appearing in **more than one** of them | **1,064 — 25.1%** |
| worst offenders | `Einer` and `Seele` in **8** decks each, `Es` in 7 |
| curated cards (40) that also live in an auto deck | **13** |

`zwei` is in `core-100`, `top-500`, `cefr-a1` **and** `curated:numbers`. Learning it in Numbers
marks it in all four today.

**So this is a live defect affecting a quarter of the vocabulary**, not a hypothetical introduced by
custom decks. The predecessor spec framed it as the latter; that framing was too narrow.

### 2.3 `learnedWords` drives no gamification — the blast radius is display only

Traced every reader. It feeds exactly three things:

1. `stats.learnedCount` — a number on `LevelCard` and `StatsTab`.
2. The green dots in `ui/DeckProgress.jsx` and the "✓ LEARNED" badge in `VocabTab`.
3. `deckProgressFor` → the `deck-unfinished` mission (#196).

It feeds **no XP, no level, and no achievement**. `gamificationContext` reads `daily` and `srs`
only, and the `words25`/`words50` badges test `masteredCount`, which comes from
`getMasteredCount(srs)` — **already deck-scoped**.

That matters for rollout risk: a transient double-count during the transition is a wrong number on
a card, not a route to unearned badges or XP. It is worth fixing properly, but it is not an
economy exploit, and the plan should not buy safety at the price of complexity as if it were.

### 2.4 Only four deck groups can mark a word learned

`markLearned` is called from exactly two places, both in the meaning drill
(`VocabTab.jsx` — `checkTyped` and `chooseOption`). The seven drill groups — Artikel, Plural,
Perfekt, Präsens, Präteritum, Gegenteil, Hören — deliberately never call it
(`vocab/drills.js`: *"knowing a noun's gender or a verb's participle is not knowing the word"*).

So the affected surface is **Curated, Frequency, CEFR, Topics**, plus custom decks. That is the
population the §2.2 numbers are measured over.

### 2.5 The real hazard: `settingsToRow` is an explicit allowlist

This is where the rollout risk actually lives, and it is not in the merge at all.

```js
export function settingsToRow(local, level, levelUpdatedAt) {
  return { data: { goal, soundOn, achievements, lastGoalMet, frozenDays, bestStreak,
                   lastReconcileDay, learnedWords, level, levelUpdatedAt, settingsUpdatedAt } };
}
```

An old client serialises **only these fields**. Any new key placed inside `settings.data` is
therefore **erased from the server by the next push from any old device** — regardless of
timestamps, and regardless of what the merge does, because the old client never had the key to
merge in the first place.

**So a deck-scoped map must not live inside `settings.data`.** §5 places it where an old client
cannot reach it.

### 2.6 SRS can attribute the existing data — 100% of it, on the whole production dataset

`recordVocabAnswer(deckId, card.id, verdict)` writes an SRS row keyed `deckId:cardId`, and
`advanceQueue` is called from **`handleSrsVerdict` alone** — there is no other path to the next
card. A learner cannot progress through a deck without leaving deck-scoped SRS rows behind.

Queried against production (counts only, no vocabulary content):

| | |
| --- | --- |
| `learnedWords` keys set true | 39 |
| attributable to a deck via an existing SRS row | **39** |
| unattributable | **0** |
| cards whose SRS rows span >1 deck | 0 |

**Every learned word in production can be attributed to the deck it was learned in**, from data
already synced. Caveat stated honestly: this is the entire production population, but it is one
account, and `markLearned` fires at answer time while the SRS row lands on the verdict press — so
the last card answered before leaving a session can be learned-but-unattributed. The gap is
bounded at roughly one card per session, and §4 never drops what it cannot attribute.

### 2.7 Summary

| Question asked | Verified answer |
| --- | --- |
| Will LWW clobber progress during rollout? | **No** — `learnedWords` is union-merged (§2.1). |
| Is this a custom-deck problem? | **No** — 25.1% of the lexicon already collides (§2.2). |
| Can existing progress be attributed? | **Yes** — 39/39 in production, via SRS (§2.6). |
| Where is the actual rollout hazard? | An old client's allowlist push **erases** new fields (§2.5). |
| Can we clean up the old map during rollout? | **No** — union merge resurrects deleted keys (§2.1). |

---

## 3 · Design A — the new shape

### 3.1 `learnedByDeck`

```
learnedByDeck = {
  greetings: { "Hallo": true, "Guten Tag": true },
  "cefr-a1":  { "zwei": true },
  custom:     { "die Sonne": true }
}
```

Deck id → card id → `true`. Deliberately the same two-level shape as the SRS key it mirrors, and
deliberately **not** a flat `"greetings:Hallo"` string key: nesting makes "everything learned in
this deck" a single lookup, which is what `DeckProgress`, `deckProgressFor` and the per-deck count
all want, and it makes a whole deck's entry removable when a custom deck is deleted.

Only `true` is stored. `markLearned` currently **toggles** (`!prev[word]`), which can write `false`;
the new writer stores presence and deletes on unset, so a key's existence is the whole answer and
`Object.keys(...).length` is a correct per-deck count.

### 3.2 `learnedWords` stays, unchanged and authoritative-by-fallback

The flat map is **not** removed, **not** renamed, and **not** pruned in this epic (§2.1 makes
pruning impossible while old clients exist, and §6 defers it). It remains exactly what it is today
so that an old device keeps working untouched.

### 3.3 The read

```
isLearned(deckId, cardId) = learnedByDeck[deckId]?.[cardId] === true
                         || learnedWords[cardId] === true
```

A dual read, scoped first, legacy second. Its behaviour during the transition is worth stating
plainly rather than discovering later:

- A word learned **before** the migration and attributed by §4 appears learned in its own deck via
  the scoped map — correct.
- A word learned **before** the migration and *not* attributable still appears learned in **every**
  deck containing it, exactly as today. Not a regression; simply not yet fixed.
- A word learned **after** the migration is scoped, and marks only its own deck.

So the collision decays as learners re-answer, and no learner ever sees a word un-learn itself.

### 3.4 `markLearned` gains a deck

`markLearned(cardId)` → `markLearned(deckId, cardId)`. App does not know the deck; VocabTab does and
already passes `deckId` to `recordVocabAnswer` and `recordItem` beside every `markLearned` call, so
this is a one-argument change at two call sites.

---

## 4 · Design B — migrating existing data

### 4.1 Backfill by SRS attribution, once, locally

On first run of the new version, for every `learnedWords[cardId] === true`:

```
decks = { deckId | srs has an entry keyed `${deckId}:${cardId}` }
for each deckId in decks:  learnedByDeck[deckId][cardId] = true
```

Nothing is read from the network, nothing is written to the flat map, and **nothing is deleted**.
Measured coverage on the whole production dataset: 39 of 39 (§2.6).

A card with no SRS row is left to the §3.3 fallback. That is the lossless choice: we cannot recover
an attribution that was never recorded, and inventing one — fanning the word out to every deck that
contains it — would bake today's wrong answer permanently into the new shape.

### 4.2 Idempotent, and re-runnable

Stamp `learnedByDeckMigratedAt` alongside the map. The backfill is a union into existing data, so a
second run is a no-op — but the stamp keeps it off the hot path and makes "did this device migrate"
answerable in a bug report.

**It must be re-runnable, not once-ever**: a device that migrates, then syncs with an old device
that has since learned twenty more words, has twenty new flat keys to attribute. The backfill
should run whenever a pull brings in flat keys that postdate the stamp.

### 4.3 What a learner sees

Nothing. Counts and dots are identical the moment after migration, because the dual read returns the
same answer for every existing word. The change only becomes visible as *new* learning stops
leaking across decks.

---

## 5 · Design C — the transition window (the crux)

### 5.1 Where the new map lives: a separate column, not `settings.data`

Per §2.5, anything inside `settings.data` is erased by the next old-client push. So:

```sql
alter table public.settings add column if not exists learned_by_deck jsonb;
```

An old client's upsert names only `(user_id, data)`, and PostgREST's
`ON CONFLICT DO UPDATE SET <provided columns>` leaves every other column **untouched**. The old
client therefore cannot erase `learned_by_deck` — not because it chooses not to, but because it
never names it.

This is the same mechanism the deck-tombstone work relied on, and the same one whose absence made a
fixture unfalsifiable there (#201). The test for it is named in §7.

**No RLS or grant change.** `settings` already carries own-row select/insert/update for
`authenticated` and nothing for `anon`; a new column inherits the table's policies.

### 5.2 The merge: union per deck

`learnedByDeck` gets its own merge, mirroring `learnedWords`' union rather than the row LWW:

```
mergeLearnedByDeck(local, remote) → union of deck ids;
                                    per deck, union of card ids; value = OR
```

Union is right for the same reason it is right for the flat map: a word learned on either device is
learned. There is no scenario where one device legitimately *un*-learns a card, so nothing needs a
tombstone here — the epic's one genuine deletion case (a removed custom deck) drops that deck's
whole entry locally and is covered by deck deletion, which already tombstones.

### 5.3 Both directions of the mixed fleet

| | Device A (new) | Device B (old) |
| --- | --- | --- |
| writes flat `learnedWords` | yes — still mirrored, so B keeps working | yes |
| writes `learnedByDeck` | yes, in its own column | no — never names it |
| reads `learnedByDeck` | yes | no — ignores the column |
| effect of B's push on A's data | **none** (column untouched) | — |
| effect of A's push on B's data | none — flat map is union-merged | — |

**A keeps mirroring every scoped write into the flat map** for the duration of the transition. That
is what stops B from silently regressing: a word learned on the new device still lights up on the
old one. The mirror is the cost of the transition and it is exactly what §6 removes at the end.

The consequence, stated rather than hidden: **while any old device is active, the flat map keeps
growing and the collision keeps applying on that device.** New devices are correct; old devices are
no worse than today. That is the best available outcome, because making old devices correct would
require shipping code to them, which is the thing we cannot do.

### 5.4 Why not a table, an RPC, or a version gate

- **A new `learned_state` table** would also be old-client-proof, but it is a whole table, its own
  RLS policies, its own slice in `pullAndMerge`, and its own export/delete-cascade obligations —
  for a single jsonb value that belongs to the settings row.
- **An RPC** puts merge logic in SQL, giving the union two implementations. `leagueZones.js` exists
  because that goes wrong.
- **Refusing to sync until every device updates** is not available: there is no device inventory and
  no forced-update channel.

---

## 6 · The end of the transition (deliberately deferred)

Once no old clients remain, a follow-up epic can:

1. Stop mirroring scoped writes into the flat map.
2. Prune attributed keys from `learnedWords`.
3. Drop the dual read.

**None of it can happen now.** §2.1: deleting a key from a union-merged map does not stick while any
device still holds it — the next push brings it back. This is the same shape as deck deletion, and
if the flat map ever needs true deletion it needs the same answer: tombstones.

The trigger is a decision about a support window, not a technical one, so it is not in this spec.

---

## 7 · Testing

- `mergeLearnedByDeck` — pure. Deck present on both sides with different card sets; deck on one side
  only; a card on one side only; the fixture must contain **two decks and two devices**, or "the
  other deck was left alone" cannot be expressed.
- **The erasure test, and it must be staged red.** Simulate an old client's push — a settings upsert
  naming only `(user_id, data)` — and assert `learned_by_deck` survives. Write it first against a
  version that stores the map inside `settings.data` and watch it **fail**; otherwise it is a test of
  a column that never saw the bug. This is the single most important test in the epic (§2.5).
- **Backfill attribution** — a fixture with a card in two decks' SRS, a card in one, and a card in
  none; assert the first two are attributed and the third is left to the fallback, still learned.
- **Backfill is re-runnable** — run it, add flat keys as an old device would, run again, assert the
  new ones are attributed and nothing is duplicated or lost.
- **Dual read** — a legacy-only card reads learned in every deck; a scoped card reads learned in its
  own deck; assert a scoped card does **not** read learned in a sibling deck that shares the id.
  Use a real colliding id from §2.2 (`zwei`), not an invented one.
- **The count stops double-counting** — the whole point. Assert `learnedCount` for a learner with
  both `zwei` and `numbers:zwei` is 1, not 2.
- **No gamification movement** (§2.3) — assert XP, level and earned achievements are byte-identical
  before and after a migration. It should be impossible; assert it, because it is the claim that
  makes the rollout low-risk.

---

## 8 · Phasing

| # | PR | Migration | Visible to a learner? |
| --- | --- | --- | --- |
| 1 | `settings.learned_by_deck` column + adapter + `mergeLearnedByDeck` + the erasure test | **one** | no — engine only, nothing reads it |
| 2 | Backfill from SRS + `learnedByDeck` written on `markLearned(deckId, cardId)`, mirrored to the flat map | none | no |
| 3 | Dual read in DeckProgress, VocabTab, `deckProgressFor`, `learnedCount` | none | yes — the fix lands |
| 4 | *(deferred, §6)* stop mirroring, prune, drop the fallback | none | no |

1 → 2 → 3 strictly ordered, and **1 must be deployed and its migration applied before 2 ships**, for
the reason #201 established: the client would otherwise write a column that does not exist, and
`sync.js` does not check upsert errors, so it would fail silently.

---

## 9 · Open questions

1. **Does the `deck-unfinished` mission adopt the scoped map in phase 3, or later?** It currently
   reads `PRESET_DECKS` only (#201's D2 containment). Scoped data makes it correct for auto decks
   too, but that changes a number on Home and deserves its own call.
2. **Should auto decks share a namespace with the lexicon rather than their deck id?** `cefr-a1` and
   `top-500` overlap heavily by design (§2.2), and a learner may reasonably expect a word learned in
   A1 to count in Top 500 — they are views over one lexicon, not different material. That is a
   product question, and getting it wrong in either direction is invisible until someone complains.
3. **When does the transition end (§6)?** Needs a support-window decision, not a technical one.
4. ~~**Should `markLearned` stop toggling?**~~ **FIXED — see the correction below.**

   The bug was real: `markLearned` wrote `!prev[word]`, so meeting a card a second time and
   answering correctly *un*-learned it.

   **The reproduction path first written here was wrong**, and is corrected for the record: a
   CORRECT answer offers only HARD/GOOD/EASY — `VerdictPanel` shows AGAIN *only* for a wrong
   answer — so "answer correctly → AGAIN → answer correctly again" is not reachable. A correct
   answer always removes the card from the queue.

   The real path is a **rebuilt** queue: answer correctly, leave the deck (or the session), come
   back, and `getDueCards` offers the card again from SRS. Answering correctly then flipped it to
   `false`. Fixed by setting rather than toggling, with an App-level regression test that fails
   against the old implementation.
