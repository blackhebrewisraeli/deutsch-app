# Data-driven engine — lessons on Postgres, progress on the existing data lane

- **Date:** 2026-09-04
- **Status:** design draft, ready for Claude Code review before a plan is written
- **Author:** Cursor (drafted at owner request). Architecture ownership stays with
  Claude Code per `AGENTS.md`. This file is the tracked home of the decision;
  it must not live only in a chat or in `CURSOR_TASKS.md`.
- **Umbrella:** `2026-06-10-backend-architecture-design.md` (Approach A: Vercel
  serverless + Supabase Postgres + RLS). This spec does not reopen that choice.
- **Related:** B1 data lane (`2026-06-12-backend-b1-data-lane-design.md`), B2
  sync (`2026-06-19-backend-b2.2-sync-engine-design.md`), B3 export/delete
  (`2026-06-27-backend-b3-export-delete-design.md`), Lane 3 pack delivery
  (`docs/api/packs.md`), gamification derive-don't-store
  (`2026-06-08-gamification-design.md`), product decision in `AGENTS.md`
  (German stays the only pack).
- **Abandoned:** the local Express + Mongoose + Mongo sandbox at
  `~/projects/local/practice/language-learning-engine`. That stack is the
  umbrella spec's rejected Approach C and is not part of this repo.

---

## 1 · What this is

Move the content-agnostic lesson + daily-progress idea onto the stack the app
already runs: **Postgres JSONB** for Mixed payloads, **versioned Vercel
functions** under `/api/v1/*`, **RLS** as the authorization layer.

The Mongoose draft named two collections (`Lesson`, `UserProgress`) and two
Express routers. Those names describe a vision, not a schema. This spec maps
each field onto tables and routes that already have a contract, and it refuses
the two inventions that would fork the source of truth.

**This spec is the developer-interface half.** It does not rewire `VocabTab`,
`TranslateTab`, or `applyEvent`. The PWA stays offline-first on bundled pack
content and `localStorage` until a later client-adoption plan says otherwise.
Same invariant as B1: the schema and the functions can land with **zero required
app-behavior change**.

---

## 2 · Ground truth (verified 2026-09-04 against the repo)

Read this before the design. Four facts change what "add a progress table" and
"fetch lessons by course" actually mean.

### 2.1 Daily progress already has a table, a sync path, and many readers

`public.stats_daily` is the server mirror of `state.daily['YYYY-MM-DD']`:

```
primary key (user_id, pack_id, day)
counters jsonb  -- { total, bonusXp, byTab, byLevel }
```

B2 already syncs it. B3 already exports it as `data.daily`. Leagues recompute
`weekly_xp` from the same counters via `xpForDay`. Quests, the trial wall, the
streak, and the Stats tab all read that shape.

A second table keyed on `(userId, dateKey, courseCode)` would be a second
writer for the same day. Last-write-wins on one side and increments on the
other will drift. That is how "export my data" silently omitted `decks` for
two months — two opinions about the same fact, only one wired up.

### 2.2 Quests are derived, never stored

`2026-06-08-gamification-design.md` §1 and `2026-09-01-quest-targets.md`:
`deriveQuests` reads `QUEST_CATALOGUE` plus the already-synced `daily` map.
Persisting `completedQuests: string[]` would duplicate a derivation and could
disagree with it after a catalogue change. The Mongoose field is a *view* of
`counters`, not a column.

### 2.3 `byTab` is a count, and reshaping it is a breaking change

`src/lib/stats.js` writes:

```js
{ total, bonusXp, byTab: { chat, alphabet, vocab, translate }, byLevel: { a1, a2, b1: { correct, almost, wrong } } }
```

`byTab[tab]` is rounds that day, not `{ correct, incorrect, total }`. Trial,
quests, and merge already optional-chain that exact shape. Replacing it with
the Mongoose `tabsActivity` object would NaN the XP arithmetic the way a
partial day entry used to (see the comment on `normalizeDayAggregate`).

Per-tab verdicts, if wanted later, grow as an **optional sibling key**. They
do not replace `byTab`.

### 2.4 Pack delivery is reserved; the German pack is bundled; `pack_id` is `'de'`

Lane 3 reserved `GET /api/v1/packs` and `GET /api/v1/packs/:id`.
`docs/api/packs.md` says: do not implement, stub, or route those until a
second language pack exists. `AGENTS.md` shelved that second pack.

User tables already carry `pack_id text not null default 'de'` so Phase 4
needs no server migration. A `course_code` column on **user** tables would
namespace progress per L1 (`de-he` vs `de-en`) and split the existing PK.
Content can carry a pedagogical-track tag. Progress cannot — not in v1.

---

## 3 · Decision summary

| Decision | Choice | Rationale |
|---|---|---|
| Hosting | Existing Vercel functions under `/api/v1/*` | Umbrella Approach A. No Express process, no new vendor. |
| Database | Existing Supabase Postgres | JSONB is the Mixed type. No MongoDB. |
| Lesson storage | New `public.lessons` table, `exercises jsonb` | Content, not user data. Does not exist today. |
| Daily progress storage | **Reuse `stats_daily`** | Flagged deviation from the Mongoose name `user_progress_daily` — see §4. |
| Course identity | `pack_id` on user data; `course_code` on lessons only | User rows stay on the B1 PK. Lessons may tag a pedagogical track. |
| `course_code` v1 allow-list | `'de'` only | German-only product decision. `'de-he'` / `'en-he'` are reserved strings, not shipped rows. |
| Lesson reads | Public `GET /api/v1/content/lessons/:courseCode/:level/:tab` | Language-blind path. Anon + authenticated may read. |
| Progress writes | Authenticated `POST /api/v1/progress/events` + sibling GET | Developer interface for generic events. Client must not enable this **and** the daily sync upsert on the same day — they double-count, see §7.3. |
| Lesson writes | Service role only (seed / import) | Same posture as `rate_limits`: no client INSERT/UPDATE/DELETE. |
| Offline SoT | Unchanged: bundled pack + `localStorage` | PWA stays playable with `npm run dev` and no secrets. |
| Lane 3 packs routes | Still reserved | This is a lesson-unit slice, not B4. Do not implement `/api/v1/packs`. |
| Client adoption | Out of scope | A later plan. Shipping the contract first is the B1 pattern. |

---

## 4 · Flagged deviations from the Mongoose draft

The owner-approved field list is the vision. The table names in that draft
were written against a greenfield Mongo app. Three mappings are deliberate
and must not be "fixed" back to the draft during implementation.

### 4.1 `UserProgress` is `stats_daily`, not a new table

| Mongoose field | Native mapping |
|---|---|
| `userId` | `stats_daily.user_id` (`uuid`, `auth.users`, RLS `auth.uid() = user_id`) |
| `dateKey` `'YYYY-MM-DD'` | `stats_daily.day` (`date`) |
| `courseCode` | `stats_daily.pack_id` (v1 always `'de'`) |
| `totalXpEarned` | Derived: `xpForDay(counters)` — not stored. Same function the league lane already imports. |
| `completedQuests` | Derived: `deriveQuests(daily, …)` — not stored. |
| `tabsActivity` | `counters.byTab` (round counts) + `counters.byLevel` (verdicts) |
| Compound unique `{ userId, dateKey, courseCode }` | Existing PK `(user_id, pack_id, day)` |
| `timestamps` | `updated_at` (writer-set, no trigger — B1 / B2 LWW rule) |

Do not create `user_progress_daily`. Do not add a SQL view of that name in
v1 either: a view with a different RLS story is how local/CI and production
diverge. If DataGrip readability matters later, a comment on `stats_daily`
is enough.

### 4.2 `Lesson.courseCode` does not become a user-table column

On `lessons`, `course_code` is a pedagogical track (default `'de'`). On
user data, the existing `pack_id` remains the only language key. The content
API accepts `:courseCode` in the path so callers stay language-blind; the
handler resolves it to `lessons.course_code` and never writes it onto
`stats_daily`.

### 4.3 Exercise `payload` stays schemaless; exercise `type` does not

JSONB gives the Mixed flexibility the draft wanted. The `type` enum is the
one closed set this spec keeps, because the engine has to know which
renderer to call. New types are a contract change (`/api/v2` or a migration
that widens the check), not a silent insert.

---

## 5 · Schema

One new migration. RLS-on is in the same file as `create table`, matching
B1 and the `ensure_rls` event trigger
(`20260827000000_ensure_rls_event_trigger.sql`). No follow-up statement.

`stats_daily` is **not** altered. The counters JSONB already holds the
progress payload. Widening the documented counters shape is a contract note,
not a migration.

### 5.1 `public.lessons`

```sql
create table public.lessons (
  id           uuid primary key default gen_random_uuid(),
  pack_id      text not null default 'de',
  course_code  text not null default 'de',
  level        text not null,
  unit_number  integer not null check (unit_number >= 1),
  tab          text not null,
  exercises    jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (pack_id, course_code, level, tab, unit_number)
);

create index lessons_lookup_idx
  on public.lessons (course_code, level, tab, unit_number);

alter table public.lessons enable row level security;

create policy "lessons are publicly readable"
  on public.lessons
  for select
  to anon, authenticated
  using (true);

-- no insert / update / delete policies: clients cannot write
-- service_role bypasses RLS for seed / import

revoke insert, update, delete on public.lessons from anon, authenticated;
grant select on public.lessons to anon, authenticated;
```

**Check constraints (closed sets, fail at insert, not at first render):**

```sql
alter table public.lessons
  add constraint lessons_level_check
    check (level in ('a1', 'a2', 'b1'));

alter table public.lessons
  add constraint lessons_tab_check
    check (tab in ('chat', 'alphabet', 'vocab', 'translate'));

alter table public.lessons
  add constraint lessons_course_code_check
    check (course_code in ('de'));

alter table public.lessons
  add constraint lessons_exercises_is_array
    check (jsonb_typeof(exercises) = 'array');
```

v1 `course_code in ('de')` is the product decision made structural. Adding
`'de-he'` later is one `alter table … drop constraint / add constraint`
plus rows — not a user-table migration and not a second pack.

`pack_id` stays unconstrained beyond `not null default 'de'` so it matches
every other user table. A second pack, if ever greenlit, is Claude Code's
Phase 4 / B4 work.

### 5.2 Exercise subdocument (JSONB array element)

Each element of `exercises` is:

```json
{
  "id": "greet-001",
  "type": "flashcard",
  "payload": {}
}
```

| Field | Rule |
|---|---|
| `id` | String, required, unique **within the lesson row**. Not unique globally — the engine already keys SRS on `srsKey(deckId, cardId)`, not on a lesson exercise id. |
| `type` | Closed enum: `flashcard` · `translate` · `chat` · `multiple-choice`. |
| `payload` | Object. Shape is owned by the exercise type, not by this table. The API does not validate payload keys in v1. |

SQL cannot cheaply enforce "every array element has `id` + `type`" without a
constraint trigger. v1 puts that check in the seed path and in the GET
handler's *response* filter: an element missing `id` or `type`, or carrying
an unknown `type`, is dropped and `console.error`'d, not served. A bad row
must not 500 the whole tab.

`alphabet` is a **tab**, not an exercise type. An alphabet unit is a lesson
row with `tab = 'alphabet'` whose exercises are `flashcard` or
`multiple-choice` (or later types). Do not add `'alphabet'` to the type enum
to make the names line up.

### 5.3 What `payload` is allowed to contain (guidance, not a schema)

The engine stays language-blind. Payload keys are pack data. Typical v1
shapes, for implementers and for seed fixtures — not CHECK-constrained:

- `flashcard` — `{ term, glosses[], ipa?, example? }` (do not require a
  `de` field in the table contract; the German pack's card field name is a
  recorded exception in `AGENTS.md` and lives in pack data, not here)
- `translate` — `{ prompt, accepted[], direction }`
- `multiple-choice` — `{ prompt, choices[], correctId }`
- `chat` — `{ scenarioId, taskId }` referencing pack-owned chat content

A seed that puts German literals in `payload` is fine. A handler that
branches `if (courseCode.startsWith('de'))` is not.

### 5.4 `stats_daily.counters` — documented progress contract

No migration. The JSONB object **is** the Mixed progress payload. Writers
(today: the client via `applyEvent` + B2 sync; later: `POST /progress/events`)
must produce a body `normalizeDayAggregate` would accept:

```json
{
  "total": 0,
  "bonusXp": 0,
  "byTab": { "chat": 0, "alphabet": 0, "vocab": 0, "translate": 0 },
  "byLevel": {
    "a1": { "correct": 0, "almost": 0, "wrong": 0 },
    "a2": { "correct": 0, "almost": 0, "wrong": 0 },
    "b1": { "correct": 0, "almost": 0, "wrong": 0 }
  }
}
```

Optional grow-only keys (absent means 0 / empty; readers optional-chain):

| Key | Meaning | When to add |
|---|---|---|
| `byTabVerdicts` | `{ [tab]: { correct, almost, wrong } }` | Only if a later plan needs per-tab accuracy. Sibling of `byTab`, never a replacement. |
| `questCompletions` | `{ [questId]: true }` | Only if derivation ever needs a stored override. Default is still derive. |

Do not add `totalXpEarned`. `xpForDay` is the single daily-XP function
(`src/lib/xpCore.js`); the league lane already imports it. A stored total
would drift the way the 2026-06-08 spec warned.

---

## 6 · API layer

Base path `/api/v1/`. Error envelope unchanged (`docs/api/README.md`).
Success bodies are versioned here; they do **not** use the Mongoose draft's
`{ success: true, lessons }` wrapper. The rest of `/api/v1` returns the
resource directly and puts failure in `{ error: { code, message } }`. Mixing
both styles in one tree is how clients grow a boolean they never check.

Shared middleware, in this order, matching `createAccountHandler` /
`createAiHandler`:

1. Method check
2. Origin allow-list (`ALLOWED_ORIGINS`, same soft-pass when absent)
3. Rate limit (IP, then identity when a JWT is present)
4. Auth (progress only)
5. Handler

Do not hand-roll a third factory that forgets origin or rate. Either extend
the existing factories with a `method: 'GET'` content variant, or add
`createPublicHandler` / reuse `createAccountHandler` for progress. The plan
picks one; this spec only forbids a one-off.

### 6.1 Content lane — `GET /api/v1/content/lessons/:courseCode/:level/:tab`

**Auth:** none. Lessons are public, like the lexicon files under
`/lexicon/de/`. A missing JWT is not an error.

**Path params:**

| Param | Accept | Reject |
|---|---|---|
| `courseCode` | `de` (case-sensitive, lowercase) | anything else → `400 bad_request` |
| `level` | `a1` · `a2` · `b1` | anything else → `400 bad_request` |
| `tab` | `chat` · `alphabet` · `vocab` · `translate` | anything else → `400 bad_request` |

Unknown `courseCode` is a bad request, not an empty 200. An empty 200 is
reserved for "this track exists and has no units yet", which v1 will not
hit for `'de'` once a seed exists, but must remain representable.

**Query:** none in v1. No `?unit=` filter — the client gets the tab's units
in order and picks. Pagination is a v2 concern; a German tab will not have
hundreds of units.

**Handler query:**

```js
db.from('lessons')
  .select('id, pack_id, course_code, level, unit_number, tab, exercises, updated_at')
  .eq('course_code', courseCode)
  .eq('level', level)
  .eq('tab', tab)
  .order('unit_number', { ascending: true });
```

Use the **service-role** client or the anon client — both can SELECT under
the public-read policy. Prefer the same `serviceClient()` the other
functions use so env-missing behaves as today (`null` → `500 server_error`,
"Server is not configured."). Do not add a browser `supabase-js` read of
`lessons` in this spec; the REST surface is the developer interface.

**200 response:**

```json
{
  "lessons": [
    {
      "id": "…",
      "packId": "de",
      "courseCode": "de",
      "level": "a1",
      "unitNumber": 1,
      "tab": "vocab",
      "exercises": [
        { "id": "greet-001", "type": "flashcard", "payload": { "term": "Hallo", "glosses": ["hello"] } }
      ],
      "updatedAt": "2026-09-04T00:00:00.000Z"
    }
  ]
}
```

JSON field names are **camelCase** at the HTTP boundary (existing account /
league lanes). Postgres stays snake_case. Map in the handler; do not change
column names to please the JSON.

Sort is `unitNumber` ascending, stable. `exercises` is the stored array
after the drop-invalid-element filter in §5.2.

**Rate limit (initial, tunable):** 60 req / 5 min per IP. Content is cacheable
and cheap; this exists so a scraper cannot sit on the function.

**Caching:** `Cache-Control: public, max-age=60` is allowed. Lessons are not
user-specific. Do not invent a CDN config in this spec.

**Not in v1:** `POST/PATCH/DELETE` lesson routes. Seeding is a SQL file or a
script using the service role, the way lexicon import is a script, not an
endpoint.

### 6.2 Progress lane — `POST /api/v1/progress/events`

**Auth:** required. `Authorization: Bearer <jwt>`. Same `requireAuth` as
account / league. Missing or invalid token → `401 unauthorized`.

**Why a function, not a direct client upsert:** an event is an increment.
Client-side read-modify-write on `counters` races across two devices the
way B1 rejected JS-side rate-limit increments. The write goes through one
Postgres function, race-free, the `increment_rate_limit` pattern.

**Request body:**

```json
{
  "dateKey": "2026-09-04",
  "packId": "de",
  "tab": "vocab",
  "level": "a1",
  "verdict": "correct",
  "bonusXp": 0
}
```

| Field | Rule |
|---|---|
| `dateKey` | `YYYY-MM-DD`, required. Server does **not** overwrite with its clock — the learner's local day is the streak day, same as `todayKey()` on the client. Reject any other shape. |
| `packId` | Optional; default `'de'`. v1: only `'de'` accepted. |
| `tab` | One of `TABS`. |
| `level` | One of `LEVELS`. |
| `verdict` | `correct` · `almost` · `wrong`. |
| `bonusXp` | Non-negative integer, default 0, cap 500 per event. This is the same pipe as streak-multiplier and league-winner bonuses. It moves `weekly_xp`. Cap exists so a crafted JWT cannot drop 1e9 onto the league. |

No `courseCode` on this body. Progress is pack-scoped (§4.2). A client that
sends `courseCode` instead of `packId` gets `400 bad_request` with a message
that names `packId` — do not silently alias, or the two keys will drift.

No `questId`. Completing a quest is a derivation from the counters this
event updates. The client already knows how to celebrate.

**RPC `apply_progress_event`:**

```sql
create or replace function public.apply_progress_event(
  p_user_id   uuid,
  p_pack_id   text,
  p_day       date,
  p_tab       text,
  p_level     text,
  p_verdict   text,
  p_bonus_xp  integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_counters jsonb;
begin
  -- privilege: service_role only (revoke from anon / authenticated), matching
  -- increment_rate_limit. The Vercel function is the only caller.
  --
  -- Semantics must match src/lib/stats.js applyEvent / normalizeDayAggregate:
  -- missing buckets become 0, then increment. Never replace the whole object
  -- (that would clobber the other device's tab counts).
  --
  -- updated_at = now() on write. This is a server timestamp, unlike B2's
  -- writer-set LWW. See §7.3 before enabling a client that uses both paths.
  …
end $$;
```

The plan writes the full function body. This spec locks the semantics:
**additive merge, normalize-then-increment, return the resulting counters.**
It is the server twin of `applyEvent`, not a generic JSON patch.

**200 response:**

```json
{
  "dateKey": "2026-09-04",
  "packId": "de",
  "counters": { "total": 1, "bonusXp": 0, "byTab": { "…": 1 }, "byLevel": { "…" } }
}
```

**Rate limit:** 60 req / 5 min per user id (same order of magnitude as the
AI grade lane). One event per answered card; a drill of 20 cards is fine, a
tight loop is not.

### 6.3 Progress lane — `GET /api/v1/progress/daily/:dateKey`

**Auth:** required.

**Path:** `dateKey` = `YYYY-MM-DD`. Optional query `packId` (default `de`).

**200:** `{ dateKey, packId, counters }` where `counters` is the stored
jsonb or `emptyDayAggregate()` if no row exists (do not 404 a quiet day —
the Stats tab treats a missing day as zeros).

**Rate limit:** 60 req / 5 min per user.

This GET exists so the developer interface is complete without forcing a
browser `supabase-js` select. The signed-in PWA may keep reading via the
existing sync pull; it does not have to switch.

### 6.4 Docs pages (required with the code)

Architecture rule: one markdown page per endpoint group under `docs/api/`.

| File | Contents |
|---|---|
| `docs/api/content.md` | Lesson GET, path params, response shape, rate limit, public-read RLS |
| `docs/api/progress.md` | Event POST, daily GET, body fields, RPC semantics, sync interlock |
| `docs/api/data.md` | Amend the tables list with `lessons` (public content; not user-owned) |
| `docs/api/packs.md` | **Unchanged.** Still reserved. Link to `content.md` as the lesson-unit slice so nobody implements packs by accident. |

---

## 7 · Architecture rules (adherence checklist)

Every item below is a constraint on the plan, not a suggestion.

### 7.1 Trust boundary

Secrets stay below the line: `SUPABASE_SERVICE_ROLE_KEY` in functions only.
The browser does not gain a new `VITE_` key. Lesson reads go through the
function so the content lane matches AI / account / league operationally
(origin, rate, envelope). Direct PostgREST from the client onto `lessons`
is allowed by RLS but is **out of scope** for v1 — one read path to test.

### 7.2 Approach A, not B or C

- **Not B** (everything through functions with service role and no RLS):
  `lessons` still has RLS; `stats_daily` policies do not change; the RPC is
  `security definer` + execute revoked from client roles, like
  `increment_rate_limit`.
- **Not C** (standalone Express / long-running Node): no `server.js`, no
  `mongoose`, no new process on Vercel.

Appendix A of the umbrella spec already rejected both. This spec does not
re-argue them.

### 7.3 Two writers on `stats_daily` are forbidden in production

| Writer | Semantics | Status today |
|---|---|---|
| B2 sync adapter (daily slice) | Three-way **additive delta** against `lastSyncedCounters` (`mergeDailyAdditive`) | Live for signed-in users |
| `apply_progress_event` | Additive increment, server `updated_at` | This spec |

The draft of this spec called the daily adapter whole-object last-write-wins.
That is `mergeSettings`, a different slice. **Enabling both writers
double-counts:** `recordEvent` increments local, the RPC increments server,
and the next reconcile pushes `delta = local − lastSynced` on top of the
already-incremented row. E4 (`2026-09-04-e4-client-adoption.md`) is the plan
that removes the daily upsert so the RPC is the only writer.

**v1 rule:** ship the RPC and the endpoints. Do **not** call them from
`src/` until E4 lands in the same PR as the daily-upsert removal, with a
test that fails if both write.

Anonymous / offline: the engine remains a no-op on the network, as B2
specified. No JWT, no progress POST.

### 7.4 Export / delete classification

`lessons` is **not** user-owned. It does not go in `EXPORTED_TABLES` or
`EXCLUDED_TABLES`. Those two maps are the set of tables with a `user_id`
column plus a client-facing ownership story. Adding `lessons` to either
would make `export.test.js`'s union-equals-every-user-owned-table assertion
the wrong test.

`stats_daily` is already exported as `daily`. No export-shape change.

If a later plan adds a user-owned table (for example an append-only event
log), it must be classified in the same PR. That is how `decks` went
missing.

### 7.5 Language-blind engine

`api/v1/content/*`, `api/v1/progress/*`, and `api/_lib/*` helpers added for
this work must not hardcode German strings, must not branch on
`language === 'de'`, and must not read `card.de`. `courseCode` / `packId`
are opaque identifiers. German flavour stays in the pack and in seeded
`payload` values.

### 7.6 Storage keys

Do not rename or migrate any `localStorage` key. This spec adds none.

### 7.7 German is the only pack

v1 seeds, if any, are `pack_id = 'de'` / `course_code = 'de'`. Do not
scaffold an `en` pack, a language picker, or Phase 4 namespacing. The
content-agnostic *shape* is the point; a second language is not.

---

## 8 · Testing

Gate unchanged: `npm test` / `npm run lint` / `npm run format:check`.
`.husky/pre-commit` still runs the full suite. `npm run test:rls` stays a
separate Docker job.

### 8.1 RLS (`supabase/tests/rls/`)

Add a file, do not dilute `policies.test.js` into an unreadable dump.

As anon and as user A:

1. `select` on `lessons` → rows visible (public read).
2. `insert` / `update` / `delete` on `lessons` → rejected.
3. `select` on `stats_daily` for user B → zero rows (existing; must stay).
4. `rpc apply_progress_event` as A → **permission denied**.
5. `rpc apply_progress_event` as service role → counters increment;
   a second call in the same day increments again (not replace);
   a missing initial row is created;
   a second tab on the same day does not zero the first.

Cross-user success fails the build.

### 8.2 Handler contract tests (`api/v1/content/*.test.js`, `api/v1/progress/*.test.js`)

Same idiom as `api/v1/ai/*.test.js` and `api/v1/account/*.test.js`: mock
`serviceClient` / `requireAuth`, assert status and envelope.

Must cover:

- GET lessons: 200 + sort by `unitNumber`; unknown `courseCode` / `level` /
  `tab` → 400; `GET` only (POST → 405); origin reject → 403; missing
  Supabase env → 500.
- An exercise with a bad `type` is omitted from `lessons[].exercises`, not
  a 500.
- POST events: no JWT → 401; bad `dateKey` / `verdict` / `bonusXp` → 400;
  `courseCode` in the body → 400 (names `packId`); happy path returns
  merged counters; `bonusXp` above cap → 400.
- GET daily: missing row → 200 with empty aggregate, not 404.

Each new test must be able to fail. A fixture with one unit cannot express
"sorted by `unitNumber`"; seed two units with `unit_number` 2 then 1.

### 8.3 Export classification

`export.test.js` must still pass unchanged. If it does not, a user-owned
table was added without classification — stop and report.

---

## 9 · File structure (for the plan)

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/<ts>_lessons.sql` | Create | Table, indexes, checks, RLS, grants |
| `supabase/migrations/<ts>_apply_progress_event.sql` | Create | RPC + revoke/grant, same shape as `increment_rate_limit` |
| `supabase/tests/rls/lessons.test.js` | Create | Public read, no client writes |
| `supabase/tests/rls/progress-event.test.js` | Create | RPC privilege + additive merge |
| `api/v1/content/lessons.js` | Create | GET handler |
| `api/v1/content/lessons.test.js` | Create | Contract tests |
| `api/v1/progress/events.js` | Create | POST handler |
| `api/v1/progress/events.test.js` | Create | Contract tests |
| `api/v1/progress/daily.js` | Create | GET handler (Vercel: `daily/[dateKey].js` or query param — plan picks the file layout that matches existing dynamic routes) |
| `api/v1/progress/daily.test.js` | Create | Contract tests |
| `api/_lib/*` | Modify only if a shared public-GET factory is the chosen shape | No one-off origin/rate copy |
| `docs/api/content.md` | Create | Content contract |
| `docs/api/progress.md` | Create | Progress contract |
| `docs/api/data.md` | Modify | List `lessons` |
| `docs/api/packs.md` | Modify | One-line pointer; routes stay reserved |
| `src/**` | **Do not touch** | Client adoption is a later plan |

Seed data is optional in v1. Tests create their own rows. A `seed.sql` that
loads German units is nice for local `supabase start` but is not the
done-signal.

---

## 10 · Phasing

| Slice | Ships | Done when |
|---|---|---|
| **E1 — schema** | `lessons` migration + RLS tests | `supabase start` applies; `npm run test:rls` green including the new cases; `stats_daily` untouched |
| **E2 — content GET** | `api/v1/content/lessons` + `docs/api/content.md` | Contract tests green; curl against `vercel dev` returns `{ lessons: [] }` on an empty DB |
| **E3 — progress RPC + endpoints** | RPC + POST/GET + `docs/api/progress.md` | Contract + RLS RPC tests green; **no `src/` caller** |
| **E4 — client adoption** | Later plan, not this spec | Signed-in path uses one writer; offline path unchanged |

E1–E3 can be one PR or three. E4 cannot hide inside E3.

---

## 11 · Explicitly out of scope

- Express, Mongoose, MongoDB, `server.js`, a second Node process.
- Implementing or stubbing `GET /api/v1/packs`.
- A second language pack, a course picker, or Phase 4 storage namespacing.
- Renaming `card.de`, `localStorage` keys, or `stats_daily`.
- Reshaping `counters.byTab` into `{ correct, incorrect, total }`.
- Storing `completedQuests` or `totalXpEarned`.
- Wiring `App.jsx` / practice tabs to the new GET.
- Telemetry / BigQuery (still a later arc in the umbrella spec).
- Admin UI for authoring lessons.
- Changing league settle, trial rules, or quest catalogue targets.

---

## 12 · Rejected alternatives

**New `user_progress_daily` table.** Duplicates `stats_daily`'s PK and
splits the readers listed in §2.1. The Mongoose name survives in this
document as a mapping, not as SQL.

**Append-only `progress_events` plus a retained `stats_daily`.** Correct
for an analytics warehouse; the umbrella parked that in BigQuery. A third
Postgres table now is two sources of truth and an export-classification
footgun.

**Direct client upsert of `stats_daily.counters`.** Allowed by today's RLS,
and it is what B2 already does. It is not safe for *event* increments
(read-modify-write). The RPC exists specifically for the additive path.

**Standalone Express + Mongo (the abandoned sandbox).** Umbrella Appendix A,
Approach C: a 24/7 server and a second security surface for traffic
serverless already absorbs. JSONB covers the Mixed payload. The sandbox is
not in this repository and must not be copied in.

**Putting `course_code` on user tables.** Splits daily progress per L1 and
breaks the B1 PK / Phase 4 interlock. Pedagogical track belongs on content.

---

## 13 · Open questions for Claude Code review (not implementer discretion)

These are the only undecided points. An implementing agent that answers
them in code has left the spec.

1. **Seed in E1 or later?** Empty `lessons` plus tests that insert their own
   rows is enough to prove the contract. A German A1 vocab unit in
   `seed.sql` would make `vercel dev` demos real. Which?
2. **Dynamic route file layout for GET daily.** Vercel wants
   `api/v1/progress/daily/[dateKey].js` or a query string on
   `api/v1/progress/daily.js`. Existing league routes are static names.
   Pick the one that matches how Vercel already compiles this project.
3. **E4 timing.** This spec forbids a client caller. If the owner wants the
   signed-in PWA on the RPC in the same arc, that is a second spec (sync
   adapter off, merge tests, offline queue). Do not fold it in here.

Everything else in §§3–11 is decided. If a line here disagrees with
`2026-06-10-backend-architecture-design.md`, the umbrella wins and this
file should be amended — not the other way around.
