-- stats_daily becomes read-only for the Data API.
--
-- Until now a signed-in learner could INSERT / UPDATE / DELETE their own
-- stats_daily rows straight from the browser (20260611232000 policies plus the
-- own-row CRUD grant from 20260613001606). Every XP reader — lifetime XP,
-- streaks, weekly_xp, leaderboards — sums this table, so that was an open
-- faucet: `supabase.from('stats_daily').upsert({ counters: { bonusXp: 1e6 } })`
-- and the league is yours.
--
-- Nothing legitimate uses those grants. The browser only SELECTs (src/lib/sync.js
-- pullAndMerge). Every write already goes through the server:
--   - apply_progress_event — SECURITY DEFINER, service_role only, called by
--     POST /api/v1/progress/events (api/_lib/progressHandlers.js)
--   - assign_user_to_bucket — SECURITY DEFINER, reads only
--   - God Mode (api/_lib/adminGodMode.js) — service_role
--   - account delete — ON DELETE CASCADE from auth.users
-- service_role has BYPASSRLS and the definer functions run as postgres, so
-- neither the grant nor the policy change below touches them.
--
-- Keep: RLS enabled and the "select own rows" policy — the sync pull needs it.

drop policy if exists "insert own rows" on public.stats_daily;
drop policy if exists "update own rows" on public.stats_daily;
drop policy if exists "delete own rows" on public.stats_daily;

revoke all on table public.stats_daily from anon, authenticated;
grant select on table public.stats_daily to authenticated;
