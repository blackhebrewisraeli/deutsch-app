-- Converge legacy databases on the explicit Data API model introduced in
-- 20260612201311_data_api_explicit_grants.sql. Databases provisioned under
-- the pre-2026 auto-expose default (including this project's remote) carry
-- blanket grants for anon and authenticated on every public table, plus
-- default privileges that would re-create those grants on each new entity.
-- Fresh databases under the revoked default are unaffected: every statement
-- below is a no-op there, so local stacks, CI, and production all converge.

-- 1. Strip the legacy blanket table grants from the Data API user roles.
revoke all on table
  public.profiles,
  public.srs_state,
  public.stats_daily,
  public.decks,
  public.settings,
  public.rate_limits
from anon, authenticated;

-- 2. Re-grant the model (same statements as 20260612201311): authenticated
--    gets own-row CRUD, scoped by RLS; no delete on profiles; nothing on
--    rate_limits; anon stays at zero.
grant select, insert, update on table public.profiles to authenticated;

grant select, insert, update, delete on table
  public.srs_state,
  public.stats_daily,
  public.decks,
  public.settings
to authenticated;

-- 3. Stop future migration-created objects from auto-exposing: remove anon
--    and authenticated from postgres' default privileges in public. New
--    tables and functions then need explicit grants (the rate_limits
--    migration shows the function pattern). service_role keeps its defaults
--    (full server-lane access); supabase_admin's defaults are
--    platform-managed and flip with the upstream rollout.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;
