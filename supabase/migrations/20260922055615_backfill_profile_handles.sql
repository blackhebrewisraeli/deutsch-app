-- Complete the identity split started by the leagues migration. `handle`
-- already exists in deployed databases, but older profiles can still have no
-- handle because one was minted only when the learner joined a league.
--
-- The generated value is deliberately derived from the immutable user id, not
-- from email or display_name: both of those are editable and may contain
-- characters that do not belong in a compact social identifier. The 16 hex
-- characters keep the complete fallback within the API's 24-character limit.

alter table public.profiles
  add column if not exists handle text unique;

update public.profiles
set handle = 'learner_' || left(replace(user_id::text, '-', ''), 16)
where handle is null or btrim(handle) = '';

-- The leaderboard stores a denormalised copy for fast standings reads. Keep
-- any pre-existing row aligned with the profile source of truth.
update public.league_members as member
set handle = profile.handle
from public.profiles as profile
where member.user_id = profile.user_id
  and member.handle is distinct from profile.handle;

-- Every future account receives its identity before any league interaction.
-- Replacing the existing trigger function preserves its owner and grants.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (user_id, handle)
  values (
    new.id,
    'learner_' || left(replace(new.id::text, '-', ''), 16)
  );
  return new;
end $$;

alter table public.profiles
  alter column handle set not null;

comment on column public.profiles.handle is
  'Unique social username stored without the UI @ prefix. Automatically assigned at signup and editable through the account profile API.';
