-- In-exercise problem reports. Clients INSERT; they cannot SELECT, UPDATE or
-- DELETE. The owner reads through the service role (dashboard / SQL editor);
-- there is no learner-facing inbox.
--
-- Guest reports are first-class: FeedbackButton sits on Vocab and Translate
-- with no auth gate, so a learner who never signed in can still file a report.
-- That is why this table is the one exception to "anon gets nothing" —
-- INSERT is granted to both `anon` and `authenticated`. SELECT is granted to
-- neither. service_role has full access for the owner read path.
--
-- user_id is nullable: signed-in reports are attributed (auth.uid()), guest
-- reports store NULL. Signed-in rows cascade on account deletion, matching
-- every other user-owned table; guest rows have no owner and stay.
--
-- RLS is enabled in this same file, matching every other table migration and
-- the ensure_rls event trigger (20260827000000).
--
-- DO NOT apply this to production from an agent. The owner applies it to
-- Sprachschule (xcnnlczvxmuwcqwychox) after merge, under AGENTS.md.

create table public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  surface     text,
  cefr_level  text,
  deck_id     text,
  item_id     text,
  -- Captured, never displayed to the learner: for a concealing drill this
  -- string IS the answer being asked for. Clients have no SELECT on this table.
  item_label  text,
  category    text not null,
  message     text not null,
  created_at  timestamptz not null default now(),
  constraint feedback_category_check
    check (category in ('translation', 'ui', 'audio')),
  constraint feedback_message_len_check
    check (char_length(btrim(message)) between 1 and 4000)
);

-- Cascade deletes and the owner read path both filter by user_id.
create index feedback_user_id_idx
  on public.feedback (user_id);

-- Owner triage is newest-first.
create index feedback_created_at_idx
  on public.feedback (created_at desc);

alter table public.feedback enable row level security;

-- Insert own row when signed in; insert a NULL user_id when anonymous.
-- `(select auth.uid())` is the InitPlan form (see 20260906000500).
-- `IS NOT DISTINCT FROM` treats NULLs as equal, so the same policy covers
-- both roles without a second "user_id is null" branch that would let a
-- signed-in client file an unattributed row.
create policy "insert own feedback"
  on public.feedback
  for insert
  to anon, authenticated
  with check (user_id is not distinct from (select auth.uid()));

-- No select / update / delete policies: learners cannot read anyone's
-- messages, including their own. service_role bypasses RLS.

-- Explicit Data API grants. New public tables carry no privileges until
-- granted (20260612201311 / 20260613001606). Omitting service_role still
-- passes on a local stack created under the older permissive default and
-- fails in CI with 42501 — see the lessons migration for the same trap.
grant all on table public.feedback to service_role;
revoke all on table public.feedback from anon, authenticated;
grant insert on table public.feedback to anon, authenticated;
