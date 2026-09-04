# Progress lane — `/api/v1/progress/*`

> **E4: the signed-in app is the caller; the RPC is the only writer of
> `stats_daily`.** The daily sync adapter is a three-way additive delta merge
> (`mergeDailyAdditive`), not whole-object last-write-wins. Running this lane
> **and** the daily `upsert` double-counts one answer. The daily `select`
> (pull) stays so a second device still sees the first's progress. Events
> carry a client `id`; the server dedupes on `(user_id, event_id)` for 30 days.

Both endpoints require `Authorization: Bearer <jwt>`. Rate limit: 60 requests
per 5 minutes per user id, plus an IP limit ahead of authentication.

## `POST /api/v1/progress/events`

One answered card is one event. The write goes through a Postgres function
because an event is an **increment** — client-side read-modify-write on
`counters` races across devices.

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "dateKey": "2026-09-04",
  "packId": "de",
  "tab": "vocab",
  "level": "a1",
  "verdict": "correct",
  "bonusXp": 0
}
```

| Field     | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`      | UUID, required. Client-generated. The RPC inserts `(user_id, event_id)` first and returns existing counters unchanged on conflict, so a retried POST cannot double-count. Seen ids are kept for 30 days.                                                                                                                                                                                                                                                                                              |
| `dateKey` | `YYYY-MM-DD`, required. The server does **not** overwrite it with its own clock: the learner's local day is the streak day.                                                                                                                                                                                                                                                                                                                                                                            |
| `packId`  | Optional, default `de`. v1 accepts only `de`.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `tab`     | `chat` · `alphabet` · `vocab` · `translate`                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `level`   | `a1` · `a2` · `b1`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `verdict` | `correct` · `almost` · `wrong`                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `bonusXp` | Non-negative integer, default 0, **cap 500**. This is the same pipe as streak-multiplier and league-winner bonuses and it moves `weekly_xp`. The cap bounds ONE request, not the lane — at 60 requests per 5 minutes a caller can still push far more than any real week's XP. The real limit on abuse is that a signed-in user can already write their own `stats_daily` row directly through RLS, so this endpoint grants no capability they did not have; do not read the cap as league protection. |

A body carrying `courseCode` is rejected with `400` naming `packId` — progress
is pack-scoped, and silently aliasing the two keys is how they drift apart.
There is no `questId`: completing a quest is derived from these counters.

**200**

```json
{
  "dateKey": "2026-09-04",
  "packId": "de",
  "counters": { "total": 1, "bonusXp": 0, "byTab": { "…": 1 }, "byLevel": { "…": {} } }
}
```

## `GET /api/v1/progress/daily`

```
GET /api/v1/progress/daily?date=2026-09-04&packId=de
```

`date` is required and must be `YYYY-MM-DD`; `packId` defaults to `de`. Query
parameters rather than a path segment: this project compiles static function
filenames and has no dynamic `[param]` routes.

**200** — same shape as the POST response. A day with no row returns the
**zeroed aggregate**, never `404` and never `{}`: readers index straight into
`byLevel[level][verdict]`, and a quiet day is zeros.

**Errors (both):** `400 bad_request`, `401 unauthorized`, `403 forbidden`,
`405 method_not_allowed`, `429 rate_limited`, `500 server_error`.
