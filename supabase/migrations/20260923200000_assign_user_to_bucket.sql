-- League engine: one atomic placement function, and placement on first XP.
--
-- A "bucket" is a public.leagues row — one cohort of at most LEAGUE_SIZE
-- members at one (tier, period_start). There is no separate bucket table and
-- no profiles.weekly_xp: league_members already is the per-week membership,
-- and weekly_xp is DERIVED from stats_daily (see L1, 20260905203500).
--
-- WHY THIS EXISTS:
--   1. Placement was a JS find-then-insert (join.js step 4, copied into God
--      Mode). Two concurrent joins could both see a cohort at 24 and overfill
--      it, or both see no room and each open a half-empty league. The advisory
--      lock below serializes placement per (tier, period); nothing else is
--      serialized, so unrelated tiers and the hot "already placed" path never
--      wait on it.
--   2. A learner was only placed when they opened the leaderboard, so someone
--      who studied all week without opening it was invisible to their rivals.
--      apply_progress_event now places the learner on their first XP of the
--      current week.
--   3. join.js ordered "last settled result" by the EMBEDDED leagues.period_start,
--      which PostgREST applies to the embed, not the parent rows — so the tier
--      could come from an arbitrary old week. Ordering by the denormalized
--      league_members.period_start here is the actual latest week.

-- 25 is LEAGUE_SIZE in src/lib/leagueZones.js. SQL cannot import it, so
-- api/_lib/leagueXpParity.test.js asserts the two copies are equal.
create or replace function public.assign_user_to_bucket(
  p_user_id uuid,
  p_period  date,
  p_tier    smallint default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tier   smallint;
  v_last   record;
  v_league uuid;
  v_member jsonb;
begin
  if p_user_id is null or p_period is null then
    raise exception 'user_id and period required';
  end if;

  -- Hot path, no lock: already placed this week (settled or not).
  select jsonb_build_object(
           'league_id', lm.league_id, 'tier', l.tier,
           'period_start', lm.period_start, 'handle', lm.handle)
    into v_member
    from public.league_members lm
    join public.leagues l on l.id = lm.league_id
   where lm.user_id = p_user_id and lm.period_start = p_period;
  if v_member is not null then
    return v_member;
  end if;

  -- Tier: an explicit one (God Mode), else last settled result stepped by one
  -- rung and clamped to the ladder (nextTier in api/_lib/leagueLogic.js).
  v_tier := p_tier;
  if v_tier is null then
    select l.tier, lm.result into v_last
      from public.league_members lm
      join public.leagues l on l.id = lm.league_id
     where lm.user_id = p_user_id
       and lm.result is not null
       and lm.period_start < p_period
     order by lm.period_start desc
     limit 1;
    v_tier := greatest(0, least(4, coalesce(v_last.tier, 0) + case v_last.result
                when 'promoted' then 1 when 'demoted' then -1 else 0 end));
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('league_bucket:' || v_tier || ':' || p_period, 0));

  -- Oldest cohort with room first, so cohorts fill before new ones open.
  select l.id into v_league
    from public.leagues l
   where l.tier = v_tier
     and l.period_start = p_period
     and (select count(*) from public.league_members m where m.league_id = l.id) < 25
   order by l.created_at, l.id
   limit 1;

  if v_league is null then
    insert into public.leagues (tier, period_start)
    values (v_tier, p_period)
    returning id into v_league;
  end if;

  -- weekly_xp is computed now rather than inserted as 0, so a mid-week
  -- placement shows the XP already earned instead of waiting for the next
  -- event. Same formula and window as apply_progress_event.
  -- ON CONFLICT: the same user racing themselves (two tabs) — the unique
  -- (user_id, period_start) index lets exactly one insert win.
  insert into public.league_members (league_id, user_id, handle, weekly_xp, period_start)
  select v_league, p.user_id, p.handle,
         coalesce((
           select sum(public.progress_day_xp(sd.counters))
             from public.stats_daily sd
            where sd.user_id = p_user_id
              and sd.day >= p_period
              and sd.day < p_period + 7
         ), 0)::integer,
         p_period
    from public.profiles p
   where p.user_id = p_user_id
  on conflict (user_id, period_start) do nothing;

  select jsonb_build_object(
           'league_id', lm.league_id, 'tier', l.tier,
           'period_start', lm.period_start, 'handle', lm.handle)
    into v_member
    from public.league_members lm
    join public.leagues l on l.id = lm.league_id
   where lm.user_id = p_user_id and lm.period_start = p_period;

  if v_member is null then
    raise exception 'no profile for user %', p_user_id;
  end if;
  return v_member;
end $$;

-- service_role only: a browser calling this could place itself at any tier.
revoke execute on function public.assign_user_to_bucket(uuid, date, smallint) from public;
revoke execute on function public.assign_user_to_bucket(uuid, date, smallint) from anon, authenticated;
grant  execute on function public.assign_user_to_bucket(uuid, date, smallint) to service_role;

-- apply_progress_event: unchanged except the placement block. ARITY IS
-- UNCHANGED (8 args) — see the E4 outage note in 20260905203500.
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

  -- First XP of the CURRENT week places the learner. A late offline event for
  -- a past week must not open a membership in a week that is already over.
  -- The subtransaction is only entered when there is no membership yet, and a
  -- placement failure must never lose the progress write above.
  if v_period = date_trunc('week', now() at time zone 'utc')::date
     and not exists (
       select 1 from public.league_members
        where user_id = p_user_id and period_start = v_period
     ) then
    begin
      perform public.assign_user_to_bucket(p_user_id, v_period);
    exception when others then
      raise warning 'assign_user_to_bucket failed for %: %', p_user_id, sqlerrm;
    end;
  end if;

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
