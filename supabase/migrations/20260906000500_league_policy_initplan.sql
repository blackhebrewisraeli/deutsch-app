-- L2: stop re-evaluating auth.uid() once per candidate row.
--
-- Supabase's performance linter (auth_rls_initplan) flagged both league
-- policies. In `is_league_member(league_id, auth.uid())` the auth lookup is a
-- correlated expression, so the planner runs it for EVERY row it considers.
-- Wrapping it as `(select auth.uid())` makes it an uncorrelated subquery, which
-- Postgres hoists into an InitPlan and evaluates exactly once per statement.
--
-- The leaderboard read is the hot path: fetchStandings selects every member row
-- of the caller's league, so the per-row cost is multiplied by the cohort size
-- on the one query users actually wait for.
--
-- ALTER POLICY rather than DROP + CREATE: it swaps the expression in place, so
-- there is never an instant where the table is unprotected. A DROP would open
-- exactly that window, and on these two tables the policy IS the access
-- control — there is no second policy to fall back on.
--
-- The security-definer helper stays in the expression. It is what prevents RLS
-- self-recursion on league_members (a policy on the table cannot itself query
-- the table under RLS), so inlining the membership test here would trade a
-- performance warning for an infinite recursion.

alter policy "read my league rows" on public.league_members
  using (public.is_league_member(league_id, (select auth.uid())));

alter policy "read my leagues" on public.leagues
  using (public.is_league_member(id, (select auth.uid())));
