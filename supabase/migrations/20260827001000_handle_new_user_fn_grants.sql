-- Least privilege for the last SECURITY DEFINER function still carrying
-- Postgres' default EXECUTE-to-PUBLIC grant, closing Supabase advisor lints
-- 0028/0029 for `public.handle_new_user()`.
--
-- Same reasoning as 20260627000200_league_fn_grants.sql (which tightened the
-- league functions) and 20260827000000_ensure_rls_event_trigger.sql: Postgres
-- grants EXECUTE to PUBLIC on every new function, so a SECURITY DEFINER
-- function lands on the REST RPC surface at /rest/v1/rpc/... by default.
--
-- Exploitability here is very low — handle_new_user() returns `trigger`, and
-- Postgres refuses to invoke a trigger function outside trigger context, so the
-- flagged route cannot actually run it. But "very low" is not the standard the
-- Security & Role Architecture section sets, and an advisor warning that is
-- always present is an advisor warning nobody reads.
--
-- IMPORTANT: this does NOT disturb the `on_auth_user_created` trigger on
-- auth.users. A trigger function is executed by the trigger mechanism as the
-- function owner; privilege is checked when the trigger is created, not on each
-- firing. Signup therefore still auto-creates the profiles row — verified
-- against a real GoTrue signup, with a control, before this shipped.

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon, authenticated;
