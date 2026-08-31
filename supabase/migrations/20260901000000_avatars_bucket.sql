-- Avatar uploads: one public Storage bucket, four policies, one column.
--
-- WHY THE BUCKET IS PUBLIC. Leaderboards render other learners' avatars, and a
-- signed URL per row would mean one round trip per visible player on every
-- paint. Public is the right trade — but it makes the object path the only
-- thing standing between a user id and someone's picture, which is why the
-- filename carries a random segment (see the path convention below).
--
-- PATH CONVENTION: avatars/{user_id}/{random-uuid}.webp
--
--   The user id must be the FIRST segment. It is the only part of the name that
--   `storage.foldername(name)[1]` can compare against `auth.uid()`, so the whole
--   ownership model below depends on it.
--
--   The random second segment is not decoration. With a public bucket and a
--   guessable path, knowing a user id would hand you their avatar URL; the uuid
--   means the id alone is not enough. It also makes every upload a NEW object
--   rather than an overwrite, which is what lets a replaced avatar be deleted
--   deliberately instead of silently clobbered mid-request.
--
-- NO SVG. `image/svg+xml` is deliberately absent from allowed_mime_types and
-- must stay absent. An SVG is a script container; served from our own origin
-- out of a public bucket it is stored XSS with a friendly file extension. The
-- generated fallback avatar is SVG, but it is generated in the browser and
-- never round-trips through storage.
--
-- The size limit is declared on the BUCKET, not just checked in the client:
-- a client-side check is a courtesy to the user, not a control on the upload.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  262144, -- 256 KB; the client downscales to 256x256 WebP, which lands far under
  array['image/webp', 'image/png', 'image/jpeg']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── Policies ─────────────────────────────────────────────────────────
--
-- Postgres has no `create policy if not exists`, so each is dropped first to
-- keep this migration re-runnable.
--
-- storage.objects is shared by every bucket, so each policy is scoped by
-- bucket_id and named distinctly enough not to collide with a future bucket's.

drop policy if exists "avatars are publicly readable" on storage.objects;
create policy "avatars are publicly readable" on storage.objects
  for select
  using (bucket_id = 'avatars');

drop policy if exists "insert own avatar" on storage.objects;
create policy "insert own avatar" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- BOTH `using` AND `with check`, and the pair is the whole point.
--
-- `using` decides which rows you may act on. `with check` decides what the row
-- is allowed to look like afterwards. With `using` alone a learner could update
-- their OWN object and rename it into someone else's folder — a write outside
-- their namespace that overwrites another user's avatar, performed entirely
-- within a policy that reads as "update own avatar".
--
-- This is the same asymmetry the decks tombstone migration called out for the
-- update path, and supabase/tests/rls/policies.test.js stages it red.
drop policy if exists "update own avatar" on storage.objects;
create policy "update own avatar" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Replacing an avatar uploads a new object and deletes the old one, so DELETE
-- is part of the ordinary flow rather than a rarely-used escape hatch.
drop policy if exists "delete own avatar" on storage.objects;
create policy "delete own avatar" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── The column ───────────────────────────────────────────────────────
--
-- The object PATH, not a URL: the public base URL is environment-dependent
-- (local stack vs production project), so it is composed at render time and
-- never frozen into a row.
--
-- NULL means "no uploaded avatar", which falls through to the emoji and then to
-- the generated identicon.
alter table public.profiles
  add column if not exists avatar_path text;

comment on column public.profiles.avatar_path is
  'Object path in the public `avatars` bucket, e.g. "<user_id>/<uuid>.webp". NULL = no upload; the client falls back to avatar_emoji and then to an identicon generated from the user id. Stores the path, never a full URL — the storage base URL differs per environment.';
