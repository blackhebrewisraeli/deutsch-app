import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { adminClient, createSignedInUser } from './helpers.js';
import { LEAGUE_SIZE } from '../../../src/lib/leagueZones.js';
import { currentPeriodStart } from '../../../src/lib/leagueCountdown.js';
import { xpForDay } from '../../../src/lib/xpCore.js';

// assign_user_to_bucket (20260923200000): the one placement path for join.js,
// God Mode, and apply_progress_event's first-XP-of-the-week hook.
//
// Teeth, established by mutating the migration and re-running this file:
//   - dropping the pg_advisory_xact_lock line fails "concurrent placements";
//   - flipping the settled-week order to `asc` fails "LATEST settled week";
//   - dropping the current-week guard fails "an event dated in a past week";
//   - dropping the exception block fails "never loses the progress write".

const admin = adminClient();

// Mondays nowhere near a real league week, one per test, so no other suite's
// cohorts — and no other test here — can share a bucket with ours.
const P = {
  idempotent: '2001-01-01',
  fill: '2001-01-08',
  race: '2001-01-15',
  tierOld: '2001-01-22',
  tierLast: '2001-01-29',
  tierNext: '2001-02-05',
  pinned: '2001-02-12',
  xp: '2001-02-19',
};
const PERIODS = Object.values(P);

const shiftDays = (day, n) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

const makeUsers = (n) =>
  Promise.all(
    Array.from({ length: n }, async (_, i) => {
      const { data, error } = await admin.auth.admin.createUser({
        email: `rls-bucket-${i}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`,
        email_confirm: true,
      });
      if (error) throw new Error(error.message);
      return data.user.id;
    })
  );

const assign = async (userId, period, tier) => {
  const { data, error } = await admin.rpc('assign_user_to_bucket', {
    p_user_id: userId,
    p_period: period,
    ...(tier == null ? {} : { p_tier: tier }),
  });
  if (error) throw new Error(error.message);
  return data;
};

const cohortSizes = async (period) => {
  const { data, error } = await admin
    .from('leagues')
    .select('league_members(count)')
    .eq('period_start', period);
  if (error) throw new Error(error.message);
  return data.map((l) => l.league_members[0].count).sort((a, b) => a - b);
};

const membership = async (userId, period) => {
  const { data, error } = await admin
    .from('league_members')
    .select('league_id, weekly_xp, rank')
    .eq('user_id', userId)
    .eq('period_start', period)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
};

// A finished week: its own league at `tier`, the user ranked with `result`.
const settled = async (userId, period, tier, result) => {
  const { data: league, error } = await admin
    .from('leagues')
    .insert({ tier, period_start: period })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  const { error: mErr } = await admin.from('league_members').insert({
    league_id: league.id,
    user_id: userId,
    handle: 'settled',
    period_start: period,
    rank: 1,
    result,
  });
  if (mErr) throw new Error(mErr.message);
};

// Cascades to league_members. Before AND after, so a crashed earlier run
// cannot leave cohorts behind that skew the size assertions.
const cleanPeriods = () => admin.from('leagues').delete().in('period_start', PERIODS);
beforeAll(cleanPeriods);
afterAll(cleanPeriods);

describe('assign_user_to_bucket', () => {
  it('places a first-time learner in the bottom tier, idempotently', async () => {
    const [u] = await makeUsers(1);
    const { data: profile } = await admin
      .from('profiles')
      .select('handle')
      .eq('user_id', u)
      .single();

    const first = await assign(u, P.idempotent);
    expect(first).toMatchObject({ tier: 0, period_start: P.idempotent, handle: profile.handle });
    expect(await assign(u, P.idempotent)).toEqual(first);
    expect(await cohortSizes(P.idempotent)).toEqual([1]);
  });

  it(`fills a cohort to ${LEAGUE_SIZE} before opening the next`, async () => {
    const users = await makeUsers(LEAGUE_SIZE + 1);
    for (const u of users) await assign(u, P.fill);
    expect(await cohortSizes(P.fill)).toEqual([1, LEAGUE_SIZE]);
  });

  it('concurrent placements neither overfill a cohort nor open duplicate ones', async () => {
    const users = await makeUsers(LEAGUE_SIZE + 5);
    await Promise.all(users.map((u) => assign(u, P.race)));
    expect(await cohortSizes(P.race)).toEqual([5, LEAGUE_SIZE]);
  });

  it('steps the tier from the LATEST settled week', async () => {
    const [u] = await makeUsers(1);
    // An older week at a different tier: picking it instead of the latest
    // would yield 4, not 2.
    await settled(u, P.tierOld, 4, 'held');
    await settled(u, P.tierLast, 1, 'promoted');
    expect((await assign(u, P.tierNext)).tier).toBe(2);
  });

  it('clamps the stepped tier to the ladder at both ends', async () => {
    const [top, bottom] = await makeUsers(2);
    await settled(top, P.tierLast, 4, 'promoted');
    await settled(bottom, P.tierLast, 0, 'demoted');
    expect((await assign(top, P.tierNext)).tier).toBe(4);
    expect((await assign(bottom, P.tierNext)).tier).toBe(0);
  });

  it('a pinned tier (God Mode) overrides the derived one', async () => {
    const [u] = await makeUsers(1);
    await settled(u, P.tierLast, 0, 'held');
    expect((await assign(u, P.pinned, 3)).tier).toBe(3);
  });

  it("carries the week's already-earned XP into the new membership", async () => {
    const [u] = await makeUsers(1);
    const { error } = await admin.from('stats_daily').insert([
      // The Sunday before: last week, must not count.
      { user_id: u, day: shiftDays(P.xp, -1), counters: { byLevel: { a1: { correct: 5 } } } },
      // 2 correct x 10 + 5 bonus = 25.
      {
        user_id: u,
        day: shiftDays(P.xp, 2),
        counters: { byLevel: { a1: { correct: 2 } }, bonusXp: 5 },
      },
    ]);
    if (error) throw new Error(error.message);

    await assign(u, P.xp);
    expect((await membership(u, P.xp)).weekly_xp).toBe(25);
    await admin.from('stats_daily').delete().eq('user_id', u);
  });

  it('is not callable by a signed-in learner', async () => {
    const A = await createSignedInUser('bucket-rpc');
    const { error } = await A.client.rpc('assign_user_to_bucket', {
      p_user_id: A.id,
      p_period: P.idempotent,
      p_tier: 4,
    });
    expect(error?.code).toBe('42501');
    expect(await membership(A.id, P.idempotent)).toBeNull();
  });
});

describe('apply_progress_event places on the first XP of the week', () => {
  const PERIOD = currentPeriodStart();
  const PREV_WEEK_DAY = shiftDays(PERIOD, -1);
  const users = [];

  const earn = async (day, prepare = async () => {}) => {
    const [u] = await makeUsers(1);
    users.push(u);
    await prepare(u);
    const result = await admin.rpc('apply_progress_event', {
      p_user_id: u,
      p_pack_id: 'de',
      p_day: day,
      p_tab: 'vocab',
      p_level: 'a1',
      p_verdict: 'correct',
      p_bonus_xp: 0,
      p_event_id: crypto.randomUUID(),
    });
    return { u, ...result };
  };

  const memberCount = async (leagueId) => {
    const { count } = await admin
      .from('league_members')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', leagueId);
    return count;
  };

  // These placements land in REAL current-week cohorts, so remove exactly our
  // rows and only the cohorts that end up empty because of it.
  afterAll(async () => {
    for (const u of users) {
      const m = await membership(u, PERIOD);
      await admin.from('league_members').delete().eq('user_id', u);
      await admin.from('stats_daily').delete().eq('user_id', u);
      await admin.from('progress_events_seen').delete().eq('user_id', u);
      if (m && (await memberCount(m.league_id)) === 0) {
        await admin.from('leagues').delete().eq('id', m.league_id);
      }
    }
  });

  it("places a learner with no membership, counting that event's XP", async () => {
    const { u, error } = await earn(PERIOD);
    expect(error).toBeNull();
    expect(await membership(u, PERIOD)).toMatchObject({ weekly_xp: 10, rank: null });
  });

  it('does not open a membership for an event dated in a past week', async () => {
    const { u, error } = await earn(PREV_WEEK_DAY);
    expect(error).toBeNull();
    expect(await membership(u, shiftDays(PERIOD, -7))).toBeNull();
    expect(await membership(u, PERIOD)).toBeNull();
  });

  it('never loses the progress write when placement fails', async () => {
    // No profile row → assign_user_to_bucket raises. The event must still land.
    const { u, data, error } = await earn(PERIOD, (id) =>
      admin.from('profiles').delete().eq('user_id', id)
    );
    expect(error).toBeNull();
    expect(xpForDay(data)).toBe(10);
    expect(await membership(u, PERIOD)).toBeNull();
  });
});
