-- Soft-delete for custom decks: the sync engine's first deletable record.
--
-- Every other synced table is grow-only. srs_state and settings are last-write-
-- wins over records that are only ever added or edited, and stats_daily is an
-- additive counter merge — none of them can express "this record is gone". So
-- the engine has only ever upserted, and a deck removed on device A was
-- silently re-added by device B's next pull, which still held the row and
-- upserted it back.
--
-- A tombstone gives deletion a timestamp, so it can be compared. The client
-- merge stays exactly what it was — per-deck last-write-wins on updated_at —
-- and a tombstone is simply the row whose latest write happened to be a
-- deletion. Nothing about the comparison changes; only what the winning row
-- means. An edit newer than the tombstone legitimately resurrects the deck,
-- which is correct: someone generated a new one after the delete.
--
-- Nullable with no default: NULL means live, and every existing row is live.
--
-- NO RLS or grant change is needed, and none is made. Soft delete is an UPDATE,
-- and `update own rows` already covers it on both sides:
--     using (auth.uid() = user_id) with check (auth.uid() = user_id)
-- so a caller can neither tombstone another user's deck nor move a row to
-- another owner while tombstoning it. `authenticated` already holds UPDATE on
-- this table; `anon` holds nothing. The existing DELETE policy stays for a
-- future hard-delete/retention pass, which is deliberately not part of this
-- change — see the epic spec §9.
--
-- Idempotent so re-running against an already-migrated database is a no-op.
alter table public.decks
  add column if not exists deleted_at timestamptz;

comment on column public.decks.deleted_at is
  'Soft-delete tombstone. NULL = live. Set to the deletion time so the client''s per-deck last-write-wins merge can compare a deletion against an edit; without it an offline delete is resurrected by the other device''s next pull.';
