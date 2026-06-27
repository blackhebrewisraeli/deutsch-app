-- True if users a and b share a league whose period_start equals p_period.
create or replace function public.shares_league(p_a uuid, p_b uuid, p_period date)
returns boolean
language sql
security definer set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.league_members ma
    join public.league_members mb on ma.league_id = mb.league_id
    join public.leagues l on l.id = ma.league_id
    where ma.user_id = p_a and mb.user_id = p_b and l.period_start = p_period
  );
$$;
