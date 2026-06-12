create table public.rate_limits (
  key          text not null,
  window_start bigint not null,   -- epoch ms, matches api/_lib/ratelimit.js window math
  count        integer not null default 1,
  primary key (key, window_start)
);

alter table public.rate_limits enable row level security;
-- no policies on purpose: invisible to anon and authenticated; service role only

create or replace function public.increment_rate_limit(p_key text, p_window_start bigint)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare new_count integer;
begin
  -- opportunistic cleanup of this key's expired windows (bounded, indexed)
  delete from public.rate_limits
    where key = p_key and window_start < p_window_start;

  insert into public.rate_limits (key, window_start, count)
    values (p_key, p_window_start, 1)
  on conflict (key, window_start)
    do update set count = public.rate_limits.count + 1
  returning count into new_count;

  return new_count;
end $$;

revoke execute on function public.increment_rate_limit(text, bigint) from public;
revoke execute on function public.increment_rate_limit(text, bigint) from anon, authenticated;
grant  execute on function public.increment_rate_limit(text, bigint) to service_role;
