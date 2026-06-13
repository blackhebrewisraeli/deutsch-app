-- Explicit Data API privileges, replacing the deprecated auto-expose behaviour
-- (config `api.auto_expose_new_tables`, removed upstream on 2026-10-30). Under
-- the new default, entities in `public` carry no privileges for the Data API
-- roles until granted here. Idempotent and safe on databases created under
-- either default.
--
-- Exposure model:
--   service_role   full access to every table (server lane only; the key never
--                  leaves Vercel functions).
--   authenticated  own-row CRUD on the five user tables, enforced by the RLS
--                  policies in 20260611232000_user_tables.sql. No delete on
--                  profiles — account deletion is a B3 server-side operation,
--                  mirroring the deliberate absence of a delete policy.
--   anon           nothing. The app never ships an anon key (no VITE_SUPABASE_*
--                  vars); anonymous requests are denied at the privilege layer,
--                  before RLS is even consulted.
--   rate_limits    service_role only, matching its no-policies RLS posture;
--                  writes go through the increment_rate_limit RPC, whose
--                  execute grants are already explicit in its own migration.

grant select, insert, update on table public.profiles to authenticated;

grant select, insert, update, delete on table
  public.srs_state,
  public.stats_daily,
  public.decks,
  public.settings
to authenticated;

grant all on table
  public.profiles,
  public.srs_state,
  public.stats_daily,
  public.decks,
  public.settings,
  public.rate_limits
to service_role;
