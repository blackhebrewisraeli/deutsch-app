-- Codify the `ensure_rls` event trigger that had been living in production
-- ONLY, created by hand and tracked nowhere: absent from this repo, from git
-- history, from the Preview project, and from every local/CI stack.
--
-- What it does: auto-enables row-level security on any table created in
-- `public`, as a defence-in-depth net behind the explicit `alter table ...
-- enable row level security` that every table migration already carries.
--
-- Why codifying it matters more than the net itself. While it existed in
-- production alone, the protection sat exactly where it could not be tested
-- and was missing everywhere it could be. A table added without an explicit
-- RLS statement would come up RLS-off locally, in CI and in Preview, but
-- silently RLS-on in production — so the moment anyone granted `authenticated`
-- a select on it, local/CI/Preview would expose every row to every signed-in
-- user while production quietly failed closed. The adversarial RLS suite could
-- never catch that, and the protection would evaporate the first time
-- production was rebuilt from migrations. Now all three planes agree, and a
-- forgotten RLS statement behaves identically in the environment that tests it.
--
-- Idempotent by construction: production already carries both objects, so this
-- migration is a no-op there beyond normalising the function body and tightening
-- the grants.

create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
  loop
    if cmd.schema_name is not null
       and cmd.schema_name in ('public')
       and cmd.schema_name not in ('pg_catalog', 'information_schema')
       and cmd.schema_name not like 'pg_toast%'
       and cmd.schema_name not like 'pg_temp%' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
    else
      raise log 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)',
        cmd.object_identity, cmd.schema_name;
    end if;
  end loop;
end $$;

-- Postgres grants EXECUTE to PUBLIC on new functions, which is what made the
-- Supabase advisor flag this one (lints 0028/0029) as a SECURITY DEFINER
-- function reachable at /rest/v1/rpc/. In practice it is not callable — Postgres
-- refuses to invoke an event-trigger function outside event-trigger context —
-- but least privilege is the standard, and the event trigger fires through the
-- trigger mechanism, not through an EXECUTE grant.
revoke all on function public.rls_auto_enable() from public;
revoke all on function public.rls_auto_enable() from anon, authenticated;

-- `create event trigger` has no IF NOT EXISTS form; guard it so the migration
-- is safe on production, where `ensure_rls` already exists.
do $$
begin
  if not exists (select 1 from pg_event_trigger where evtname = 'ensure_rls') then
    create event trigger ensure_rls
      on ddl_command_end
      execute function public.rls_auto_enable();
  end if;
end $$;
