-- Five user-owned tables. RLS is enabled in the same migration as each
-- table; pack_id defaults to 'de' (platform Phase 4 interlock).

create table public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now()
);

create table public.srs_state (
  user_id       uuid not null references auth.users(id) on delete cascade,
  pack_id       text not null default 'de',
  srs_key       text not null,  -- the engine's full key, verbatim: '<deckId>:<cardId>'
  box           smallint not null default 1 check (box between 1 and 5),
  last_reviewed timestamptz,
  next_due      timestamptz,
  reps          integer not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (user_id, pack_id, srs_key)
);

create table public.stats_daily (
  user_id    uuid not null references auth.users(id) on delete cascade,
  pack_id    text not null default 'de',
  day        date not null,
  counters   jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, pack_id, day)
);

create table public.decks (
  user_id    uuid not null references auth.users(id) on delete cascade,
  pack_id    text not null default 'de',
  deck_id    text not null,
  name       text not null,
  cards      jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  primary key (user_id, pack_id, deck_id)
);

create table public.settings (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- ── RLS ──────────────────────────────────────────────────────────────

alter table public.profiles    enable row level security;
alter table public.srs_state   enable row level security;
alter table public.stats_daily enable row level security;
alter table public.decks       enable row level security;
alter table public.settings    enable row level security;

-- profiles: select / insert / update own. NO delete policy — account
-- deletion is a B3 server-side operation (FK cascade handles the rows).
create policy "select own profile" on public.profiles
  for select using (auth.uid() = user_id);
create policy "insert own profile" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "update own profile" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "select own rows" on public.srs_state
  for select using (auth.uid() = user_id);
create policy "insert own rows" on public.srs_state
  for insert with check (auth.uid() = user_id);
create policy "update own rows" on public.srs_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own rows" on public.srs_state
  for delete using (auth.uid() = user_id);

create policy "select own rows" on public.stats_daily
  for select using (auth.uid() = user_id);
create policy "insert own rows" on public.stats_daily
  for insert with check (auth.uid() = user_id);
create policy "update own rows" on public.stats_daily
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own rows" on public.stats_daily
  for delete using (auth.uid() = user_id);

create policy "select own rows" on public.decks
  for select using (auth.uid() = user_id);
create policy "insert own rows" on public.decks
  for insert with check (auth.uid() = user_id);
create policy "update own rows" on public.decks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own rows" on public.decks
  for delete using (auth.uid() = user_id);

create policy "select own rows" on public.settings
  for select using (auth.uid() = user_id);
create policy "insert own rows" on public.settings
  for insert with check (auth.uid() = user_id);
create policy "update own rows" on public.settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own rows" on public.settings
  for delete using (auth.uid() = user_id);

-- ── profiles auto-create on signup (canonical Supabase pattern) ─────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
