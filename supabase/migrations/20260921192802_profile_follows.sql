-- Social graph for the in-app public profile. Browser clients never access
-- this table directly: authenticated server endpoints validate the caller and
-- use the service role for the exact read/insert/delete operations below.
create table public.profile_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followed_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint profile_follows_pkey primary key (follower_id, followed_id),
  constraint profile_follows_no_self_follow check (follower_id <> followed_id)
);

-- The primary key already indexes follower_id as its leading column. This
-- second index serves follower counts and cascade deletes by followed_id.
create index profile_follows_followed_id_idx
  on public.profile_follows (followed_id);

alter table public.profile_follows enable row level security;

-- New public-schema tables are not guaranteed to inherit Data API grants.
-- Keep the social graph private from browser roles and expose only the
-- operations required by the server-side profile endpoints.
revoke all on table public.profile_follows from anon, authenticated;
grant select, insert, delete on table public.profile_follows to service_role;

comment on table public.profile_follows is
  'Directed in-app social follows. Access is restricted to authenticated server endpoints.';
comment on column public.profile_follows.follower_id is
  'The account performing the follow.';
comment on column public.profile_follows.followed_id is
  'The account being followed.';
