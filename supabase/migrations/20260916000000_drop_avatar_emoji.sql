-- Drop profiles.avatar_emoji.
--
-- Production had zero non-empty values when this was written (checked
-- 2026-09-16): one profile has an upload, none have an emoji. The client
-- resolver is now uploaded image → identicon; keeping an unused column would
-- leave a third fallback in the schema for no reader.
--
-- Also restates the avatar_path comment so it no longer describes the
-- three-tier chain this migration ends. The original comment lives on
-- 20260901000000_avatars_bucket.sql as a record of what shipped then.

alter table public.profiles
  drop column if exists avatar_emoji;

comment on column public.profiles.avatar_path is
  'Object path in the public `avatars` bucket, e.g. "<user_id>/<uuid>.webp". NULL = no upload; the client falls back to an identicon generated from the user id. Stores the path, never a full URL — the storage base URL differs per environment.';
