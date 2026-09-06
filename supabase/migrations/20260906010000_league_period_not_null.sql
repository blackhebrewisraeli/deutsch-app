-- L4: close the NULL hole in the one-membership-per-week guarantee.
--
-- 20260628000000 added league_members_user_period_uniq after a user landed in
-- two leagues in one week in production (2026-06-28); join.js's idempotency
-- check then matched multiple rows and the endpoint 500'd on every subsequent
-- call. That migration deliberately left period_start NULLABLE so the
-- then-deployed join.js, which did not set the column, kept working through the
-- rollout.
--
-- The rollout finished 70 days ago and join.js has set period_start ever since.
-- What remains is a live hole: Postgres treats NULLs as DISTINCT in a unique
-- index, so two rows with a NULL period_start do not conflict with each other.
-- Any writer that forgets the column silently re-opens the exact bug the index
-- exists to prevent. NOT NULL is what actually makes the constraint total.

-- Defensive backfill. Production had zero NULL rows when this was written
-- (checked 2026-09-05), so this is a safety net, not a data migration. If a row
-- somehow cannot be resolved, the ALTER below fails loudly rather than the
-- constraint being added over bad data.
update public.league_members lm
   set period_start = l.period_start
  from public.leagues l
 where l.id = lm.league_id
   and lm.period_start is null;

alter table public.league_members
  alter column period_start set not null;

-- league_members_user_idx is (user_id). league_members_user_period_uniq is
-- (user_id, period_start), and a composite index serves lookups on a prefix of
-- its columns — so the unique index already answers every user_id-only query
-- (refresh.js's membership lookup, fetchMyResults). Supabase's linter reports
-- the single-column index as never used; keeping it only costs write
-- amplification, and L1 made this table one that the progress RPC updates on
-- every answered exercise.
drop index if exists public.league_members_user_idx;
