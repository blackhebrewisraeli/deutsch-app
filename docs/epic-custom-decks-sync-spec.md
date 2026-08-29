# Custom Decks — Persistence & Sync Engine

- **Date:** 2026-08-30
- **Status:** design, ready for a plan
- **Author:** Claude Code
- **Scope:** planning only. No application code for this epic.
- **Predecessor:** `superpowers/specs/2026-08-30-data-integration-epic-design.md` (#195/#196),
  whose §2.2 flagged this as the largest live gap found: a generated deck does not survive a
  reload, and #194's export now has a `decks` key that will stay empty until something writes it.

> **Filing note.** Every other spec in this repo lives at
> `docs/superpowers/specs/YYYY-MM-DD-*.md`. This one sits at the path named in the request. Happy
> to move it to the convention on merge — say the word.

---

## 1 · What this is

A learner types a topic, waits for Claude to generate ten cards, drills a few — and loses the deck.
This epic makes the deck survive, and makes it survive on their other device.

The gap is worse than "lost on reload", which is how the predecessor spec recorded it. Verified
below: it is lost on a **tab switch**.

---

## 2 · Ground truth (verified 2026-08-30, against code and the live database)

**Three of the four premises behind this epic did not survive the check.** One makes the work
smaller, one makes it larger, and one moves it to a different layer entirely. Read this section
before the design.

### 2.1 The deck dies on a tab switch, not on reload

`App.jsx:1036` renders the vocab lane as `{tab === 'vocab' && <VocabTab … />}`. VocabTab is
**unmounted** whenever the learner leaves the tab, and the generated deck lives in its component
state:

```js
// VocabTab.jsx:43
const [customCards, setCustomCards] = useState(null);
```

So the deck is destroyed by opening Chat and coming back — no reload required. Anyone reproducing
"it vanishes on reload" is reproducing the mild version.

### 2.2 The `decks` table needs NO schema, RLS or grant changes

Asked as an open question; the answer is no, and it is verified against the live database rather
than the migration files.

```sql
create table public.decks (
  user_id uuid not null references auth.users(id) on delete cascade,
  pack_id text not null default 'de',
  deck_id text not null,
  name    text not null,
  cards   jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  primary key (user_id, pack_id, deck_id)
);
```

Live `pg_policies` on `public.decks` — all four verbs, all `auth.uid() = user_id`:

| cmd | using | with check |
| --- | --- | --- |
| SELECT | `auth.uid() = user_id` | — |
| INSERT | — | `auth.uid() = user_id` |
| UPDATE | `auth.uid() = user_id` | `auth.uid() = user_id` |
| DELETE | `auth.uid() = user_id` | — |

Live `role_table_grants` — `authenticated: DELETE, INSERT, SELECT, UPDATE`; `service_role`: full;
**`anon`: no row at all.** The table was built for exactly this feature and then never used:
`select count(*) from public.decks` → **0**.

The primary key already includes `deck_id`, so the schema anticipates **many** decks per user, not
the one slot the UI exposes. That matters in §4.

### 2.3 The sync engine has never deleted anything — and cannot

This is the hard part of the epic, and it is not visible from the outside.

`pullAndMerge` covers three tables and every write is an **upsert**:

| slice | merge strategy | shrinks? |
| --- | --- | --- |
| `srs_state` | per-card LWW on `lastReviewed` | never |
| `stats_daily` | additive delta against a `lastSynced` baseline | never — counters are monotonic |
| `settings` | whole-blob LWW, with per-field carve-outs | never |

All three are grow-only by nature, so the engine has never needed to express "this record is
gone". A deck is the first syncable thing a learner can **remove**, and in an upsert-only engine a
deletion on device A is silently undone by device B's next pull, which still holds the row and
re-upserts it. Deletion is not a small extra verb here; it is a new capability for the engine.

§4 phases around this rather than bolting it on.

### 2.4 Most of the reported bug is not a sync bug

Sync is off for signed-out learners (`SYNC_ENABLED && user?.id`), and it is off entirely unless
`VITE_SYNC_ENABLED` is true. But the deck vanishes for **everyone**, signed in or not, because it
never reaches `localStorage` at all.

**So the fix for the reported symptom is a local-persistence fix, and the sync lane is the smaller
second half.** Phasing follows that: §7 phase 1 fixes the bug for every learner including guests,
and touches no network code.

### 2.5 `learnedWords` is not deck-scoped, and card ids are German words

Two facts that combine badly:

```js
// packs/de/index.js:21
const cardId = (card) => card.de;      // the card id IS the German word
// srs.js:35
srsKey = (deckId, id) => `${deckId}:${id}`;   // SRS *is* deck-scoped
```

`learnedWords` is keyed by **card id alone** — no deck prefix. SRS is safe (`custom:Hallo` ≠
`greetings:Hallo`); mastery is not. A generated "Greetings" deck containing `Hallo` shares its
learned flag with the curated `greetings` deck.

Today that is ephemeral, because the deck evaporates. **Persisting the deck makes the collision
permanent**, and it now feeds the `deck-unfinished` mission shipped in #196, whose D2 guard
(`deckProgress.test.js`) asserts disjoint card ids across *curated* decks only. Custom decks will
violate that assumption by construction — the guard will not fail, because it does not look at
them.

§6 says what to do about it.

### 2.6 Summary

| Question asked | Verified answer |
| --- | --- |
| Adjust RLS for deck CRUD? | **No.** All four policies and all four grants already exist, live. |
| New table or columns? | **None for phase 1.** One nullable column in phase 3, for deletes. |
| How does local state sync? | A fourth slice in `pullAndMerge`, per-deck LWW on `updated_at`. |
| How does it behave offline? | Exactly as the other slices do — see §5. Deletes are the exception. |
| Is this mainly a sync problem? | **No** — it is a local-persistence problem first (§2.4). |

---

## 3 · Design A — local persistence (phase 1)

### 3.1 Lift the deck out of component state

`customCards` moves from VocabTab into the state blob, which is the app's offline source of truth
and already survives reload, tab switches and sign-out-less restarts:

```
state.decks = {
  custom: { deckId: 'custom', name: 'Weather', cards: [...], updatedAt: 1756... }
}
```

Keyed by `deckId`, mirroring the table's `(user_id, pack_id, deck_id)` primary key so the adapter
in §4.1 is a rename rather than a reshape.

VocabTab keeps reading a `customCards`-shaped value; it just receives it from App instead of
owning it. That keeps the change to VocabTab small and keeps the blob's single-writer discipline
(`saveState({ ...state, … })`) intact.

### 3.2 Keep the single slot in phase 1

Today there is exactly one custom deck: `deckId === 'custom'`, replaced whenever the learner
generates again. **Decision D1: phase 1 persists that model unchanged** — same UX, same one slot,
now durable.

It is tempting to widen to a named collection immediately, since the table's primary key already
allows it (§2.2). Deliberately not, because a collection is the feature that creates *deletion*,
and deletion is what the sync engine cannot express (§2.3). Widening and syncing at once would
land the epic's hardest problem in its first PR. Phase 4 widens it, on top of a merge path that is
already proven.

The cost of D1 is honest and small: generating a new deck still discards the previous one, exactly
as it does today. No learner loses anything they have today; they stop losing what they have now.

### 3.3 Blob size

`loadState` is called ~29 times per render cycle and the blob is already ~330 KB on a mature
account (its own comment measures the parse at 6.9 ms desktop / ~30 ms mobile). One deck of ten
cards is ~2 KB — noise. A *collection* is not necessarily noise, which is a second reason to hold
D1 until phase 4, and a cap belongs in that design.

---

## 4 · Design B — the sync lane (phase 2)

### 4.1 A fourth slice in `pullAndMerge`

New pure adapters in `sync/adapters.js`, matching the three that exist:

```
decksToRows(decks)   → [{ deck_id, name, cards, updated_at }]   (engine adds user_id, pack_id)
decksFromRows(rows)  → { [deckId]: { deckId, name, cards, updatedAt } }
```

and a new merge in `sync/merge.js`:

```
mergeDecks(local, remote) → union of deck ids; per deck, newer updatedAt wins; tie → remote
```

**Per-deck LWW, not whole-slice LWW.** This is `mergeSrs`'s shape, not `mergeSettings`'s, and the
reason is the regression `mergeSettings` already carries a carve-out for: whole-object LWW lets an
unrelated newer write on one device clobber a field the device never touched (the 2026-08-24 level
clobber). A deck is an independent record with its own primary key; it gets its own clock. Ties
resolve to remote, matching `mergeSrs`.

`updatedAt` is set locally when a deck is generated. It is the only new local bookkeeping — no
`syncMeta` change, because decks are not delta-summed the way daily counters are.

### 4.2 Where it hooks in

`pullAndMerge` gains a fourth read/merge/write, following the existing order and the existing
re-read-at-write-time discipline (the `cur = loadState()` block exists because the learner can act
during the awaits; decks must be re-merged there too, or a deck generated mid-reconcile is lost).

Generation dispatches the `deutsch:progress` event the app already uses, which is what
`markDirty()` listens to (`App.jsx:503`) — so a new deck pushes on the normal 3-second debounce.
No new trigger, no new listener.

### 4.3 Why not an endpoint

An `api/v1/deck/save` function would need `service_role`, which bypasses RLS for data that is
purely the caller's own. The Data API path is already authorised for exactly this (§2.2), already
used by the other three slices, and keeps writes inside the RLS envelope. **No new endpoint.**

---

## 5 · Offline / online behaviour

### 5.1 There is no offline queue, and decks should not add one

The engine's offline story is structural rather than explicit:

- `localStorage` is the source of truth and is written **synchronously, before any network call**.
- `reconcileNow` swallows failures (`catch { setStatus(…) }`), so a failed sync is invisible and
  non-destructive.
- Three triggers retry it: `start()` on sign-in, `visibilitychange` on every tab focus, and the
  `markDirty()` debounce.
- `pullAndMerge` is idempotent — LWW re-merges to the same answer, and the additive slice is
  guarded by its `lastSynced` baseline.

So the offline path for decks is: **the deck is saved locally and drilled normally; the row appears
in Supabase the next time a reconcile succeeds.** No queue, no retry timer, no new state. This is
the whole answer for phases 1–2, and it is worth stating plainly that "nothing new" is the design,
not an omission.

Reconciles are serialised by the `reconciling`/`rerunRequested` guard, so a deck generated while a
reconcile is in flight is picked up by the requested rerun rather than racing it.

### 5.2 The one case that genuinely breaks: deletion offline

Two devices, deck `custom` on both:

```
device A (offline):  learner deletes the deck   → local row gone
device B (online):   idle, still holds the deck → row still in Supabase
device A comes back online → pull returns the deck → union-merge re-adds it
```

Under an upsert-only engine with union semantics, **an offline delete always loses**. This is not a
bug to be fixed in the merge function; union is correct for every slice that exists today.

The fix is a tombstone — the row must be able to say "deleted at T" so LWW can compare a deletion
against an edit:

```sql
alter table public.decks add column deleted_at timestamptz;
```

with `decksFromRows` skipping rows whose `deleted_at` is set, and `mergeDecks` treating a
tombstone as an ordinary LWW candidate. **That is the epic's only migration, and it belongs to the
phase that introduces deletion — not before it.** Until a learner can delete a deck, there is
nothing to tombstone, and adding the column early would be unused schema.

Retention (when a tombstone may be hard-deleted) is a phase-3 design question, flagged in §9.

### 5.3 Conflict, stated honestly

Two devices generating a different deck into the same `custom` slot while offline: the later
`updatedAt` wins and the other is discarded, with no merge and no prompt. For a regenerable
ten-card deck that is the right trade. It becomes a worse trade once decks are named and
accumulate, which is a third reason phase 4 is separate.

---

## 6 · The `learnedWords` collision (§2.5)

Persisting custom decks turns a transient collision into a permanent one, and #196's
`deck-unfinished` mission now reads that data.

Three options:

1. **Deck-scope `learnedWords`** — correct, and a breaking change to a synced field with existing
   production data. Needs its own migration-of-blob-shape design. Out of scope here.
2. **Exclude custom decks from `deckProgressFor`** — the mission stays about curated decks, which
   is what its §3.2 decision D1 already says. One line at the call site, no data change.
3. **Do nothing** — the count silently double-marks. Rejected.

**Decision D2: option 2 for this epic**, plus widening the existing disjoint-ids guard to assert
that a *persisted custom* deck cannot affect curated counts. Option 1 is recorded as its own future
epic in §9 — it is the real fix, and it is not this epic's fight.

---

## 7 · Phasing

| # | PR | Migration | Fixes the reported bug? |
| --- | --- | --- | --- |
| 1 | Lift `customCards` into `state.decks`; VocabTab reads from App | none | **Yes — for every learner, including guests** |
| 2 | `decksToRows`/`decksFromRows`/`mergeDecks` + fourth slice in `pullAndMerge` | none | cross-device |
| 3 | Deletion: `deleted_at` tombstones, merge + adapter handling | **one** | — |
| 4 | Collection: many named decks, cap, delete UI | none | — |

1 → 2 → 3 → 4 are strictly ordered. **Phase 1 is independently shippable and is the one the user
actually reported**; if the epic stalls after it, the reported bug is still fixed.

---

## 8 · Testing

- `mergeDecks` — pure, and the fixture must contain a deck present on **both** sides with
  **different** `updatedAt` on each, plus one local-only and one remote-only. A fixture with one
  deck per side cannot express "the older side lost" and will pass against a merge that simply
  spreads both objects.
- **Prove the tie rule.** `mergeSrs` resolves ties to remote; assert `mergeDecks` does too, with
  equal timestamps — a `>=` slip is invisible otherwise.
- `decksToRows`/`decksFromRows` round-trip, including a deck with zero cards.
- **The re-read-at-write-time path** (§4.2): generate a deck *during* a reconcile's awaits and
  assert it survives. That block exists because of a real class of bug and a fourth slice is a new
  chance to get it wrong.
- **Phase 3 must assert the resurrection case directly**: delete locally, pull a remote row that
  still has the deck, and assert it stays deleted. Write it against the phase-2 merge first and
  watch it **fail** — otherwise it is a test of the tombstone that never saw the bug.
- Guest path: with sync disabled, assert the deck persists across a remount and that **no network
  call is issued** — phase 1's value is exactly that it works with the engine switched off.
- Widen `deckProgress.test.js`'s D2 guard per §6.

---

## 9 · Open questions

1. **Should `learnedWords` become deck-scoped?** §6 defers it; it is the correct fix and a
   migration of a live synced blob. Its own epic, and arguably the next one after this.
2. **Tombstone retention.** How long does a `deleted_at` row live before a hard delete, and what
   deletes it — a cron, or the next reconcile from the deleting device? Needed before phase 3.
3. **A cap on the collection** (phase 4). Cards are unbounded `jsonb` and `authenticated` can write
   the table directly, so the `/ai/deck` rate limit (5/hour) is not the only path in. A `CHECK` on
   `jsonb_array_length(cards)` plus a per-user row cap is cheap insurance — but it is a phase-4
   question, not an RLS gap.
4. **Does a custom deck belong in the SRS due count?** `getDueCount` walks `PRESET_DECKS` today. A
   persisted deck arguably should count; that changes a number on Home and deserves its own call.
