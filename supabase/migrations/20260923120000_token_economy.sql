-- Token economy foundation: a per-learner balance, a server-only ledger, and
-- the two RPCs that are the ONLY way the balance moves.
--
-- DO NOT apply this to production from an agent. The owner applies it to
-- Sprachschule (xcnnlczvxmuwcqwychox) after merge, under AGENTS.md. Never
-- `migration repair`, `db push`, or MCP apply_migration.
--
-- Threat model
-- ------------
-- A balance the browser can write is a balance anyone can set to a billion.
-- So the client never supplies an amount it gains:
--   * profiles.tokens is not in authenticated's column grants (20260918153000
--     narrowed INSERT/UPDATE to display_name/handle/avatar_path), and a
--     trigger below rejects any change made as a Data API role, so a future
--     GRANT that re-widens UPDATE still cannot move it.
--   * award_tokens takes a REASON, and the server maps it to a fixed amount
--     and a daily cap. The client cannot choose how much it earns.
--   * spend_tokens only ever lowers the caller's own balance, atomically,
--     and never below zero.
-- Awards are still client-TRIGGERED (quest completion is derived in the
-- browser, stored nowhere), so the cap is what bounds abuse: at most
-- 3 × 10 tokens per learner per UTC day from daily quests.

-- ── balance ────────────────────────────────────────────────────────

-- `not null default 5000` fills every EXISTING row with 5000 in this same
-- statement, which is the backfill: Postgres applies a constant default to
-- current rows when the column is added. No separate UPDATE is needed, and
-- one would only rewrite the table a second time.
alter table public.profiles
  add column tokens integer not null default 5000,
  add constraint profiles_tokens_nonnegative check (tokens >= 0);

comment on column public.profiles.tokens is
  'Token balance. Beta starting grant 5000. Readable by the owner via "select own profile"; writable only through award_tokens / spend_tokens (SECURITY DEFINER) or service_role.';

-- Belt, same shape as protect_profile_blocked_at. current_user rather than
-- auth.role(): inside a SECURITY DEFINER RPC current_user is the function
-- owner, while auth.role() still reads the caller's JWT and would block the
-- RPC's own write.
create or replace function public.protect_profile_tokens()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.tokens is distinct from old.tokens
     and current_user in ('anon', 'authenticated') then
    raise exception 'tokens is not client-writable'
      using errcode = '42501';
  end if;
  return new;
end
$$;

revoke all on function public.protect_profile_tokens() from public, anon, authenticated;
grant execute on function public.protect_profile_tokens() to postgres, service_role;

create trigger profiles_protect_tokens
  before update on public.profiles
  for each row execute function public.protect_profile_tokens();

-- ── ledger ─────────────────────────────────────────────────────────

-- Every movement, keyed for idempotency: the same (user, reason, key) can
-- land once, so a retried request or a re-render cannot pay twice.
create table public.token_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  idem_key text not null,
  delta integer not null,
  created_at timestamptz not null default now(),
  constraint token_ledger_idem unique (user_id, reason, idem_key),
  constraint token_ledger_key_length check (char_length(idem_key) between 1 and 100)
);

create index token_ledger_user_reason_created_idx
  on public.token_ledger (user_id, reason, created_at desc);

-- Server-only, stated the way 20260918213000 states it for rate_limits.
alter table public.token_ledger enable row level security;
create policy "no client access"
  on public.token_ledger
  for all
  to anon, authenticated
  using (false)
  with check (false);
revoke all on table public.token_ledger from anon, authenticated;
grant all on table public.token_ledger to service_role;

-- ── award ──────────────────────────────────────────────────────────

-- Returns the caller's balance after the call. A duplicate key, an exhausted
-- daily cap, or a blocked account all return the unchanged balance rather than
-- erroring: the client reconciles to whatever comes back.
create or replace function public.award_tokens(p_reason text, p_key text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_amount integer;
  v_daily_cap integer;
  v_today_count integer;
  v_inserted bigint;
  v_balance integer;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  -- The reward table. The client names a reason; the amount is decided here.
  case p_reason
    when 'daily_quest' then v_amount := 10; v_daily_cap := 3;
    else raise exception 'unknown reward reason' using errcode = '22023';
  end case;

  select p.tokens into v_balance
  from public.profiles p
  where p.user_id = v_uid and p.blocked_at is null
  for update;
  if not found then
    -- No profile row, or blocked: nothing to credit.
    return (select p.tokens from public.profiles p where p.user_id = v_uid);
  end if;

  select count(*) into v_today_count
  from public.token_ledger l
  where l.user_id = v_uid
    and l.reason = p_reason
    and l.created_at >= date_trunc('day', now());
  if v_today_count >= v_daily_cap then
    return v_balance;
  end if;

  insert into public.token_ledger (user_id, reason, idem_key, delta)
  values (v_uid, p_reason, p_key, v_amount)
  on conflict on constraint token_ledger_idem do nothing
  returning id into v_inserted;
  if v_inserted is null then
    return v_balance;
  end if;

  update public.profiles
  set tokens = tokens + v_amount
  where user_id = v_uid
  returning tokens into v_balance;
  return v_balance;
end
$$;

-- ── spend ──────────────────────────────────────────────────────────

-- Deducts atomically or not at all. Idempotent on (reason, key) like awards,
-- so a retried purchase is not charged twice.
create or replace function public.spend_tokens(p_amount integer, p_reason text, p_key text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inserted bigint;
  v_balance integer;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000 then
    raise exception 'invalid amount' using errcode = '22023';
  end if;
  if p_reason is null or char_length(p_reason) not between 1 and 40 then
    raise exception 'invalid reason' using errcode = '22023';
  end if;

  select p.tokens into v_balance
  from public.profiles p
  where p.user_id = v_uid
  for update;
  if not found then
    raise exception 'no profile' using errcode = 'P0002';
  end if;

  insert into public.token_ledger (user_id, reason, idem_key, delta)
  values (v_uid, p_reason, p_key, -p_amount)
  on conflict on constraint token_ledger_idem do nothing
  returning id into v_inserted;
  if v_inserted is null then
    return v_balance;
  end if;

  if v_balance < p_amount then
    raise exception 'insufficient tokens' using errcode = 'P0001';
  end if;

  update public.profiles
  set tokens = tokens - p_amount
  where user_id = v_uid
  returning tokens into v_balance;
  return v_balance;
end
$$;

revoke all on function public.award_tokens(text, text) from public, anon;
revoke all on function public.spend_tokens(integer, text, text) from public, anon;
grant execute on function public.award_tokens(text, text) to authenticated, service_role;
grant execute on function public.spend_tokens(integer, text, text) to authenticated, service_role;
