import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';

// Catalog check for 20260918200000: is_league_member stays SECURITY DEFINER
// (needed to avoid RLS self-recursion on league_members) and is no longer
// executable by authenticated / anon, which is what PostgREST would expose
// as /rest/v1/rpc/is_league_member.
//
// WHY psql AND NOT supabase-js: function ACLs live in pg_catalog, which
// PostgREST does not expose. This suite already requires a local stack.

const DB_URL = process.env.DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

function sql(q) {
  return execFileSync('psql', [DB_URL, '-At', '-c', q], { encoding: 'utf8' }).trim();
}

const FN = 'public.is_league_member(uuid, uuid)';

describe('is_league_member function grants', () => {
  it('stays SECURITY DEFINER — INVOKER would recurse on league_members RLS', () => {
    const definer = sql(`
      select p.prosecdef::text
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname = 'is_league_member'
         and pg_get_function_identity_arguments(p.oid) = 'p_league uuid, p_user uuid';
    `);
    expect(definer).toBe('t');
  });

  it('is not executable by anon or authenticated (closes advisor 0029)', () => {
    expect(sql(`select has_function_privilege('anon', '${FN}', 'EXECUTE')`)).toBe('f');
    expect(sql(`select has_function_privilege('authenticated', '${FN}', 'EXECUTE')`)).toBe('f');
  });

  it('remains executable by postgres and service_role', () => {
    expect(sql(`select has_function_privilege('postgres', '${FN}', 'EXECUTE')`)).toBe('t');
    expect(sql(`select has_function_privilege('service_role', '${FN}', 'EXECUTE')`)).toBe('t');
  });
});
