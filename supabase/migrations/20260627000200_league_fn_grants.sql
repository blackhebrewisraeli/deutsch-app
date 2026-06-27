-- Lock down the league SECURITY DEFINER functions (Supabase advisors 0028/0029).
-- By default Postgres grants EXECUTE to PUBLIC, which exposes both functions on
-- the REST RPC surface (/rest/v1/rpc/...). Tighten to least privilege.

-- shares_league is called ONLY by the service-role profile endpoint. Exposing it
-- to anon/authenticated would let a signed-in user probe whether any two user_ids
-- share a league in a period (enumeration). Restrict to service_role.
revoke all on function public.shares_league(uuid, uuid, date) from public;
grant execute on function public.shares_league(uuid, uuid, date) to service_role;

-- is_league_member is referenced inside the league_members / leagues RLS policies,
-- so the authenticated role MUST retain EXECUTE for policy evaluation. anon never
-- satisfies the policy (auth.uid() is null) and has no need to call it directly.
revoke all on function public.is_league_member(uuid, uuid) from public;
grant execute on function public.is_league_member(uuid, uuid) to authenticated, service_role;
