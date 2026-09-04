# E4 — client adoption: queued events, the RPC as the only writer

- **Date:** 2026-09-04
- **Status:** design, decisions locked, plan at `docs/superpowers/plans/2026-09-04-e4-client-adoption.md`
- **Author:** Claude Code (spec); Cursor (plan, from owner-locked decisions)
- **Predecessor:** `2026-09-04-data-driven-engine.md` (E1–E3, shipped as #235). Its §13 Q3 refused to fold E4 in and named what a second spec must cover: "sync adapter off, merge tests, offline queue."
- **Owner decision on record (2026-09-04):** of the three shapes put to the owner — queue events, keep sync unchanged, or RPC-only-when-signed-in — the owner chose **queue events, RPC is the writer**, explicitly to preserve offline play for signed-in learners.
- **Owner follow-ups (2026-09-04), locking §7:** flush the guest backlog on sign-in; 30-day rolling dedupe window, classified in `EXCLUDED_TABLES`; correct the false "loses increments" sentence in place.

---

## 1 · The predecessor spec was wrong about the mechanism, and the correction changes the epic

E1–E3 §7.3 states:

> | B2 sync adapter | Last-write-wins on the whole `counters` object via `updated_at` | Live for signed-in users |
>
> Enabling both on the same client will lose increments.

**That is not what the code does.** `src/lib/sync/merge.js:51`:

```js
export function mergeDailyAdditive({ local, server, lastSynced }) {
  const delta = clampCounters(subCounters(local, lastSynced));
  return { server: addCounters(server, delta), lastSynced: local };
}
```

The daily slice is a **three-way additive delta merge** against a baseline
(`lastSyncedCounters`, stored in `deutsch-app-sync-meta-v1`), not last-write-wins.
Whole-object LWW is `mergeSettings`, a different slice; the predecessor
conflated the two.

The consequence inverts. With both writers live, one answered card:

| step | local | baseline | server |
| --- | --- | --- | --- |
| `recordEvent` → `applyEvent` | `L+1` | `S` | `S` |
| POST `/progress/events` → RPC | `L+1` | `S` | `S+1` |
| next reconcile pushes `delta = (L+1) − S = +1` | — | — | **`S+2`** |

**Double-counting, not loss.** A plan written from the predecessor would have
been engineered against a failure that cannot happen while walking into one that
will. Every "lose increments" sentence in E1–E3 §7.3, `docs/api/progress.md`, and
the `api/v1/progress/events.js` header is wrong in the same way and must be
corrected by this epic, not repeated.

### 1.1 The deeper mismatch

The RPC is **event-shaped** — one `(dateKey, tab, level, verdict, bonusXp)`.
Sync is **aggregate-shaped** — a counter delta against a baseline. A delta cannot
be decomposed back into events, so the two models do not compose for free.
Bridging them is the whole of E4, and it is why "just point sync at the RPC"
is not available.

---

## 2 · Ground truth (verified 2026-09-04 against `main` @ `344ffa7`)

1. **`recordEvent(tab, level, verdict)` at `src/lib/stats.js:237` is the single
   funnel.** It computes the streak/level bonus, calls `applyEvent`, `saveState`s,
   and dispatches `deutsch:progress`. It already holds every field the RPC takes:
   `todayKey()`, `tab`, `level`, `verdict`, `bonus`. One insertion point, not a
   scattered set of call sites.
2. **`localStorage` is the offline source of truth** — `src/lib/sync.js:2` says so
   in the file header. This is what the owner's choice protects.
3. **The reconcile both reads and writes the daily slice**: `select()` at
   `sync.js:93`, `upsert()` at `sync.js:109`. **They are separable, and only the
   write is in scope** — see §4.2, which is the single most dangerous thing to get
   wrong in this epic.
4. **Sync is gated on `VITE_SYNC_ENABLED`**, driven by `markDirty()` /
   `start(userId)` / `stop()`.
5. **The RPC has no idempotency key.** `apply_progress_event` is unconditionally
   additive; the same call twice adds twice. §4.1 is entirely about that.
6. **`stats_daily` in production currently holds 13 rows** for one learner. Any
   migration or backfill this epic proposes is operating on a small, real dataset —
   cheap to reason about, and cheap to get wrong invisibly.

---

## 3 · Design

### 3.1 The shape

```
answer → recordEvent
           ├─ applyEvent → saveState        (unchanged; instant local UI)
           └─ enqueue({dateKey,tab,level,verdict,bonusXp,id})

flush (online + signed in)
           └─ POST /api/v1/progress/events, one per queued event
                └─ 200 → drop from queue

reconcile  └─ daily: PULL only. The upsert is removed.
```

`applyEvent` keeps writing locally. That is deliberate: it is what makes the UI
instant and what keeps a signed-out or offline learner working exactly as today.
The queue is the only new state, and the RPC becomes the only writer of
`stats_daily`.

### 3.2 What must not change

- **Signed-out learners**: no JWT, no POST, no queue flush. Behaviour identical to
  today. The queue may still accumulate (§4.3 decides), but nothing is sent.
- **`applyEvent`, `normalizeDayAggregate`, `counters` shape, `xpForDay`**: untouched.
- **The other sync slices** — srs, settings, decks, learnedByDeck — untouched. This
  epic touches the daily slice only.

---

## 4 · The three problems that make this hard

### 4.1 Idempotency — the load-bearing one

The queue gives at-least-once delivery. The RPC is additive. **At-least-once plus
additive is double-counting**, which is the exact bug this epic exists to avoid —
reintroduced through the back door by a retry.

A POST that times out, or succeeds and loses its response, leaves the client
unable to tell "applied" from "not applied". Dropping on send is at-most-once and
silently loses progress; retrying is at-least-once and silently inflates it.

**Decision: the event carries a client-generated `id`, and the server dedupes on
it.** This costs a stored key, which E1–E3 forbade — but that constraint governed
E1–E3, whose whole point was adding no state. Here the alternative is a known
data-corruption path, and correctness outranks the earlier slice's minimalism.

**Locked (2026-09-04):** `progress_events_seen (user_id, event_id, created_at)`
with primary key `(user_id, event_id)`. The RPC inserts into it first and
returns the existing counters unchanged on conflict. It is user-owned
(`user_id` → `auth.users` `on delete cascade`) and is classified in
**`EXCLUDED_TABLES`**, not exported: the keys are opaque idempotency tokens,
and the learning data they protect is already exported as `daily`.

**Retention: 30-day rolling window, opportunistic prune inside the RPC, no new
cron.** After a successful insert the writer deletes this user's rows with
`created_at < now() - interval '30 days'`. No new Vercel function and no new
cron — the Hobby plan is already at the 12-function cap, which is why the
progress lane is one dispatched file. A global cron would also prune a device
that has been offline for 31 days and then replay its queue; per-user prune
on write only runs when that user writes, so an offline device's seen rows
stay until it next lands an event. The accepted edge: two devices, one
offline >30 days, the other writing daily, can prune the offline device's
ids. At this scale that is cheaper than a 13th function.

### 4.2 Remove the push, keep the pull

The reconcile currently `select()`s remote daily and folds it into local. **If the
daily slice is removed from the reconcile wholesale, a second device's progress
never reaches this one** and multi-device silently regresses to per-device
progress — invisible in any single-device test, and exactly the class of bug that
ships green.

Only the `upsert` at `sync.js:109` is removed. The `select` and the local adoption
stay. The plan must carry a test that fails if the pull is dropped: two devices,
one records, the other reconciles and sees it.

Once the push is gone, `lastSyncedCounters` is vestigial **for the daily slice**.
It must not be deleted outright — the plan must confirm nothing else reads it
before touching `syncMeta.js`, and prefer leaving it inert over a speculative
cleanup in the same PR.

### 4.3 Events recorded while signed out

A learner plays signed out, then signs in. Today those days reach the server on the
first reconcile, because the delta merge pushes whatever local holds. With the push
removed, they no longer do.

The plan must decide, and the decision is user-visible either way:

- **Flush the backlog on sign-in** — preserves today's behaviour, but every
  pre-account answer becomes a queued event, and the queue may be large.
- **Drop the backlog and accept a one-time reconciliation push on sign-in** — a
  single aggregate write, contradicting "the RPC is the only writer".
- **Accept the loss** — silently discards guest progress at the moment of sign-up,
  which is the worst possible moment.

**Locked (2026-09-04): flush the guest backlog on sign-in. Never silently
discard guest progress at account conversion.** `recordEvent` enqueues even
while signed out. Flush runs only with a JWT. Pre-E4 aggregate-only days
(local `daily` with no queued events) are expanded into synthetic events from
`clamp(sub(local, add(remote, queueAsCounters)))` so the RPC remains the only
writer and leftover guest counters still land. The pairing of tab × level ×
verdict is not recovered — only the aggregate is — which is what `stats_daily`
stores.

---

## 5 · Testing

- **Stage the double-count red.** Before the push is removed, a test must show that
  a queued event plus a reconcile produces `+2` for one answer. If it cannot be made
  to fail that way, the premise in §1 is wrong and the epic stops.
- **Idempotency has teeth**: POST the same event id twice, assert the counters move
  once. Prove it by removing the dedupe and watching the test fail.
- **The pull survives**: device A records, device B reconciles, B sees A's counters.
  Prove it by deleting the `select` and watching this fail — §4.2 is otherwise
  invisible.
- **Offline**: queue accumulates with no network, flushes on reconnect, and the
  final server counters equal the sum of the events — not more, not fewer.
- **Signed-out is untouched**: with no session, no POST is attempted and local
  behaviour is byte-identical to today.
- **One writer**: a test that fails if `stats_daily.upsert` reappears anywhere under
  `src/`, mirroring the no-caller guard E3 already ships.
- **Fixtures must be able to express the failure**: a single-event, single-device
  fixture cannot show double-counting or a lost pull. Two devices and a replayed
  event are the minimum.

---

## 6 · Explicitly out of scope

- Reshaping `counters`, storing `totalXpEarned` or `completedQuests`.
- The content lane (`lessons`), which no client code calls yet.
- Migrating the other sync slices to endpoints.
- A general offline mutation queue for settings/decks/srs — this queue is
  progress-only and should not be built as a framework.

---

## 7 · Rulings (owner-locked 2026-09-04; no longer open)

1. **§4.3 — signed-out backlog.** Flush on sign-in. See §4.3 locked paragraph.
2. **§4.1 — dedupe retention.** 30-day rolling window, opportunistic prune in
   the RPC, classified in `EXCLUDED_TABLES`. See §4.1 locked paragraph.
3. **§1 correction is in-place, not a pointer.** Amend E1–E3 §7.3,
   `docs/api/progress.md`, `api/_lib/progressHandlers.js` (the header the
   predecessor named as `api/v1/progress/events.js` — that file was folded into
   the dispatcher during E3 because of the Hobby 12-function cap), and the
   no-caller test comment, so a later reader cannot cite the inverted failure.
