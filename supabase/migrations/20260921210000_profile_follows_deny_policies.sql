-- Close Supabase advisor INFO 0008 (`rls_enabled_no_policy`) for
-- public.profile_follows, the social-graph table added by #316
-- (20260921192802_profile_follows.sql).
--
-- DO NOT apply this to production from an agent. The owner applies it to
-- Sprachschule (xcnnlczvxmuwcqwychox) via the dashboard SQL editor. Never
-- `migration repair`, `db push`, `db reset`, or MCP apply_migration.
--
-- Why this table has no client access
-- -----------------------------------
-- profile_follows is the directed in-app follow graph. Browser clients never
-- read or write it: the authenticated server endpoints validate the caller
-- and use the service role for the exact read/insert/delete they need. The
-- creating migration already enabled RLS and revoked every grant from anon
-- and authenticated, so the Data API is already denied.
--
-- The advisor still flags it, because "RLS on, no policies" is
-- indistinguishable from a forgotten policy. That ambiguity is the whole
-- problem: on this schema a table with no policy should mean somebody
-- forgot, never "it is fine here". #293 settled the convention for
-- rate_limits and progress_events_seen; this file extends it to the third
-- server-only table so the rule stays exceptionless.
--
-- Fix: keep RLS enabled. Add a deny-all policy for the Data API roles
-- (USING false / WITH CHECK false) so the catalog states the intent, then
-- re-assert the privilege layer. Do not add a policy that grants client
-- access. Do not FORCE RLS — service_role has BYPASSRLS and the SECURITY
-- DEFINER paths run as postgres, which also bypasses.
--
-- Note the grant list is deliberately narrower than #293's: a follow row is
-- created or removed, never edited, so service_role gets select/insert/delete
-- and NOT update. supabase/tests/rls/server-only-tables.test.js asserts both
-- the granted and the withheld privileges.
--
-- After apply: the profile endpoints keep working unchanged. Advisor 0008
-- for profile_follows should clear, leaving
-- auth_leaked_password_protection (owner checklist §7) as the only
-- outstanding security advisor.

alter table public.profile_follows enable row level security;

drop policy if exists "no client access" on public.profile_follows;
create policy "no client access"
  on public.profile_follows
  for all
  to anon, authenticated
  using (false)
  with check (false);

revoke all on table public.profile_follows from anon, authenticated;

grant select, insert, delete on table public.profile_follows to service_role;
