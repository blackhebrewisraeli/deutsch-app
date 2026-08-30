-- Deck-scoped vocabulary mastery.
--
-- `settings.data->learnedWords` is keyed by card id alone, and a card id is the
-- German word itself. SRS is deck-scoped (`srs_key = '<deckId>:<cardId>'`);
-- mastery is not. Measured against the shipped lexicon, 1,064 of 4,243 card ids
-- — 25.1% — appear in more than one deck that can mark a word learned, so
-- learning `zwei` in Numbers also marks it in Core 100, Top 500 and A1.
--
-- WHY A COLUMN AND NOT A KEY INSIDE `data`:
--
-- `settingsToRow` in the client is an explicit allowlist. An older app version
-- serialises only the fields it knows about, so ANY new key placed inside
-- settings.data is erased from the server by that client's next push —
-- regardless of timestamps, and regardless of what the merge does, because the
-- old client never had the key to merge in the first place.
--
-- A separate column is immune: an old client's upsert names only
-- (user_id, data), and ON CONFLICT DO UPDATE SET touches just the columns the
-- payload carries. The old client cannot erase this one because it never names
-- it. That is the whole reason for the shape.
--
-- Nullable with no default: NULL means "this account has not migrated yet",
-- which is distinct from `{}` ("migrated, nothing learned yet") and worth being
-- able to tell apart when reading a bug report.
--
-- NO RLS or grant change, and none is made. A new column inherits the table's
-- policies, and `settings` already carries own-row select/insert/update for
-- `authenticated` and nothing at all for `anon`.
--
-- Idempotent so re-running against an already-migrated database is a no-op.
alter table public.settings
  add column if not exists learned_by_deck jsonb;

comment on column public.settings.learned_by_deck is
  'Deck-scoped mastery: { "<deckId>": { "<cardId>": true } }. Lives in its own column, NOT inside data, because an older client''s settings push serialises an explicit allowlist and would erase any unknown key inside data. NULL = not yet migrated.';
