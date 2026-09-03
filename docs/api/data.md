# Data contract — Supabase (phase B1)

The database half of the developer interface. Spec:
`docs/superpowers/specs/2026-06-12-backend-b1-data-lane-design.md`.
Schema source of truth: `supabase/migrations/` (versioned SQL).

## Tables

| Table         | PK                            | Holds                                                                                | Mirrors (localStorage)                                         |
| ------------- | ----------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `profiles`    | `user_id`                     | display name; auto-created on signup by trigger                                      | —                                                              |
| `srs_state`   | `(user_id, pack_id, srs_key)` | Leitner state: `box`, `last_reviewed`, `next_due`, `reps`                            | `srs['<deckId>:<cardId>']` — `srs_key` holds that key verbatim |
| `stats_daily` | `(user_id, pack_id, day)`     | `counters jsonb`                                                                     | `daily['YYYY-MM-DD']`                                          |
| `decks`       | `(user_id, pack_id, deck_id)` | `name`, `cards jsonb`                                                                | custom decks                                                   |
| `settings`    | `user_id`                     | `data jsonb`                                                                         | the `gamification` key                                         |
| `rate_limits` | `(key, window_start)`         | AI-lane counters                                                                     | — (server-only)                                                |
| `lessons`     | `id`                          | lesson-unit content: `course_code`, `level`, `tab`, `unit_number`, `exercises jsonb` | —                                                              |

`lessons` is public content, not user data — nobody owns a row. It is not
user-scoped (no `user_id`), so it appears in neither `EXPORTED_TABLES` nor
`EXCLUDED_TABLES` in `api/v1/account/export.js`; it is simply outside the
account cascade. Served read-only via `GET /api/v1/content/lessons`
(`docs/api/content.md`); writes go through `service_role` only.

All user tables carry `pack_id text default 'de'` (multi-language Phase 4
interlock) and `updated_at` (set by the writer — the B2 sync's
last-write-wins comparison value; no server trigger overwrites it).

## Guarantees (enforced by RLS, verified adversarially in CI)

- Every user table: RLS enabled in the same migration that creates it;
  policies allow exactly `auth.uid() = user_id` for select / insert /
  update / delete (profiles: no delete — account deletion is a B3
  server-side operation).
- `rate_limits` has **no policies** — invisible to anon and authenticated;
  only the service role reads or writes it, via
  `increment_rate_limit(key, window_start)` (SECURITY DEFINER, execute
  revoked from client roles).
- The CI job `rls-policy-tests` boots the real stack and attempts every
  cross-user operation; any success fails the build.

## Verifying locally

```bash
supabase start      # Docker required; applies all migrations
npm run test:rls    # 30 adversarial tests
```
