-- L3: settle the whole cohort in one statement.
--
-- settle.js issued one UPDATE per member. A full cohort is LEAGUE_SIZE (25), so
-- one league cost 26 sequential round trips and a full run cost 26 x L, inside
-- a single 300s function. It was also not atomic per league: a failure halfway
-- through left some members ranked and some not, survivable only because
-- re-settlement re-ranks the entire set.
--
-- WHY THIS TAKES THE RANKING AS INPUT INSTEAD OF COMPUTING IT:
-- settleLeague/zoneCounts live in src/lib because the CLIENT shares them — the
-- leaderboard draws its promotion and relegation dividers with the same
-- function settlement uses, so the learner sees exactly who will advance.
-- Reimplementing the ranking here would fork that into two definitions that
-- drift, which is the L1 XP-formula problem all over again. So JS stays the one
-- ranking implementation, and SQL does the thing SQL is good at: applying the
-- whole result set atomically.
--
-- The `result` values are NOT validated here on purpose: league_members already
-- carries `check (result in ('promoted','demoted','held'))`, so a bad value
-- raises from the constraint. One enforcement point, not two that can disagree.
create or replace function public.apply_league_results(
  p_league_id uuid,
  p_results   jsonb
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if p_league_id is null then
    raise exception 'league_id required';
  end if;
  if jsonb_typeof(p_results) is distinct from 'array' then
    raise exception 'results must be a json array';
  end if;

  -- One statement, so the league either settles completely or not at all.
  -- Scoped by league_id as well as user_id: a caller cannot rank a member of a
  -- different league by passing someone else's user_id.
  update public.league_members lm
     set rank       = r.rank,
         result     = r.result,
         updated_at = now()
    from jsonb_to_recordset(p_results)
      as r(user_id uuid, rank smallint, result text)
   where lm.league_id = p_league_id
     and lm.user_id   = r.user_id;

  get diagnostics v_updated = row_count;
  return v_updated;
end $$;

-- service_role only. The cron function is the sole caller; a browser must never
-- reach this, or a learner could write their own rank.
revoke execute on function public.apply_league_results(uuid, jsonb) from public;
revoke execute on function public.apply_league_results(uuid, jsonb) from anon, authenticated;
grant  execute on function public.apply_league_results(uuid, jsonb) to service_role;
