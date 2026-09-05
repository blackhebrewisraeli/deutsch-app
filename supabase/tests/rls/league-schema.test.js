import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { adminClient, createSignedInUser } from './helpers.js';

// L4: close the NULL hole in the one-membership-per-week guarantee.
//
// 20260628000000 added league_members_user_period_uniq after a user landed in
// two leagues in one week in production (2026-06-28) and join.js then 500'd on
// every subsequent call. It deliberately left period_start NULLABLE for the
// rollout window, so the deployed join.js — which did not yet set the column —
// would keep working.
//
// That window closed 70 days ago, and the nullability is now a live hole:
// Postgres treats NULLs as DISTINCT in a unique index, so two rows with a NULL
// period_start do not conflict. Any writer that forgets the column re-opens
// exactly the bug the index was added to prevent, silently.

const DB_URL = process.env.DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const sql = (q) => execFileSync('psql', [DB_URL, '-At', '-c', q], { encoding: 'utf8' }).trim();

const admin = adminClient();

const PERIOD = '2026-07-06';

let user;
let leagueA;
let leagueB;

beforeAll(async () => {
  user = await createSignedInUser('schema-l4');
  const { data, error } = await admin
    .from('leagues')
    .insert([
      { tier: 0, period_start: PERIOD },
      { tier: 1, period_start: PERIOD },
    ])
    .select('id');
  if (error) throw new Error(error.message);
  [leagueA, leagueB] = data.map((l) => l.id);
});

// Each test starts from an empty membership table. Without this the first
// test's row survives into the second, whose own insert then fails on the
// PRIMARY KEY rather than on the constraint under test — a failure that looks
// like a finding but is only fixture coupling.
afterEach(async () => {
  for (const id of [leagueA, leagueB]) {
    if (id) await admin.from('league_members').delete().eq('league_id', id);
  }
});

afterAll(async () => {
  for (const id of [leagueA, leagueB]) {
    if (id) await admin.from('league_members').delete().eq('league_id', id);
  }
  for (const id of [leagueA, leagueB]) {
    if (id) await admin.from('leagues').delete().eq('id', id);
  }
});

const member = (league, over = {}) => ({
  league_id: league,
  user_id: user.id,
  handle: 'L4TEST',
  weekly_xp: 0,
  period_start: PERIOD,
  ...over,
});

describe('league_members schema', () => {
  it('rejects a membership row with no period_start', async () => {
    // The hole: with the column nullable, a writer that omits it inserts
    // happily and sidesteps the unique index entirely.
    const { error } = await admin
      .from('league_members')
      .insert(member(leagueA, { period_start: null }));
    expect(error).not.toBeNull();
  });

  it('still rejects a second membership in the same week — the control', async () => {
    // Green before AND after: it proves the index works when the column is
    // populated, which is what identifies NULL as the only remaining hole.
    const first = await admin.from('league_members').insert(member(leagueA));
    expect(first.error).toBeNull();

    const second = await admin.from('league_members').insert(member(leagueB));
    expect(second.error).not.toBeNull();
    expect(second.error.code).toBe('23505');
  });

  it('keeps the unique index that enforces one membership per week', () => {
    // Guards against "cleaning up" the wrong index.
    const rows = sql(
      `select indexname from pg_indexes where schemaname='public' and tablename='league_members';`
    ).split('\n');
    expect(rows).toContain('league_members_user_period_uniq');
  });

  it('drops the redundant single-column user index', () => {
    // league_members_user_idx is (user_id). The unique index is
    // (user_id, period_start), whose LEADING column is user_id, so it already
    // serves every user_id-only lookup — refresh.js and fetchMyResults
    // included. Supabase's linter reports the single-column one as never used;
    // it only costs write amplification on a table the RPCs now update on
    // every answered exercise.
    const rows = sql(
      `select indexname from pg_indexes where schemaname='public' and tablename='league_members';`
    ).split('\n');
    expect(rows).not.toContain('league_members_user_idx');
  });
});
