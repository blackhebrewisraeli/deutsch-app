-- Idempotency keys for apply_progress_event. User-owned (cascade delete) but
-- EXCLUDED from export: opaque tokens, and the counters they protect already
-- ship as `daily`.

create table public.progress_events_seen (
  user_id    uuid not null references auth.users(id) on delete cascade,
  event_id   uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create index progress_events_seen_created_at_idx
  on public.progress_events_seen (user_id, created_at);

alter table public.progress_events_seen enable row level security;
-- No client policies: the RPC is the only writer, matching rate_limits.
revoke all on public.progress_events_seen from anon, authenticated;
grant all on public.progress_events_seen to service_role;

-- New arity; OR REPLACE would overload and leave the 7-arg form callable.
drop function if exists public.apply_progress_event(uuid, text, date, text, text, text, integer);

create or replace function public.apply_progress_event(
  p_user_id   uuid,
  p_pack_id   text,
  p_day       date,
  p_tab       text,
  p_level     text,
  p_verdict   text,
  p_bonus_xp  integer,
  p_event_id  uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_counters jsonb;
  inserted      uuid;
begin
  if p_event_id is null then
    raise exception 'event_id required';
  end if;
  if p_tab not in ('chat', 'alphabet', 'vocab', 'translate') then
    raise exception 'invalid tab: %', p_tab;
  end if;
  if p_level not in ('a1', 'a2', 'b1') then
    raise exception 'invalid level: %', p_level;
  end if;
  if p_verdict not in ('correct', 'almost', 'wrong') then
    raise exception 'invalid verdict: %', p_verdict;
  end if;

  insert into public.progress_events_seen (user_id, event_id)
  values (p_user_id, p_event_id)
  on conflict (user_id, event_id) do nothing
  returning event_id into inserted;

  if inserted is null then
    select counters into next_counters
      from public.stats_daily
     where user_id = p_user_id and pack_id = p_pack_id and day = p_day;
    return coalesce(next_counters, '{}'::jsonb);
  end if;

  insert into public.stats_daily (user_id, pack_id, day, counters, updated_at)
  values (
    p_user_id, p_pack_id, p_day,
    public.progress_counters_apply('{}'::jsonb, p_tab, p_level, p_verdict, p_bonus_xp),
    now()
  )
  on conflict (user_id, pack_id, day) do update
    set counters = public.progress_counters_apply(
          public.stats_daily.counters, p_tab, p_level, p_verdict, p_bonus_xp),
        updated_at = now()
  returning counters into next_counters;

  delete from public.progress_events_seen
   where user_id = p_user_id
     and created_at < now() - interval '30 days';

  return next_counters;
end $$;

revoke execute on function public.apply_progress_event(uuid, text, date, text, text, text, integer, uuid) from public;
revoke execute on function public.apply_progress_event(uuid, text, date, text, text, text, integer, uuid) from anon, authenticated;
grant  execute on function public.apply_progress_event(uuid, text, date, text, text, text, integer, uuid) to service_role;
