-- Prevent a user from landing in more than one league per week. The join
-- endpoint's non-atomic find-then-insert could place a user in two leagues for
-- the same period (observed in prod 2026-06-28); join's idempotency check then
-- matched multiple rows and the endpoint 500'd on every subsequent call.
--
-- Denormalize period_start onto league_members and enforce one membership per
-- (user_id, period_start). period_start stays nullable so the currently-deployed
-- join.js (which doesn't set it) keeps working during the rollout window; the
-- new join.js sets it on insert, after which the unique index is fully effective.
alter table public.league_members add column if not exists period_start date;

update public.league_members lm
set period_start = l.period_start
from public.leagues l
where l.id = lm.league_id and lm.period_start is null;

create unique index if not exists league_members_user_period_uniq
  on public.league_members (user_id, period_start);
