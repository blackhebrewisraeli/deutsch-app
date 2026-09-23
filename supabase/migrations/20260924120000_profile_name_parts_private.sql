-- Profile name parts + private profiles.
--
-- 1. first_name / middle_name / last_name replace the single display_name as
--    the thing a learner edits. display_name stays, but GENERATED from the
--    parts, so every reader — the passport, Find People, the home header, the
--    account sheet, export — keeps its one field and cannot drift from them.
--
--    The parts are NULLABLE on purpose. handle_new_user creates this row at
--    first sign-in with only (user_id, handle), and on 2026-09-24 three of the
--    four production profiles had no name at all: NOT NULL here would fail
--    every new sign-up and would have to invent names for most existing rows.
--    "First and last are required" is enforced where a name is WRITTEN — the
--    Settings form and api/_lib/accountEndpoints.js — not on the column.
--
-- 2. is_private hides a learner from Find People and locks their passport to
--    name, handle and avatar for everyone but themselves (socialEndpoints.js,
--    api/v1/league/profile.js). League standings already render only the
--    handle, so there is nothing to hide there.

alter table public.profiles
  add column first_name  text,
  add column middle_name text,
  add column last_name   text,
  add column is_private  boolean not null default false;

-- Split existing names on whitespace: first word → first_name, last word →
-- last_name, anything between → middle_name. A single word becomes a first name
-- with no last name — the form asks for one on the next save. Nothing is
-- invented, and a nameless row stays nameless.
update public.profiles p
   set first_name  = s.w[1],
       last_name   = case when cardinality(s.w) > 1 then s.w[cardinality(s.w)] end,
       middle_name = case when cardinality(s.w) > 2
                          then array_to_string(s.w[2:cardinality(s.w) - 1], ' ') end
  from (
    select user_id, regexp_split_to_array(btrim(display_name), '\s+') as w
      from public.profiles
     where display_name is not null and btrim(display_name) <> ''
  ) s
 where p.user_id = s.user_id;

-- Nothing depends on the column (no views, no function bodies — checked against
-- production pg_depend / pg_proc on 2026-09-24). Its column grants go with it.
alter table public.profiles drop column display_name;

-- Every function here is IMMUTABLE, which a generated column requires —
-- concat_ws is only STABLE, hence the coalesce/regexp_replace spelling. The
-- regexp collapses the double space a missing middle name leaves behind.
alter table public.profiles
  add column display_name text generated always as (
    nullif(
      regexp_replace(
        btrim(coalesce(first_name, '') || ' ' || coalesce(middle_name, '') || ' ' || coalesce(last_name, '')),
        '\s+', ' ', 'g'
      ),
      ''
    )
  ) stored;

-- 20260918153000 narrowed authenticated's writes to the fields Settings edits.
-- The dropped display_name took its grant with it; a generated column cannot be
-- written, so it gets none. The API (service_role) remains the normal writer.
grant insert (first_name, middle_name, last_name, is_private)
  on table public.profiles to authenticated;
grant update (first_name, middle_name, last_name, is_private)
  on table public.profiles to authenticated;

comment on column public.profiles.first_name is
  'Given name. Nullable (rows are created at sign-in without one); the Settings form and the profile API require first + last on any name write.';
comment on column public.profiles.middle_name is 'Optional middle name(s).';
comment on column public.profiles.last_name is
  'Family name. Nullable for the same reason as first_name.';
comment on column public.profiles.display_name is
  'GENERATED: first, middle and last joined by single spaces; NULL when all three are empty. Read-only.';
comment on column public.profiles.is_private is
  'Hides the learner from Find People and locks their passport to name, handle and avatar for anyone but themselves.';
