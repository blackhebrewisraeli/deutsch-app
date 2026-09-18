import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createSignedInUser } from './helpers.js';

// Catalog + PostgREST check for 20260918200000: is_league_member lives in
// schema `private` (not exposed by PostgREST), stays SECURITY DEFINER
// (needed to avoid RLS self-recursion on league_members), and authenticated
// KEEP EXECUTE — PostgreSQL checks that privilege when evaluating the
// league RLS policies. Revoking it in public closed the RPC and 42501'd
// every league SELECT (PR #290).
//
// WHY psql AND NOT supabase-js for ACLs: they live in pg_catalog, which
// PostgREST does not expose. The RPC probe below uses the Data API to
// prove the public schema cache no longer has the function.

const DB_URL = process.env.DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

function sql(q) {
  return execFileSync('psql', [DB_URL, '-At', '-c', q], { encoding: 'utf8' }).trim();
}

// prosecdef::text and has_function_privilege()::text print 'true'/'false'.
// Force a stable t/f so the assertion does not depend on psql's boolean
// display (the first version of this file failed that way in CI).
function flag(expr) {
  return sql(`select case when (${expr}) then 't' else 'f' end`);
}

const PRIVATE_FN = 'private.is_league_member(uuid, uuid)';

describe('is_league_member moved to private schema', () => {
  it('exists in private as SECURITY DEFINER — INVOKER would recurse on league_members RLS', () => {
    const definer = flag(`
      exists (
        select 1
          from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'private'
           and p.proname = 'is_league_member'
           and pg_get_function_identity_arguments(p.oid) = 'p_league uuid, p_user uuid'
           and p.prosecdef
      )
    `);
    expect(definer).toBe('t');
  });

  it('is gone from public — PostgREST must not expose /rpc/is_league_member', () => {
    const leftover = sql(`
      select count(*)::text
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname = 'is_league_member';
    `);
    expect(leftover).toBe('0');
  });

  it('is executable by authenticated (RLS policy evaluation needs it) and not by anon', () => {
    expect(flag(`has_function_privilege('authenticated', '${PRIVATE_FN}', 'EXECUTE')`)).toBe('t');
    expect(flag(`has_function_privilege('anon', '${PRIVATE_FN}', 'EXECUTE')`)).toBe('f');
  });

  it('is the helper both league policies call', () => {
    const quals = sql(`
      select string_agg(qual, ' | ' order by tablename)
        from pg_policies
       where schemaname = 'public'
         and tablename in ('leagues', 'league_members');
    `);
    expect(quals).toMatch(/private\.is_league_member\(/);
    expect(quals).not.toMatch(/public\.is_league_member\(/);
  });

  it('rejects a signed-in PostgREST RPC — the public schema cache has no such function', async () => {
    const A = await createSignedInUser('fn-grants-rpc');
    const { data, error } = await A.client.rpc('is_league_member', {
      p_league: A.id,
      p_user: A.id,
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    // PGRST202 = not in the schema cache (function missing from exposed
    // schemas). 42883 would mean it exists but the signature mismatches.
    expect(error.code).toBe('PGRST202');
  });
});
