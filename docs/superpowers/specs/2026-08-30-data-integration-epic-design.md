# Core Data & Gamification Integration — lighting up `deck-unfinished` and `league-position`

- **Date:** 2026-08-30
- **Status:** design, ready for a plan
- **Author:** Claude Code
- **Scope:** planning only. No application code for this integration.
- **Predecessor:** `2026-08-29-dashboard-and-settings-design.md` (#190/#193), which shipped
  `lib/missions.js` with these two catalogue entries wired but fed empty inputs.

---

## 1 · What this is

`MissionBoard` ships five working missions. Two more are declared, tested and dormant:

| mission | fires when | fed today |
| --- | --- | --- |
| `deck-unfinished` | a started deck is < 100% | `decks: []` |
| `league-position` | rank is in the demotion zone | `league: null` |

Both were left unfed deliberately — App holds neither per-deck progress nor league standing, and
inventing that data would have been worse than a mission that does not fire. This design says what
it takes to feed them honestly.

---

## 2 · Ground truth (verified 2026-08-30, against code and the live database)

Read this before the design. **Four of the assumptions behind the phrasing "what new Supabase
queries and RPCs are required" did not survive the check**, and they change the work
substantially — in one case to nothing at all.

### 2.1 `deck-unfinished` needs no Supabase work whatsoever

Everything it needs is already in `App`:

- **`learnedWords` is App state.** `App.jsx:79` (`useState({})`), hydrated at `App.jsx:571` from
  stored state, and already synced to the server inside `settings.data.learnedWords`
  (`lib/sync/adapters.js`). No query, no new column, no migration.
- **Deck definitions are in the pack.** `activePack.content.decks` — verified by running it:
  **4 decks (`greetings`, `food`, `travel`, `numbers`), 10 cards each**, cards keyed `id`.
- **The derivation already exists.** `ui/DeckProgress.jsx:14` computes
  `cards.filter((c) => learnedWords[c.id]).length`. `deck-unfinished` needs the same arithmetic
  over all decks rather than the active one.

**So the entire "Supabase integration" for this feature is a pure function over data App already
holds.** The honest amount of backend work is zero.

### 2.2 The `decks` table is dead — 0 rows, no reader, no writer

Queried live: `select count(*) from public.decks` → **0**. Grepping `src/` and `api/` for the
table finds exactly one reference, the export added in #194.

Custom AI-generated decks live in component state only; **the sync engine does not carry them**
(`lib/sync.js` and `sync/adapters.js` mention no deck). So a learner's generated deck does not
survive a reload, let alone reach another device.

Two consequences:

1. **`deck-unfinished` can only mean curated and auto decks today.** A mission about a custom deck
   would be a mission about data that does not persist.
2. **The export fix in #194 will return `[]` until something writes that table.** It is still
   correct — the payload now has an opinion about `decks` — but it is not yet carrying anything.
   Persisting custom decks is a *separate* piece of work, and arguably the more valuable one.

### 2.3 `league_members.rank` is written only at settle — it is NULL during the live week

`api/v1/league/refresh.js` updates **`weekly_xp` only**. `rank` and `result` are written by the
weekly settle cron (`api/v1/league/settle.js:57`, via `leagueLogic.js:33`).

Live check: 2 member rows exist, both ranked — because both belong to a *settled* period. During
the current week the column is null.

**So "am I in the demotion zone right now?" cannot be answered by reading `rank`.** It has to be
derived from the ordering of `weekly_xp` within the cohort, which is exactly what
`LeaderboardSection` does client-side (`zoneCounts(n)` + position in the sorted rows).

### 2.4 The existing leaderboard path is far too heavy for Home

`LeaderboardSection` gets standings by:

```
joinLeague()      POST /api/v1/league/join      ← a WRITE (creates membership)
refreshLeague()   POST /api/v1/league/refresh   ← a WRITE (recomputes weekly_xp)
fetchStandings()  select on league_members      ← a read
```

Two writes and a read, on mount. Home is the **landing tab**, opened every single session. Running
that sequence there would turn every app open into two database writes, and `join` has real
side effects: it can create a league row and a membership.

### 2.5 What RLS already permits

```sql
create policy "read my league rows" on public.league_members
  for select using (public.is_league_member(league_id, auth.uid()));
```

A member may read **every row of a league they belong to** — so cohort standings are readable
directly by the client, no endpoint required. There are **no client write policies** on
`league_members`; writes stay server-side, which is correct and must not change.

`league_members.period_start` is **denormalised and populated on join**
(`api/v1/league/join.js:101`), under a unique `(user_id, period_start)` constraint. So the
caller's current membership is a **single own-row read**, with no join to `leagues`.

### 2.6 Summary

| Question asked | Verified answer |
| --- | --- |
| New Supabase queries for deck progress? | **None.** Data is already in App state and already synced. |
| New tables/columns for deck progress? | **None.** No migration in this epic at all. |
| New queries for league standing? | **Two reads**, both already permitted by RLS. Optionally one RPC. |
| Can we read `rank`? | **No** — null until settle. Derive from `weekly_xp` ordering. |
| Reuse the leaderboard's fetch? | **No** — two writes on the landing tab. |

---

## 3 · Design A — `deck-unfinished`

### 3.1 The derivation

A new pure module, `src/lib/deckProgress.js`, mirroring `lib/missions.js`'s contract — no storage
reads, no DOM, everything injected:

```
deckProgressFor({ decks, learnedWords }) → [{ deckId, done, total }]
```

`deriveMissions` already accepts exactly this shape (`decks: [{ deckId, done, total }]`) and its
`deck-unfinished` branch is already tested against it. **No change to `lib/missions.js` is needed** —
the contract was designed for this and the test suite already pins it.

### 3.2 Which decks count

Curated decks (`activePack.content.decks`) in phase 1. Auto decks (`AUTO_DECKS`) are generated
from the lexicon and can be thousands of cards, where "unfinished" is not a meaningful nudge —
they are permanently unfinished. Custom decks do not persist (§2.2), so they cannot count.

**Decision D1:** phase 1 covers the four curated decks only. The function takes whatever deck map
it is handed, so widening later is a caller change, not a rewrite.

### 3.3 A caveat worth stating

`learnedWords` is keyed by **card id**, and is a vocabulary-mastery flag rather than a per-deck
completion record. If the same card id appears in two decks, learning it in one marks it in both.
With four hand-authored decks this is unlikely but not guaranteed.

**Decision D2:** accept it, and add a test asserting the four curated decks have disjoint card ids
— so the assumption is enforced rather than hoped for. If a future deck breaks it, that test fails
and we revisit rather than shipping a quietly wrong count.

---

## 4 · Design B — `league-position`

### 4.1 The read

Two own-scope reads, both already permitted (§2.5), on the RLS-scoped client — **never**
service-role, because this is the caller's own data and there is no reason to bypass RLS:

```
1. my membership   select league_id, weekly_xp from league_members
                   where user_id = :me and period_start = :currentPeriod
                   → at most one row (unique constraint)

2. my cohort       select user_id, weekly_xp from league_members
                   where league_id = :leagueId
                   order by weekly_xp desc
```

Then, entirely client-side, reusing what already exists:

```
rank        = index of my user_id in the ordered rows, + 1
cohortSize  = rows.length
{ demote }  = zoneCounts(cohortSize)          ← lib/leagueZones.js, already shared with settle
inDemotionZone = rank > cohortSize - demote
```

`zoneCounts` is deliberately reused: it is the module that already guarantees the dividers a user
sees match what settlement will actually do.

**No `join`, no `refresh`, no writes.** If there is no membership row for the current period, the
mission simply does not fire — a learner who has not joined a league this week has no standing to
be at risk of, and Home must not create one as a side effect of being opened.

### 4.2 Why not an RPC (and when to reconsider)

An RPC (`get_my_league_standing()`) would collapse this to one round trip and is tempting. It is
**not** recommended for phase 1:

- It adds a **migration** to an epic that otherwise needs none, plus a `security definer` function
  — which is precisely the shape that needs the most careful review.
- The ranking logic would then exist **twice**: in SQL and in `zoneCounts`/`LeaderboardSection`.
  Two implementations of "who is in the drop zone" is how the leaderboard and settlement drift
  apart, which `leagueZones.js` exists to prevent.
- Two indexed reads on a ≤25-row cohort is not a performance problem worth a migration.

Reconsider only if cohort size grows well beyond 25, or if the two-read latency becomes visible.

### 4.3 Freshness

`weekly_xp` is only as current as the last `refresh` call. Home will therefore show a standing that
can lag the learner's own XP earned since. That is **acceptable and should not be fixed by calling
`refresh` from Home** — that is the write we are avoiding. The mission is a nudge ("you are near the
drop zone"), not a scoreboard; the Leagues view remains the accurate surface and still refreshes.

State this in the mission copy rather than pretending precision.

---

## 5 · Data flow — keeping `MissionBoard` decoupled

The board is already decoupled, and the shape of the fix is to keep it that way.

```
  ┌───────────────────────────────┐   ┌────────────────────────────────┐
  │ useDeckProgress()             │   │ useLeagueStanding(userId)      │
  │  pure, from App state         │   │  2 RLS reads, cached           │
  │  → [{deckId, done, total}]    │   │  → {rank, cohortSize,          │
  │                               │   │     inDemotionZone} | null     │
  └──────────────┬────────────────┘   └───────────────┬────────────────┘
                 │                                    │
                 └────────────┬───────────────────────┘
                              ▼
                   deriveMissions({ decks, league, … })   ← PURE, unchanged
                              ▼
                   missions: [{ id, count, tab, priority }]
                              ▼
                   <MissionBoard missions={…} onGo={…} />
```

**The decoupling already holds, by construction:**

- `MissionBoard` receives `missions` and `onGo` and nothing else. It knows mission **ids**, not
  where the data came from — it cannot become coupled to Supabase without someone adding an import
  to it, which review catches.
- `deriveMissions` is pure and its `decks`/`league` parameters are already specified and tested.
  Neither hook changes its signature.
- Copy stays in the pack (`src/packs/de/missions.js`), so no German enters `src/lib` or
  `src/components`.

So the integration surface is **App only**. That is the right place for it and the only place that
needs to change.

### 5.1 `useLeagueStanding` — the shape that matters

Modelled on `lib/useLeagueRewards.js`, which is the established pattern for league data in this
app:

- Guard on `LEAGUES_ENABLED && userId`; return `null` otherwise.
- `cancelled` flag so an unmount cannot set state.
- **Swallow failures** and return `null`. A league read that fails must not break Home — the
  mission simply does not appear. This mirrors the profile fetch added in #193.
- **Fetch once per session, not per render.** Home re-renders on every progress event; the standing
  changes at most a few times a day. A `useEffect` keyed on `userId` is sufficient for phase 1.

### 5.2 What App gains

Two hook calls and two lines threaded into the existing `deriveMissions` call, replacing the
`decks: []` and `league: null` placeholders that are already there — with the comment explaining
why they were empty removed as it stops being true.

---

## 6 · Explicitly out of scope

- **Persisting custom decks** to the (currently dead) `decks` table. It is the more valuable piece
  of work — a generated deck does not survive a reload today — but it is a separate epic with its
  own sync-engine design, and this one needs no migration precisely because it stays out.
- **Adding `profiles`/`league_members` to the data export.** Recorded as open payload-shape
  decisions in `api/v1/account/export.js`; unchanged here.
- **Any migration.** If a change in this epic appears to need one, that is a signal the design has
  drifted from §2.

---

## 7 · Testing

- `deckProgress.test.js` — pure. Untouched deck excluded, finished deck excluded, started deck
  included with the right remainder; empty `learnedWords`; a deck map that is empty or malformed.
- **Disjoint-ids guard** (D2) — the four curated decks share no card id, so mastery in one cannot
  silently mark another.
- `useLeagueStanding.test.js` — in the demotion zone, safely mid-table, no membership this period,
  read failure returns `null`, flag off returns `null` without touching the network. Assert **no
  POST is issued** — that is the whole point of §2.4 and the assertion most likely to be quietly
  broken later by someone reusing `joinLeague`.
- **Existing `missions.test.js` needs no change.** Its `deck-unfinished` and `league-position`
  cases already assert the contract; if they start failing, a hook is producing the wrong shape.
  That is the regression signal, and it is already in place.
- Fixture warning: a fixture with one deck and one learned word cannot express "started but not
  finished". Build the populated fixture first and confirm each assertion fails without its
  feature.

---

## 8 · Phasing

| # | PR | Migration |
| --- | --- | --- |
| 1 | `lib/deckProgress.js` + tests + the disjoint-ids guard | none |
| 2 | Wire `deck-unfinished` in App (replaces `decks: []`) | none |
| 3 | `lib/useLeagueStanding.js` + tests | none |
| 4 | Wire `league-position` in App (replaces `league: null`) + mission copy | none |

**No migration in this epic.** 1 and 3 are independent; 2 depends on 1, 4 on 3.

---

## 9 · Open questions

1. **Should Home ever trigger `refresh`?** This design says no — Home is opened every session and
   `refresh` is a write. The cost is a standing that can lag today's XP (§4.3). If that reads as
   broken rather than approximate, the alternative is refreshing on the Leagues tab only and
   accepting the same lag on Home.
2. **Do auto decks belong in `deck-unfinished` later?** They are effectively never finished, so
   they would fire permanently. Probably needs a different mission ("keep going in *Artikel*")
   rather than a completion one.
3. **Is persisting custom decks the next epic?** §2.2 makes it the largest live gap found here:
   a learner's generated deck is lost on reload, and the export now has a `decks` key that will
   stay empty until it is fixed.
