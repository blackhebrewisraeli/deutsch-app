-- Social leagues: public competition data only. Private stats_daily/srs_state
-- stay strictly own-row. The service-role serverless endpoints are the sole
-- writers; clients only SELECT, scoped to their own league.

alter table public.profiles add column handle       text unique;
alter table public.profiles add column avatar_emoji text;

create table public.leagues (
  id           uuid primary key default gen_random_uuid(),
  tier         smallint not null check (tier between 0 and 4),
  period_start date not null,
  pack_id      text not null default 'de',
  created_at   timestamptz not null default now()
);

create table public.league_members (
  league_id  uuid not null references public.leagues(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  handle     text not null,
  weekly_xp  integer not null default 0,
  rank       smallint,
  result     text check (result in ('promoted','demoted','held')),
  updated_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

create index league_members_user_idx on public.league_members (user_id);
create index leagues_tier_period_idx  on public.leagues (tier, period_start);

-- security definer membership test avoids RLS self-recursion on league_members
create or replace function public.is_league_member(p_league uuid, p_user uuid)
returns boolean
language sql
security definer set search_path = ''
stable
as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league and user_id = p_user
  );
$$;

alter table public.leagues        enable row level security;
alter table public.league_members enable row level security;

-- members read every row of leagues they belong to; no client writes
create policy "read my league rows" on public.league_members
  for select using (public.is_league_member(league_id, auth.uid()));

create policy "read my leagues" on public.leagues
  for select using (public.is_league_member(id, auth.uid()));
