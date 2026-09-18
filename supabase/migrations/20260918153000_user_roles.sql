-- Admin v1: feedback triage columns + account block flag.
--
-- Admin permission is NOT stored here. It is computed on the server from
-- verified emails (api/_lib/roles.js). A column the client can UPDATE would
-- be a self-promotion hole — authenticated already has UPDATE on profiles
-- for handle / avatar, so this file also narrows those grants.
--
-- DO NOT apply this to production from an agent. The owner applies it to
-- Sprachschule (xcnnlczvxmuwcqwychox) after merge, under AGENTS.md.

-- ── feedback status ────────────────────────────────────────────────

alter table public.feedback
  add column status text not null default 'open',
  add column handled_at timestamptz,
  add column handled_by uuid references auth.users(id) on delete set null;

alter table public.feedback
  add constraint feedback_status_check
  check (status in ('open', 'handled'));

comment on column public.feedback.status is
  'Owner triage: open (default) or handled. Clients have no UPDATE; the admin API writes this via service_role.';

comment on column public.feedback.handled_at is
  'Set when status becomes handled; cleared when reopened.';

comment on column public.feedback.handled_by is
  'auth.users.id of the admin who last marked handled. NULL when open.';

create index feedback_status_created_at_idx
  on public.feedback (status, created_at desc);

-- ── block flag ─────────────────────────────────────────────────────

alter table public.profiles
  add column blocked_at timestamptz;

comment on column public.profiles.blocked_at is
  'Set by the admin API (service_role). NULL = not blocked. Authenticated clients cannot write this column.';

-- Authenticated currently holds table-level INSERT/UPDATE, which would let a
-- learner PATCH blocked_at on their own row under "update own profile".
-- Narrow the grants to the fields Settings actually edits.
revoke insert, update on table public.profiles from authenticated;
grant insert (user_id, display_name, handle, avatar_path)
  on table public.profiles to authenticated;
grant update (display_name, handle, avatar_path)
  on table public.profiles to authenticated;

-- Belt: even a future GRANT that re-widens UPDATE cannot flip blocked_at
-- unless the caller is service_role. Triggers still fire for service_role;
-- auth.role() is 'service_role' on that path.
create or replace function public.protect_profile_blocked_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.blocked_at is distinct from old.blocked_at
     and auth.role() is distinct from 'service_role' then
    raise exception 'blocked_at is not client-writable'
      using errcode = '42501';
  end if;
  return new;
end
$$;

create trigger profiles_protect_blocked_at
  before update on public.profiles
  for each row execute function public.protect_profile_blocked_at();

-- Blocked signed-in users cannot file reports. Guests (user_id NULL) can.
create or replace function public.reject_blocked_feedback()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null and exists (
    select 1
    from public.profiles p
    where p.user_id = new.user_id
      and p.blocked_at is not null
  ) then
    raise exception 'blocked'
      using errcode = '42501';
  end if;
  return new;
end
$$;

revoke all on function public.protect_profile_blocked_at() from public, anon, authenticated;
grant execute on function public.protect_profile_blocked_at() to postgres, service_role;

revoke all on function public.reject_blocked_feedback() from public, anon, authenticated;
grant execute on function public.reject_blocked_feedback() to postgres, service_role;

create trigger feedback_reject_blocked
  before insert on public.feedback
  for each row execute function public.reject_blocked_feedback();
