-- The server twin of src/lib/stats.js applyEvent.
--
-- WHY A FUNCTION AND NOT A CLIENT UPSERT: an event is an INCREMENT. A client
-- doing read-modify-write on `counters` races itself across two devices — the
-- same reason B1 rejected JS-side rate-limit increments. increment_rate_limit
-- is the pattern being copied.
--
-- WHY TWO FUNCTIONS: progress_counters_apply is pure arithmetic and can be
-- tested without writing a row. apply_progress_event is the privileged writer,
-- and it calls the helper INSIDE `on conflict do update`, where the expression
-- is evaluated against the locked existing row. Computing the next value from a
-- separate SELECT first would reopen the very race this function exists to
-- close: two concurrent events would both read the same `prev` and one
-- increment would vanish.

-- Pure: normalize every bucket to 0, then increment exactly the four counters
-- applyEvent increments. Structurally mirrors normalizeDayAggregate, but is
-- STRICTER, not identical: the client's `?? 0` passes junk through silently,
-- while this raises on a non-integer or overflowing stored counter
-- (`{"total": "many"}` → invalid input syntax; `{"total": 2147483647}` →
-- integer out of range). That is the safer of the two behaviours and is left
-- as-is; a partially-written entry (older schema, or one merged in by sync)
-- still normalizes missing buckets to 0 rather than producing NULL, which
-- would otherwise spread silently through the XP arithmetic.
create or replace function public.progress_counters_apply(
  prev        jsonb,
  p_tab       text,
  p_level     text,
  p_verdict   text,
  p_bonus_xp  integer
) returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  tabs     text[] := array['chat', 'alphabet', 'vocab', 'translate'];
  levels   text[] := array['a1', 'a2', 'b1'];
  verdicts text[] := array['correct', 'almost', 'wrong'];
  out_json jsonb;
  t        text;
  lv       text;
  vd       text;
begin
  if p_tab not in ('chat', 'alphabet', 'vocab', 'translate') then
    raise exception 'invalid tab: %', p_tab;
  end if;
  if p_level not in ('a1', 'a2', 'b1') then
    raise exception 'invalid level: %', p_level;
  end if;
  if p_verdict not in ('correct', 'almost', 'wrong') then
    raise exception 'invalid verdict: %', p_verdict;
  end if;

  out_json := jsonb_build_object(
    'total',   coalesce((prev->>'total')::integer, 0),
    'bonusXp', coalesce((prev->>'bonusXp')::integer, 0),
    'byTab',   '{}'::jsonb,
    'byLevel', '{}'::jsonb
  );

  foreach t in array tabs loop
    out_json := jsonb_set(out_json, array['byTab', t],
      to_jsonb(coalesce((prev->'byTab'->>t)::integer, 0)));
  end loop;

  foreach lv in array levels loop
    out_json := jsonb_set(out_json, array['byLevel', lv], '{}'::jsonb);
    foreach vd in array verdicts loop
      out_json := jsonb_set(out_json, array['byLevel', lv, vd],
        to_jsonb(coalesce((prev->'byLevel'->lv->>vd)::integer, 0)));
    end loop;
  end loop;

  out_json := jsonb_set(out_json, '{total}',
    to_jsonb((out_json->>'total')::integer + 1));
  out_json := jsonb_set(out_json, '{bonusXp}',
    to_jsonb((out_json->>'bonusXp')::integer + coalesce(p_bonus_xp, 0)));
  out_json := jsonb_set(out_json, array['byTab', p_tab],
    to_jsonb((out_json->'byTab'->>p_tab)::integer + 1));
  out_json := jsonb_set(out_json, array['byLevel', p_level, p_verdict],
    to_jsonb((out_json->'byLevel'->p_level->>p_verdict)::integer + 1));

  return out_json;
end $$;

create or replace function public.apply_progress_event(
  p_user_id   uuid,
  p_pack_id   text,
  p_day       date,
  p_tab       text,
  p_level     text,
  p_verdict   text,
  p_bonus_xp  integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_counters jsonb;
begin
  if p_tab not in ('chat', 'alphabet', 'vocab', 'translate') then
    raise exception 'invalid tab: %', p_tab;
  end if;
  if p_level not in ('a1', 'a2', 'b1') then
    raise exception 'invalid level: %', p_level;
  end if;
  if p_verdict not in ('correct', 'almost', 'wrong') then
    raise exception 'invalid verdict: %', p_verdict;
  end if;

  -- One statement. The DO UPDATE expression reads the LOCKED existing row, so
  -- concurrent events serialise instead of clobbering one another.
  insert into public.stats_daily (user_id, pack_id, day, counters, updated_at)
  values (
    p_user_id, p_pack_id, p_day,
    public.progress_counters_apply('{}'::jsonb, p_tab, p_level, p_verdict, p_bonus_xp),
    now()
  )
  on conflict (user_id, pack_id, day) do update
    set counters = public.progress_counters_apply(
          public.stats_daily.counters, p_tab, p_level, p_verdict, p_bonus_xp),
        -- Server clock, unlike B2's writer-set LWW. See spec section 7.3
        -- before enabling a client that uses both write paths.
        updated_at = now()
  returning counters into next_counters;

  return next_counters;
end $$;

-- service_role only, exactly like increment_rate_limit. The Vercel function is
-- the only caller; a browser must never reach this directly.
revoke execute on function public.progress_counters_apply(jsonb, text, text, text, integer) from public;
revoke execute on function public.progress_counters_apply(jsonb, text, text, text, integer) from anon, authenticated;
grant  execute on function public.progress_counters_apply(jsonb, text, text, text, integer) to service_role;

revoke execute on function public.apply_progress_event(uuid, text, date, text, text, text, integer) from public;
revoke execute on function public.apply_progress_event(uuid, text, date, text, text, text, integer) from anon, authenticated;
grant  execute on function public.apply_progress_event(uuid, text, date, text, text, text, integer) to service_role;
