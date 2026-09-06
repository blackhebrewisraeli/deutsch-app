import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { adminClient, createSignedInUser } from './helpers.js';
import { settleLeague } from '../../../api/_lib/leagueLogic.js';

// L3: apply_league_results applies a whole cohort in one statement.
//
// settle.test.js proves the HANDLER calls this RPC with the right payload, but
// every database call there is a mock — those tests would pass unchanged if
// this function did not exist at all. This suite is what proves the SQL works,
// that it is scoped, and that a browser cannot reach it.

const admin = adminClient();

let members = [];
let otherUser;
let leagueId;
let otherLeagueId;

const rowsOf = async (league) => {
  const { data, error } = await admin
    .from('league_members')
    .select('user_id, rank, result')
    .eq('league_id', league);
  if (error) throw new Error(error.message);
  return data;
};

beforeAll(async () => {
  // A full cohort. Anything smaller cannot show that ONE statement ranks all of
  // them — with two members a per-member loop and a set-based update look the
  // same from the outside.
  members = await Promise.all(
    Array.from({ length: 25 }, (_, i) => createSignedInUser(`settle-${i}`))
  );
  otherUser = await createSignedInUser('settle-other');

  const { data: leagues, error } = await admin
    .from('leagues')
    .insert([
      { tier: 0, period_start: '2026-06-15' },
      { tier: 0, period_start: '2026-06-15' },
    ])
    .select('id');
  if (error) throw new Error(error.message);
  [leagueId, otherLeagueId] = leagues.map((l) => l.id);

  const { error: mErr } = await admin.from('league_members').insert([
    ...members.map((m, i) => ({
      league_id: leagueId,
      user_id: m.id,
      handle: `H${String(i).padStart(3, '0')}`,
      weekly_xp: 100 - i,
      period_start: '2026-06-15',
    })),
    {
      league_id: otherLeagueId,
      user_id: otherUser.id,
      handle: 'OTHER',
      weekly_xp: 999,
      period_start: '2026-06-15',
    },
  ]);
  if (mErr) throw new Error(mErr.message);
});

afterAll(async () => {
  for (const id of [leagueId, otherLeagueId]) {
    if (id) await admin.from('league_members').delete().eq('league_id', id);
  }
  for (const id of [leagueId, otherLeagueId]) {
    if (id) await admin.from('leagues').delete().eq('id', id);
  }
});

describe('apply_league_results', () => {
  it('a signed-in client CANNOT execute it', async () => {
    // Otherwise a learner writes their own rank.
    const { error } = await members[0].client.rpc('apply_league_results', {
      p_league_id: leagueId,
      p_results: [{ user_id: members[0].id, rank: 1, result: 'promoted' }],
    });
    expect(error).not.toBeNull();
  });

  it('ranks all 25 members in a single call', async () => {
    const raw = await admin
      .from('league_members')
      .select('user_id, weekly_xp, updated_at')
      .eq('league_id', leagueId);
    const results = settleLeague(raw.data);

    const { data: updated, error } = await admin.rpc('apply_league_results', {
      p_league_id: leagueId,
      p_results: results,
    });
    expect(error).toBeNull();
    expect(updated).toBe(25);

    const rows = await rowsOf(leagueId);
    expect(rows).toHaveLength(25);
    expect(rows.every((r) => r.rank != null && r.result != null)).toBe(true);
    // Ranks are exactly 1..25, no gaps and no duplicates.
    expect([...rows.map((r) => r.rank)].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 25 }, (_, i) => i + 1)
    );
    // The database agrees with the JS ranking it was handed.
    const byUser = Object.fromEntries(rows.map((r) => [r.user_id, r]));
    for (const r of results) {
      expect(byUser[r.user_id].rank).toBe(r.rank);
      expect(byUser[r.user_id].result).toBe(r.result);
    }
  });

  it('cannot rank a member of a different league', async () => {
    const before = (await rowsOf(otherLeagueId))[0];
    expect(before.rank).toBeNull();

    // A user_id that exists, but not in the league being settled.
    const { data: updated, error } = await admin.rpc('apply_league_results', {
      p_league_id: leagueId,
      p_results: [{ user_id: otherUser.id, rank: 1, result: 'promoted' }],
    });
    expect(error).toBeNull();
    expect(updated).toBe(0);

    const after = (await rowsOf(otherLeagueId))[0];
    expect(after.rank).toBeNull();
    expect(after.result).toBeNull();
  });

  it('rejects a result value outside the allowed set', async () => {
    // Enforced by the table's CHECK constraint rather than duplicated in the
    // function, so there is one definition of what a result may be.
    const { error } = await admin.rpc('apply_league_results', {
      p_league_id: leagueId,
      p_results: [{ user_id: members[0].id, rank: 1, result: 'sideways' }],
    });
    expect(error).not.toBeNull();
  });

  it('rejects a payload that is not an array', async () => {
    const { error } = await admin.rpc('apply_league_results', {
      p_league_id: leagueId,
      p_results: { user_id: members[0].id, rank: 1, result: 'held' },
    });
    expect(error).not.toBeNull();
  });
});
