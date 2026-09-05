# Leagues Hardening Implementation Plan (L1–L4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for every task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the stale-leaderboard defect introduced by the E4/E5 progress lane, and eradicate the three pieces of league technical debt (RLS initplan, N+1 settle, nullable `period_start`) while the code is open.

**This is a hardening epic, not a build.** Social leagues shipped 2026-06-27 and are live. Before planning, every element of the original brief was verified as already present:

| Brief item | Status | Where |
| --- | --- | --- |
| 1. `leagues` / `league_members` tables | Shipped | `supabase/migrations/20260627000000_leagues.sql` + 3 follow-ups |
| 2. Aggregate daily XP from `stats_daily` | Shipped (defective — see L1) | `api/v1/league/refresh.js`, `api/_lib/weeklyXp.js` |
| 3. Safe read-only leaderboard serving | Shipped | RLS-scoped select, `src/lib/leagues.js:76` |
| 4. RLS, no unauthenticated reads | Shipped | service-role sole writer; `is_league_member()` |

56 tests already exist across 9 league test files. **Do not rebuild any of this.**

## The defect L1 fixes

`api/v1/league/refresh.js:45` is the **only** writer of a non-zero `weekly_xp`, and it updates only the caller's own row. Since E4/E5 moved progress writes server-side into `apply_progress_event`, and that RPC contains no league writes, a member's `weekly_xp` advances only when *they personally* open the Stats tab. Every rival on the leaderboard is therefore displayed at their last-tab-visit XP.

## Global Constraints

- **Extend the 8-arg `apply_progress_event`** defined in `20260904140000_progress_events_seen.sql`. The 7-arg form was dropped; recreating it re-opens the E4 arity outage.
- **The league write goes strictly AFTER the dedupe guard**, in the applied path only. A replayed event must not move league XP. `inserted is null` must keep its early return.
- **Recompute, never increment.** Sum the week's `stats_daily` rows. An increment would drift from `weeklyXpFromRows` and could not self-heal.
- **Never mutate a settled league.** Only update a membership row whose `rank is null`.
- **One definition of the league week.** `currentPeriodStart` is Monday UTC; the SQL must use `date_trunc('week', ...)` (ISO, Monday) and agree with it. A guard test pins this.
- **One definition of the XP formula.** `XP_PER_VERDICT = { correct: 10, almost: 6, wrong: 3 }` (`src/lib/gameConfig.js:4`). The SQL constants must be asserted equal to the JS ones, or the two lanes drift silently.
- **No pack filter**, matching `refresh.js`, which sums across all packs.
- **`refresh.js` stays.** It becomes a reconciliation path, not the only writer. Do not delete it.
- **No new Vercel function** — the Hobby 12-function cap still binds. L1 adds zero endpoints.
- **A merged migration file is not an applied migration.** #239 now fails CI on drift; after merge still diff `list_migrations` against `supabase/migrations/`.
- Never `--no-verify`. Never push to `main`. Branch + PR only.

---

## L1 — Server-side XP aggregation

**Fixes:** the stale leaderboard. The only user-visible bug in this epic.

- [ ] **RED 1 — arithmetic.** In `supabase/tests/rls/`, assert that after `apply_progress_event` for user A, A's `league_members.weekly_xp` equals `xpForDay` of the resulting counters. **Fixture must contain a second member B whose row must not move** — a single-member fixture cannot express the bug.
- [ ] **RED 2 — dedupe interaction.** Replaying the same `event_id` must leave `weekly_xp` unchanged. This is the E4 regression guard.
- [ ] **RED 3 — settled leagues are immutable.** An event whose week maps to a league with `rank is not null` must not alter that row.
- [ ] **RED 4 — cross-week isolation.** An offline event dated in a previous week must not add XP to the current week's membership row.
- [ ] **GREEN.** New migration: pure `public.progress_day_xp(counters jsonb) -> integer` mirroring `xpForDay`, plus a `weekly_xp` recompute-and-update block appended to `apply_progress_event` after the dedupe guard.
- [ ] **Teeth check.** Revert the migration; confirm every RED above goes red. Any test that was green from the start is not proven (see: *a second bug can make a probe pass*).
- [ ] **Drift guard.** A unit test asserting the SQL verdict weights equal `XP_PER_VERDICT`, and the SQL week start equals `currentPeriodStart` for a sampled year of dates.
- [ ] Confirm `refresh.js`'s 3 existing tests still pass unchanged.

## L2 — RLS initplan

**Fixes:** advisor-confirmed `auth_rls_initplan` on `league_members."read my league rows"` and `leagues."read my leagues"`.

- [x] **RED.** Asserted against `pg_policies` in the local RLS suite, not the management-API advisor: a test cannot reach the MCP, and a static scan of migration files cannot answer the question at all (the 2026-06-27 file contains a bare `auth.uid()` and always will — only the catalog knows which definition won). **Prints the denominator** (policies inspected) so zero-findings and zero-inspected cannot print identically.
- [x] **GREEN.** `20260906000500_league_policy_initplan.sql` — `ALTER POLICY` (not DROP + CREATE, which would open an instant with no policy on tables where the policy *is* the access control).
- [ ] **Verify live — POST-DEPLOY.** The MCP advisor is bound to production, so this cannot clear until the migration is applied there. A lint that does not clear means the change did not take; never explain it as cache lag.
- [x] ~~Blocker: `npm run test:rls` broken locally by a two-CLI version mix.~~ **Did not reproduce** — `npx supabase` (2.116.0) drives `start`/`db reset` fine and `npm run test:rls` runs 89/89. The global 2.106.0 is simply unused. The note that recorded this was stale.

## L3 — Set-based settle

**Fixes:** `api/v1/league/settle.js` issues one UPDATE per member (25 round trips per cohort, times L leagues, under a 300s budget).

- [ ] **RED.** Extend `settle.test.js` to count DB round trips for a 25-member cohort and assert ≤ 2. Fails today at 25.
- [ ] **GREEN.** Replace the per-member loop with a single `update … from (values …)` RPC.
- [ ] **Invariants that must stay green untouched:** the existing idempotency and re-settlement determinism tests.

## L4 — Schema tightening

**Fixes:** `league_members.period_start` is still nullable 70 days after its rollout window closed. Postgres treats NULLs as distinct, so a NULL silently defeats `league_members_user_period_uniq` — the exact double-membership bug it was added to prevent (observed in prod 2026-06-28).

- [ ] **RED.** Assert `period_start` is `NOT NULL`; and a probe inserting two memberships for one user in one period **with `period_start` NULL** must raise 23505. That case passes today.
- [ ] **GREEN.** Backfill guard + `set not null`. Drop the unused `league_members_user_idx` (advisor INFO; every query now filters on `(user_id, period_start)`).
- [ ] Production has 0 NULL `period_start` rows as of 2026-09-05, so the backfill is a no-op safety net, not a data migration.

---

## Explicitly out of scope

- **A new leaderboard endpoint or RPC.** `fetchStandings` already reads under RLS, scoped to the caller's league, ordered server-side. Adding an endpoint would add an unauthenticated-reachable surface where none exists today.
- Any UI change. This epic has no client work beyond leaving `refresh.js` callers intact.
- `VITE_LEAGUES_ENABLED` is Sensitive in Vercel and its production value could not be read. Production's latest `period_start` is 2026-08-17 (3 weeks stale), consistent with either the flag being off or simply no tab visits. **Confirm before claiming L1 fixed anything user-visible in production.**

## Ordering rationale

L1 is the only user-visible correctness fix and gates the rest. L2 is one migration with an objective advisor gate. L3 and L4 are independent and may land in either order.
