import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';

// L2: the league policies must not re-evaluate auth.uid() per row.
//
// Supabase's performance linter calls this auth_rls_initplan, and it flagged
// both league policies. `is_league_member(league_id, auth.uid())` re-runs the
// auth lookup for EVERY candidate row; `(select auth.uid())` is hoisted into an
// InitPlan and runs once. The leaderboard read is the hot path this protects.
//
// WHY pg_policies AND NOT A SCAN OF THE MIGRATION FILES: a static scan cannot
// answer the question. The original policy in 20260627000000_leagues.sql
// contains a bare auth.uid() and always will — history is immutable. Only the
// live catalog knows which definition actually WON. This is a question about
// final state, so it has to be asked of the database.
//
// WHY psql AND NOT supabase-js: pg_policies lives in pg_catalog, which
// PostgREST does not expose, and exposing it would mean adding surface to
// production for a test's benefit. This suite already requires a local stack,
// so shelling out to psql adds no dependency the suite did not already have.

const DB_URL = process.env.DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const LEAGUE_TABLES = ['leagues', 'league_members'];

function queryPolicies() {
  // JSON rather than a delimited format: a USING clause may contain any
  // punctuation, so any separator could also appear inside a qual.
  //
  // A missing psql must FAIL here, never skip. A skipped audit and a clean
  // audit print the same thing, and only one of them means anything.
  const out = execFileSync(
    'psql',
    [
      DB_URL,
      '-At',
      '-c',
      `select coalesce(json_agg(json_build_object(
            'tablename', tablename,
            'policyname', policyname,
            'qual', coalesce(qual, '')
          ) order by tablename, policyname), '[]'::json)
         from pg_policies
        where schemaname = 'public'
          and tablename in (${LEAGUE_TABLES.map((t) => `'${t}'`).join(', ')});`,
    ],
    { encoding: 'utf8' }
  );
  return JSON.parse(out.trim());
}

// Postgres re-prints a stored subselect as `( SELECT auth.uid() AS uid)`.
// Strip every such wrapped call; anything left is an unwrapped, per-row call.
const bareAuthCalls = (qual) =>
  qual.replace(/\(\s*SELECT\s+auth\.uid\(\)[^)]*\)/gi, '').match(/auth\.uid\(\)/g) ?? [];

describe('league RLS policies do not re-evaluate auth.uid() per row', () => {
  const policies = queryPolicies();

  it('inspected both league policies — the denominator, not just the findings', () => {
    // Zero findings and zero rows inspected print identically. State the
    // denominator so an empty result can never masquerade as a pass.
    expect(policies.map((p) => `${p.tablename}.${p.policyname}`).sort()).toEqual([
      'league_members.read my league rows',
      'leagues.read my leagues',
    ]);
    for (const p of policies) {
      expect(p.qual, `${p.tablename}.${p.policyname} has an empty USING clause`).not.toBe('');
    }
  });

  it('wraps every auth.uid() call in a subselect', () => {
    const offenders = policies
      .filter((p) => bareAuthCalls(p.qual).length > 0)
      .map((p) => `${p.tablename}.${p.policyname}: ${p.qual}`);
    expect(offenders).toEqual([]);
  });

  it('still routes membership through the security-definer helper', () => {
    // The initplan fix must not accidentally inline the membership test and
    // reintroduce the RLS self-recursion that is_league_member exists to avoid.
    for (const p of policies) {
      expect(p.qual).toMatch(/is_league_member\(/);
    }
  });
});
