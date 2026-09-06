-- L1: apply_progress_event becomes a writer of league_members.weekly_xp.
--
-- WHY: api/v1/league/refresh.js was the ONLY writer of a non-zero weekly_xp,
-- and it updates only the caller's own row. E4/E5 moved progress writes
-- server-side into this RPC, which had no league write at all, so a member's
-- league XP advanced only when THEY personally opened the Stats tab. Every
-- rival on the leaderboard rendered at their last-tab-visit XP.
--
-- WHY RECOMPUTE AND NOT INCREMENT: an increment has to re-derive the XP delta
-- of a single event and would drift from weeklyXpFromRows the moment the two
-- formulas disagree. Recomputing the week from stats_daily is self-healing: it
-- converges on the same number refresh.js would write, so refresh.js survives
-- as a reconciliation path rather than a competing writer.
--
-- ARITY IS UNCHANGED (still 8 args), so this is a plain CREATE OR REPLACE. Do
-- not change the signature here — E4's outage was a deployed endpoint calling
-- an 8-arg RPC against a 7-arg database.

-- Pure: the SQL twin of xpForDay (src/lib/xpCore.js). Iterates the ACTUAL keys
-- of byLevel rather than a fixed list, because xpForDay iterates
-- Object.values(day.byLevel) — a level key outside a1/a2/b1 still counts there
-- and must still count here. Immutable and side-effect free, so it is testable
-- without writing a row (same reason progress_counters_apply is split out).
--
-- The verdict weights are XP_PER_VERDICT in src/lib/gameConfig.js. They are
-- duplicated here because SQL cannot import them; a unit test asserts the two
-- copies are equal, which is the only thing standing between the lanes and
-- silent drift.
create or replace function public.progress_day_xp(counters jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce((
    select sum(
      coalesce((lv.value->>'correct')::integer, 0) * 10 +
      coalesce((lv.value->>'almost')::integer, 0) * 6 +
      coalesce((lv.value->>'wrong')::integer, 0) * 3
    )
    from jsonb_each(coalesce(counters->'byLevel', '{}'::jsonb)) as lv
  ), 0)::integer
  + coalesce((counters->>'bonusXp')::integer, 0);
$$;

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
  v_period      date;
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

  -- Everything below is reached ONLY on a freshly-inserted event id, so a
  -- replayed event returns above and cannot move league XP.
  --
  -- date_trunc('week') is ISO: it returns the Monday, which is exactly what
  -- currentPeriodStart (src/lib/leagueCountdown.js) computes. Keying off p_day
  -- rather than now() is what makes a queued offline event land in the week it
  -- was earned instead of the week it was delivered.
  v_period := date_trunc('week', p_day)::date;

  -- `rank is null` means "not yet settled". A settled league is a historical
  -- record — a late offline event must never re-rank a finished week.
  -- No pack filter: refresh.js sums across every pack, and the two writers
  -- must agree on the total.
  update public.league_members lm
     set weekly_xp = coalesce((
           select sum(public.progress_day_xp(sd.counters))
             from public.stats_daily sd
            where sd.user_id = p_user_id
              and sd.day >= v_period
              and sd.day < v_period + 7
         ), 0)::integer,
         updated_at = now()
   where lm.user_id = p_user_id
     and lm.period_start = v_period
     and lm.rank is null;

  delete from public.progress_events_seen
   where user_id = p_user_id
     and created_at < now() - interval '30 days';

  return next_counters;
end $$;

revoke execute on function public.progress_day_xp(jsonb) from public;
revoke execute on function public.progress_day_xp(jsonb) from anon, authenticated;
grant  execute on function public.progress_day_xp(jsonb) to service_role;

revoke execute on function public.apply_progress_event(uuid, text, date, text, text, text, integer, uuid) from public;
revoke execute on function public.apply_progress_event(uuid, text, date, text, text, text, integer, uuid) from anon, authenticated;
grant  execute on function public.apply_progress_event(uuid, text, date, text, text, text, integer, uuid) to service_role;
