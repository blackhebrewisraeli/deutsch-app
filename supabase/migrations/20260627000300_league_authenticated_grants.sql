-- Data API grants for the league tables. This project revokes default
-- privileges (see 20260613001606_revoke_legacy_data_api_privileges.sql), so new
-- tables carry NO grants for authenticated until granted explicitly — without
-- this, PostgREST denies client reads with 42501 BEFORE the RLS SELECT policies
-- are ever consulted, and the leaderboard cannot load.
--
-- authenticated: SELECT only. Clients are read-only on the league tables; which
-- rows they see is scoped by the RLS "read my league" policies. The service-role
-- endpoints remain the sole writers (service_role already has full access via
-- its retained platform defaults — granted explicitly here too for parity).

grant select on table public.leagues, public.league_members to authenticated;

grant all on table public.leagues, public.league_members to service_role;
