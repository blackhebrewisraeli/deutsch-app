# E5 — Content lane client adoption

- **Date:** 2026-09-04
- **Status:** approved by the owner 2026-09-04 (overlay only; seed a Supabase
  branch before production)
- **Spec:** `docs/superpowers/specs/2026-09-04-data-driven-engine.md`
- **Follows:** E1–E3 (#235, schema + content lane + progress lane), E4 (#237,
  queued progress events). E4's "Not in this PR" list names this work.

---

## 1 · Premise check (verified against the repo and production, 2026-09-04)

The mission brief was written as "fetch the lessons and dynamically render the
learning map, replacing static lesson structures". Four of its premises are
wrong, and two of them change what the work is. Recorded here because the
project's recurring failure mode is building against a stated scope nobody
measured (`verify-the-premise-first`).

### 1.1 There is no learning map or pathway

`src/` has no map, path, or unit surface. Navigation is `src/lib/tabs.js` —
four practice tabs (`chat`, `alphabet`, `vocab`, `translate`) plus Home and
Profile/Stats, switched by `tab` state in `App.jsx`. There is no static
structure to replace; there is an *absent* surface to add.

### 1.2 The `lessons` table is empty in all twelve combinations

Probed against production on 2026-09-04:

```
{a1,a2,b1} × {chat,alphabet,vocab,translate}  →  HTTP 200 {"lessons":[]}
```

Twelve of twelve. There is no seed script and no seed SQL in `scripts/` or
`supabase/`. **Rendering is not the gate; rows are.** Any change that routes a
tab's content through this fetch ships a blank app until §5 lands.

### 1.3 The endpoint takes query parameters, not path segments

Spec §6.1 describes `/content/lessons/:courseCode/:level/:tab`. The shipped
handler reads `req.query` (E1–E3 plan, Ruling 1: this project compiles static
function filenames and has no `[param]` routes). The real contract is:

```
GET /api/v1/content/lessons?courseCode=de&level=a1&tab=vocab[&packId=de]
```

All four are validated against closed sets. An unknown value is
`400 bad_request` — **not** an empty 200. `{"lessons":[]}` means "this track
exists and has no units yet", and the client must tell those two apart.

### 1.4 Full replacement contradicts the merged design

Spec §3 fixes the offline source of truth as "Unchanged: bundled pack +
`localStorage`", and §1 says the PWA stays offline-first until a client
adoption plan says otherwise. This is that plan, and it does **not** reopen
that decision. Reinforcing it: `vite.config.js` sets
`navigateFallbackDenylist: [/^\/api\//]` with the comment "Don't cache API
calls" — the service worker will not serve this endpoint offline at all.

### 1.5 What the brief got right

The four renderers exist (`ExerciseViewer` + `exerciseRegistry`, all of
`flashcard` · `translate` · `chat` · `multiple-choice`) but are reachable only
from the standalone `exercise-preview.html` page — nothing in `App.jsx` mounts
them. E4's progress queue *is* live in the app (`App.jsx`, `startProgressFlush`).

---

## 2 · Rulings

**Ruling 1 — additive overlay, never replacement.** Zero lessons returned ⇒ the
tab renders exactly what it renders today. The bundled pack stays the offline
source of truth. A guard test asserts the loading, empty, and error paths all
leave the existing tab untouched. This is what makes E5.1–E5.3 landable against
an empty table, the same way B1 shipped a contract with zero app-behavior
change.

**Ruling 2 — the cache is app-level `localStorage`, not a workbox rule.** The
service worker denylists `/api/`, and a runtime-caching rule has no assertable
form in jsdom (`jsdom-mangles-css-min-calc` is the same shape of problem: a
config that no test can reach). An app-level SWR cache is testable, and it is
the only thing that makes lesson units survive a cold offline open.

**Ruling 3 — the client re-validates what the server already filtered.** The
handler drops malformed exercises on the way out, but a *cached* blob was
written by an older build against an older contract. `getExerciseComponent`
falls back to `UnknownExercise`, so a bad type cannot crash — but an element
with no `id` would break React keys. Validate on read from cache, not only on
read from network.

**Ruling 4 — revalidation replaces, never merges.** A unit removed upstream
must disappear. Merging would make deletion unrepresentable, which is the
`custom-decks` tombstone lesson pointed the other way.

**Ruling 5 — seed a Supabase branch first.** Owner instruction, 2026-09-04. No
service-role write to production until the fixture has been rendered against a
branch.

---

## 3 · E5.1 — `src/lib/lessons.js`

Pure module, no React. Three exported pieces, deliberately NOT one
stale-while-revalidate call: the cache read is synchronous and the network read
throws, so the *fallback policy* lives in the caller — the only thing that knows
whether it already has units on screen.

- `LESSONS_CACHE_KEY = 'deutsch-app-lessons-v1'`, entries keyed
  `${packId}:${courseCode}:${level}:${tab}`.
- `readCachedLessons(params)` → units, or `null` for a cold cache. `null` and
  `[]` are different answers: null is "never fetched", `[]` is "empty track".
- `fetchLessons(params)` → units; warms the cache; throws `{code}` on 400
  (`bad_request`), on any other non-2xx, on a network failure, and on a 200
  whose body will not parse (`bad_response`).
- `sanitizeLessons` mirrors the handler's filter and runs on cache reads too
  (Ruling 3).

The `bad_response` case is not defensive padding: `npm run dev` (vite alone,
no `vercel dev`) answers `/api/*` with `index.html` and a 200. Resolving that
as `[]` would make a broken lane indistinguishable from a real empty seed —
the same failure shape as a 404 reported as `total=0`.

**19 tests.** Three mutants were run against them and each was caught by its
intended test: cache read that skips re-sanitizing, revalidation that merges
instead of replacing, and a non-ok response that resolves empty.

## 4 · E5.2 / E5.3 — hook and lane

- `useLessons({ courseCode, level, tab })` → `{ status, lessons }` with
  `status ∈ loading | ready | empty | error`, abort-on-unmount using the
  `cancelled` pattern from `useLeagueStanding.js`. Never throws into render.
- `PracticeLane` (one component, one hook call) renders units above the tab's
  own bundled content, which it passes through as `children`.
  **With no units it returns `children` and nothing else** — no wrapper, no
  heading, no collapsible. Ruling 1 is structural rather than a branch someone
  can forget.
- Mobile-first: reuses `PageFrame maxWidth={480}`; verified at 375px **and**
  320px per `AGENTS.md`.

### 4.1 Bundled content goes in a collapsible (owner decision, 2026-09-04)

The dynamic pathway is the primary journey, so units stay **above**. To stop
them burying the tab, the bundled content moves into a collapsed
`<details>` labelled from the pack (`lessonChrome.bundledHeading`).

Native `<details>`, not a custom accordion: keyboard and screen-reader operable
for free, and it **hides children without unmounting them**, so a half-finished
drill survives a lesson appearing above it. A custom accordion that conditionally
renders `children` would silently reset every tab's state the day content lands.

## 5 · E5.4 — seed (the gate)

`scripts/seed-lessons/` + a committed fixture: one unit per tab at `a1`, ~5
exercises each. Applied to a **Supabase branch** first (Ruling 5). Production
seeding is a separate, explicitly-approved step under the prod drill, including
`notify pgrst, 'reload schema'`.

## 6 · E5.5 — progress wiring (done)

Answers reach progress through **`recordEvent(tab, level, verdict)`** — the same
single entry point `VocabTab` uses. It writes local `daily` via `applyEvent`
**and** enqueues the event for the RPC in one call; reaching for `applyEvent`
directly would do one and skip the other.

The stubs were presentation-only, so each gradeable type gained an interaction:

| Type | Interaction | Verdict |
|---|---|---|
| `flashcard` | "Got it" / "Not yet", offered only after reveal | `correct` / `wrong` |
| `translate` | typed answer vs **every** `accepted` string | distance 0 → `correct`, ≤2 → `almost`, else `wrong` |
| `multiple-choice` | Submit, graded against the new optional `answer` | `correct` / `wrong` |
| `chat` | none — a free conversation has no verdict | — |

Every renderer stays presentation-only when no `onGraded` is passed: no rating
control renders at all, so `exercise-preview.html` is unchanged.

### 6.1 Not double-counting

Two independent guards, because the E4 spec's §7.3 hazard is real:

1. **Each renderer locks after one verdict** (disabled controls + an early
   return).
2. **The lane keeps a Set of graded exercise ids**, reset when
   `(pack, course, level, tab)` changes so returning to a tab is not silently
   unrecorded.

`recordEvent` itself is the only writer — E4 already removed the competing
daily upsert, so there is no second writer for the day.

**Both guards had to be proven separately, and at first neither was.** Each
masked the other: deleting the lane's Set changed nothing because the renderer
still locked, and deleting the renderer's lock changed nothing because the Set
still deduped — 19 tests stayed green through both mutations. Fixed by
`PracticeLane.dedupe.test.jsx`, which swaps in a renderer that fires `onGraded`
twice on one click, and by asserting the flashcard's *behaviour* (which fails
once both of its guards go). See [[a-second-bug-can-make-a-probe-pass]].

`PracticeLane.progress.test.jsx` mocks nothing but `fetch`: it asserts one
graded answer produces exactly one local increment **and** exactly one queued
event, with distinct ids so the RPC can dedupe.

## 6b · Found while building

### 6b.1 Spec §5.3's payload sketches were wrong for two of the four types — RESOLVED

The shipped stubs read different keys than the spec prose:

| Type | Spec §5.3 | What the renderer actually reads |
|---|---|---|
| `multiple-choice` | `{ prompt, choices[], correctId }` | `question`/`prompt` + `choices` as plain **strings**; no `correctId` — the stub is presentation-only |
| `chat` | `{ scenarioId, taskId }` | `initialMessage`, `persona` |

A fixture written to the spec inserts cleanly, serves cleanly, and renders an
empty card. `scripts/seed-lessons/fixture.test.jsx` renders every fixture
exercise through the real `ExerciseViewer`; both spec-shaped payloads were run
against it as mutants and both failed it. **Resolved 2026-09-04 (owner: "code is truth"):** spec §5.3 has been rewritten
to the shipped keys, as a table that also records what each type grades on. The
`multiple-choice` contract additionally gained an optional `answer` key so it
can be graded at all; without it the exercise stays submittable but unscored,
because banking `wrong` for every learner over a content omission is worse than
not scoring.

### 6b.2 Overlay placement — RESOLVED

The overlay currently mounts **above** the bundled tab content, inside the
shared practice-tab wrapper in `App.jsx`. Measured on the seeded local stack at
320px: the Alphabet overlay is 2173px tall against 661px of bundled content, so
once seeded a learner scrolls past every lesson to reach "Das Alphabet".

**Resolved 2026-09-04 (owner):** units stay **above** — the dynamic pathway is
the primary journey — and the bundled content moves into a collapsed
`<details>` labelled "Reference & Bundled Practice". See §4.1.

---

## 6c · Verification performed (2026-09-04)

Supabase **branching requires a Pro plan**, which this org does not have, so the
approved "branch first" was executed against the **local Docker stack** — the
target `.env.example` mandates for local work, and the one place a service-role
key is allowed to exist locally.

- `supabase start`; migrations applied; all six `lessons` CHECK constraints present.
- `npm run seed:lessons` → 4 units / 17 exercises; re-run left the count at 4 (idempotent).
- The **real handler** invoked against the seeded DB: 200 with units for all four
  a1 tabs, 200 with 0 units for a2, 400 for an unknown `courseCode`.
- Real browser, guest session, 375px **and** 320px: overlay renders
  "Lektionen / Einheit 1"; `documentElement.scrollWidth - clientWidth === 0`,
  zero children escaping the section box, zero interactive targets under 44px.
- **Ruling 1 verified both directions**: with units, the bundled "Das Alphabet"
  content is still present below the overlay; with the cache cleared and the
  lane returning non-JSON, no overlay renders, the bundled tab is untouched, and
  no cache entry is written. Console clean.

Production was **not** written to. The seed script hard-refuses the production
project ref unless `--allow-production` is passed.

---

## 7 · Sequencing

| Slice | Ships | User-visible |
|---|---|---|
| E5.1–E5.3 | one PR against the empty table | none (Ruling 1) |
| E5.4 | branch seed, then approved prod seed | units appear |
| E5.5 | progress wiring | answers count |
