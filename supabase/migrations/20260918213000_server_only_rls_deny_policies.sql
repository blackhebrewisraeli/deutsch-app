-- Close Supabase advisor INFO 0008 (`rls_enabled_no_policy`) for
-- public.rate_limits and public.progress_events_seen.
--
-- DO NOT apply this to production from an agent. The owner applies it to
-- Sprachschule (xcnnlczvxmuwcqwychox) after merge, via the dashboard SQL
-- editor, alongside 20260918200000_revoke_is_league_member_execute.sql if
-- that file is still unapplied. Never `migration repair`, `db push`, or
-- MCP apply_migration.
--
-- Why these tables have no client access
-- --------------------------------------
-- rate_limits is AI-lane counters. api/_lib/ratelimit.js talks to it only
-- through increment_rate_limit, as service_role. The Data API must not
-- SELECT/INSERT/UPDATE/DELETE it.
--
-- progress_events_seen holds idempotency keys for apply_progress_event.
-- The RPC is the only writer. api/_lib/accountEndpoints.js lists it in
-- EXCLUDED_TABLES; clients never touch the table.
--
-- Both already have RLS enabled and zero table grants for anon /
-- authenticated (20260613001606, 20260904140000). RLS with no policies
-- already denies the Data API. The advisor still flags "RLS on, no
-- policies" because it cannot tell a deliberate server-only table from a
-- forgotten policy.
--
-- Fix: keep RLS enabled. Add deny-all policies for the Data API roles
-- (USING false / WITH CHECK false) so the catalog states the intent.
-- Re-assert the privilege layer. Do not add a policy that grants client
-- access. Do not FORCE RLS — service_role has BYPASSRLS and the SECURITY
-- DEFINER RPCs run as postgres, which also bypasses.
--
-- After apply: AI rate limiting and progress-event ingest keep working.
-- Advisor 0008 for these two tables should clear. Learners never hit
-- these tables from the browser.

alter table public.rate_limits enable row level security;
alter table public.progress_events_seen enable row level security;

drop policy if exists "no client access" on public.rate_limits;
create policy "no client access"
  on public.rate_limits
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "no client access" on public.progress_events_seen;
create policy "no client access"
  on public.progress_events_seen
  for all
  to anon, authenticated
  using (false)
  with check (false);

revoke all on table public.rate_limits from anon, authenticated;
revoke all on table public.progress_events_seen from anon, authenticated;

grant all on table public.rate_limits to service_role;
grant all on table public.progress_events_seen to service_role;
