-- Close Supabase advisor WARN 0029
-- (`authenticated_security_definer_function_executable`) for
-- public.is_league_member(uuid, uuid).
--
-- DO NOT apply this to production from an agent. The owner applies it to
-- Sprachschule (xcnnlczvxmuwcqwychox) after merge, via the dashboard SQL
-- editor. Never `migration repair`, `db push`, or MCP apply_migration.
--
-- Why not SECURITY INVOKER
-- ------------------------
-- The helper exists so the league_members / leagues SELECT policies can
-- test membership without RLS self-recursion. INVOKER would query
-- league_members under RLS and recurse. Keep SECURITY DEFINER.
--
-- Why not revoke EXECUTE while leaving the function in public
-- -----------------------------------------------------------
-- 20260627000200 granted EXECUTE to authenticated so policy evaluation
-- could call the helper. That grant is also what PostgREST exposes as
-- POST /rest/v1/rpc/is_league_member (advisor 0029).
--
-- Revoking EXECUTE from authenticated in `public` does close the RPC —
-- and it also 42501s every league SELECT. PostgreSQL checks function
-- privileges as the querying role when evaluating RLS. The RLS Policy
-- Tests job on PR #290 confirmed that: `permission denied for function
-- is_league_member`.
--
-- The fix: move the helper to schema `private`, which is not in
-- PostgREST's exposed schemas (`public`, `graphql_public` in
-- supabase/config.toml). Grant authenticated USAGE on the schema and
-- EXECUTE on the function so RLS still works. Drop the public function
-- so /rpc/is_league_member is gone. Do not re-grant EXECUTE on a
-- public.is_league_member — that would reopen the RPC.
--
-- Callers: api/ never RPCs is_league_member. src/lib/leagues.js only
-- SELECTs league_members / leagues. The profile endpoint RPCs
-- shares_league (already service_role-only).
--
-- After apply: a signed-in learner must still load their league standings.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_league_member(p_league uuid, p_user uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league and user_id = p_user
  );
$$;

revoke all on function private.is_league_member(uuid, uuid) from public;
revoke execute on function private.is_league_member(uuid, uuid) from anon, public;
grant execute on function private.is_league_member(uuid, uuid) to authenticated;

-- ALTER POLICY rather than DROP + CREATE: swaps the expression in place so
-- there is never an instant where the table is unprotected. Same reason as
-- 20260906000500. Keep the InitPlan wrap on auth.uid(). Do this BEFORE
-- dropping the public function.
alter policy "read my league rows" on public.league_members
  using (private.is_league_member(league_id, (select auth.uid())));

alter policy "read my leagues" on public.leagues
  using (private.is_league_member(id, (select auth.uid())));

drop function public.is_league_member(uuid, uuid);
