-- Lesson content: the language-blind unit of practice. NOT user data — no
-- user_id, publicly readable, service-role-only writes. Deliberately kept out
-- of EXPORTED_TABLES / EXCLUDED_TABLES in api/v1/account/export.js, whose
-- union assertion is over tables that have an owner.
--
-- RLS is enabled in this same file, matching every other table migration and
-- the ensure_rls event trigger (20260827000000). No follow-up statement.

create table public.lessons (
  id           uuid primary key default gen_random_uuid(),
  pack_id      text not null default 'de',
  course_code  text not null default 'de',
  level        text not null,
  unit_number  integer not null check (unit_number >= 1),
  tab          text not null,
  exercises    jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (pack_id, course_code, level, tab, unit_number)
);

-- The read path is always (course_code, level, tab) ordered by unit_number.
create index lessons_lookup_idx
  on public.lessons (course_code, level, tab, unit_number);

-- Closed sets fail at insert, not at first render.
alter table public.lessons
  add constraint lessons_level_check check (level in ('a1', 'a2', 'b1'));
alter table public.lessons
  add constraint lessons_tab_check check (tab in ('chat', 'alphabet', 'vocab', 'translate'));
-- v1 is German-only, made structural. Adding 'de-he' later is one
-- drop/add constraint plus rows — not a user-table migration, not a second pack.
alter table public.lessons
  add constraint lessons_course_code_check check (course_code in ('de'));
alter table public.lessons
  add constraint lessons_exercises_is_array check (jsonb_typeof(exercises) = 'array');

alter table public.lessons enable row level security;

create policy "lessons are publicly readable"
  on public.lessons
  for select
  to anon, authenticated
  using (true);

-- No insert / update / delete policies on purpose: clients cannot write.
--
-- RLS bypass is NOT a privilege. service_role skips policies, but it still
-- needs a table grant like any other role, and under the Data API default that
-- replaced `api.auto_expose_new_tables` a new table in `public` carries no
-- privileges for anyone until they are granted explicitly — see the header of
-- 20260612201311_data_api_explicit_grants.sql, which grants every earlier
-- table, and 20260627000300 which does the same for the league tables.
--
-- Omitting this line still passes locally, because a local stack created under
-- the older permissive default hands service_role the privileges anyway. CI
-- builds its stack under the new default and fails with
-- `42501 permission denied for table lessons` on the first seeding insert.
grant all on table public.lessons to service_role;

revoke insert, update, delete on public.lessons from anon, authenticated;
grant select on public.lessons to anon, authenticated;
