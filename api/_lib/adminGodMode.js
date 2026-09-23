import { createAccountHandler } from './accountHandler.js';
import { sendError } from './respond.js';
// Explicit .js extensions throughout: these modules are bundled into a Vercel
// serverless function running native Node ESM, where an extensionless relative
// import is a 500 that Vite and vitest both hide (see src/lib/xpCore.js).
import { currentPeriodStart, TIERS } from './leagueLogic.js';
import { weeklyXpFromRows } from './weeklyXp.js';
import { xpForDay } from '../../src/lib/xpCore.js';
import { emptyCounters } from './progressHandlers.js';
import { isValidDateKey } from './dateKey.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ACCOUNT_RATES = {
  ipRate: { windowMs: 60 * 60 * 1000, max: 60 },
  userRate: { windowMs: 60 * 60 * 1000, max: 30 },
};

/**
 * The widest single XP correction God Mode will apply, in either direction.
 *
 * It is a blast-radius bound, not a security control: the caller is already an
 * admin and can call this repeatedly. What it buys is that a slipped keystroke
 * ("100000" for "1000") is rejected rather than silently making a leaderboard
 * meaningless, and that the value stays inside int4 after it lands in
 * counters.bonusXp — progress_counters_apply RAISES on an overflowing stored
 * counter, which would wedge that user's every later progress event.
 */
export const MAX_XP_DELTA = 100000;

export const PACK_ID = 'de';

function readJson(body) {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  return body && typeof body === 'object' ? body : null;
}

function readUserId(source) {
  const value = source?.userId;
  return typeof value === 'string' && UUID.test(value) ? value : null;
}

/**
 * The target user must exist in auth.users before anything is written for them.
 *
 * stats_daily and league_members both carry an FK to auth.users, so a bad id
 * would fail anyway — but as a 500 with a Postgres message, after the read half
 * of a read-modify-write has already run. Resolving the user first turns that
 * into a 400 and gives the UI a name to echo back.
 */
async function requireTargetUser(db, userId) {
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error || !data?.user) return null;
  return data.user;
}

/**
 * Everything God Mode can change about one user, read back from the lanes that
 * own it. Returned by the read op AND by both writes, so the UI never has to
 * guess what a mutation did — it renders the server's own after-picture.
 *
 * totalXp sums EVERY stats_daily row, which is what the client's lifetime XP
 * derives from; weeklyXp sums only the current league period, which is what
 * league_members.weekly_xp is recomputed from.
 */
export async function readGodModeSnapshot(db, userId, today) {
  const period = currentPeriodStart();

  const [rowsResult, membershipResult, profileResult] = await Promise.all([
    db.from('stats_daily').select('day, counters').eq('user_id', userId),
    db
      .from('league_members')
      .select('league_id, handle, weekly_xp, rank, result, leagues!inner(tier, period_start)')
      .eq('user_id', userId)
      .eq('leagues.period_start', period)
      .maybeSingle(),
    db.from('profiles').select('handle, blocked_at').eq('user_id', userId).maybeSingle(),
  ]);
  if (rowsResult.error) throw rowsResult.error;
  if (profileResult.error) throw profileResult.error;

  const rows = rowsResult.data ?? [];
  let totalXp = 0;
  for (const row of rows) totalXp += xpForDay(row.counters);

  const todayRow = rows.find((row) => row.day === today);
  const membership = membershipResult.data ?? null;

  return {
    userId,
    handle: profileResult.data?.handle ?? membership?.handle ?? null,
    blocked: Boolean(profileResult.data?.blocked_at),
    periodStart: period,
    totalXp,
    // Recomputed from stats_daily rather than read off league_members: the two
    // can legitimately differ (a settled row is frozen), and the honest answer
    // to "how much has this user earned this week" is the sum.
    weeklyXp: weeklyXpFromRows(rows, period),
    today: {
      day: today,
      dayXp: xpForDay(todayRow?.counters),
      bonusXp: Number(todayRow?.counters?.bonusXp ?? 0),
    },
    league: membership
      ? {
          leagueId: membership.league_id,
          tier: membership.leagues.tier,
          // rank is null until settlement; `settled` is the thing callers
          // actually branch on, so name it rather than making each one
          // re-derive it from a null.
          rank: membership.rank ?? null,
          settled: membership.rank != null,
          result: membership.result ?? null,
          weeklyXp: membership.weekly_xp ?? 0,
        }
      : null,
  };
}

/**
 * Push the week's stats_daily sum into the user's live league row.
 *
 * Deliberately mirrors api/v1/league/refresh.js and the recompute inside
 * apply_progress_event: three writers, one formula. `rank is null` is honoured
 * for the same reason it is there — a settled league is a historical record and
 * an admin poking today's XP must not re-rank a finished week.
 */
export async function recomputeWeeklyXp(db, userId, period) {
  const { data: rows, error } = await db
    .from('stats_daily')
    .select('day, counters')
    .eq('user_id', userId)
    .gte('day', period);
  if (error) throw error;

  const weekly = weeklyXpFromRows(rows ?? [], period);

  const { data: membership, error: mErr } = await db
    .from('league_members')
    .select('league_id, rank')
    .eq('user_id', userId)
    .eq('period_start', period)
    .maybeSingle();
  if (mErr) throw mErr;
  if (!membership || membership.rank != null) return weekly;

  const { error: uErr } = await db
    .from('league_members')
    .update({ weekly_xp: weekly, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('league_id', membership.league_id);
  if (uErr) throw uErr;
  return weekly;
}

export const progressHandler = createAccountHandler({
  method: 'GET',
  ...ACCOUNT_RATES,
  name: 'admin.progress',
  failureMessage: 'Failed to load progress.',
  requireAdmin: true,
  run: async ({ req, res, db }) => {
    const userId = readUserId(req.query);
    if (!userId) return sendError(res, 'bad_request', 'A user id is required.');
    const today = req.query?.today;
    if (!isValidDateKey(today)) {
      return sendError(res, 'bad_request', 'today must be YYYY-MM-DD.');
    }

    const user = await requireTargetUser(db, userId);
    if (!user) return sendError(res, 'bad_request', 'User not found.');

    const snapshot = await readGodModeSnapshot(db, userId, today);
    return res.status(200).json({ ...snapshot, email: user.email ?? null });
  },
});

export const xpHandler = createAccountHandler({
  method: 'POST',
  ...ACCOUNT_RATES,
  name: 'admin.xp',
  failureMessage: 'Failed to adjust XP.',
  requireAdmin: true,
  run: async ({ req, res, auth, db }) => {
    const body = readJson(req.body) ?? {};
    const userId = readUserId(body);
    if (!userId) return sendError(res, 'bad_request', 'A user id is required.');

    const delta = body.deltaXp;
    if (!Number.isInteger(delta) || delta === 0) {
      return sendError(res, 'bad_request', 'deltaXp must be a non-zero integer.');
    }
    if (Math.abs(delta) > MAX_XP_DELTA) {
      return sendError(res, 'bad_request', `deltaXp must be within ±${MAX_XP_DELTA}.`);
    }

    // The day the correction lands on. The client sends its own local date key
    // for the same reason the progress lane does: the server's UTC "today" can
    // be the wrong day for the person looking at the screen, and an adjustment
    // that lands in yesterday's week is the one bug this whole feature exists
    // to avoid creating.
    const day = body.day;
    if (!isValidDateKey(day)) return sendError(res, 'bad_request', 'day must be YYYY-MM-DD.');

    const user = await requireTargetUser(db, userId);
    if (!user) return sendError(res, 'bad_request', 'User not found.');

    const { data: existing, error: readErr } = await db
      .from('stats_daily')
      .select('counters')
      .eq('user_id', userId)
      .eq('pack_id', PACK_ID)
      .eq('day', day)
      .maybeSingle();
    if (readErr) throw readErr;

    const counters = existing?.counters ?? emptyCounters();
    const currentBonus = Number(counters.bonusXp ?? 0);
    const dayXp = xpForDay(counters);

    // Clamp at the DAY, not at the delta. A negative adjustment larger than the
    // day's earnings would otherwise write a negative bonusXp, which propagates
    // straight into weekly_xp and out to a leaderboard. Zero is the floor a day
    // can reach; taking more than that away needs another day to take it from.
    const appliedDelta = dayXp + delta < 0 ? -dayXp : delta;

    const nextCounters = { ...counters, bonusXp: currentBonus + appliedDelta };

    const { error: writeErr } = await db.from('stats_daily').upsert(
      {
        user_id: userId,
        pack_id: PACK_ID,
        day,
        counters: nextCounters,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,pack_id,day' }
    );
    if (writeErr) throw writeErr;

    // The audit trail. There is no server-side Sentry in this project, so
    // console.error is the channel Vercel actually captures — same precedent as
    // accountHandler.js. Both identities are recorded: who did it, and to whom.
    console.error(
      `admin.xp: ${auth.userId} adjusted ${userId} by ${appliedDelta} XP on ${day}` +
        (appliedDelta === delta ? '' : ` (clamped from ${delta})`)
    );

    await recomputeWeeklyXp(db, userId, currentPeriodStart());
    const snapshot = await readGodModeSnapshot(db, userId, day);
    return res.status(200).json({ ...snapshot, email: user.email ?? null, appliedDelta });
  },
});

export const leagueHandler = createAccountHandler({
  method: 'POST',
  ...ACCOUNT_RATES,
  name: 'admin.league',
  failureMessage: 'Failed to move the user.',
  requireAdmin: true,
  run: async ({ req, res, auth, db }) => {
    const body = readJson(req.body) ?? {};
    const userId = readUserId(body);
    if (!userId) return sendError(res, 'bad_request', 'A user id is required.');

    const tier = body.tier;
    if (!Number.isInteger(tier) || tier < TIERS.MIN || tier > TIERS.MAX) {
      return sendError(res, 'bad_request', `tier must be an integer ${TIERS.MIN}–${TIERS.MAX}.`);
    }
    const day = body.day;
    if (!isValidDateKey(day)) return sendError(res, 'bad_request', 'day must be YYYY-MM-DD.');

    const user = await requireTargetUser(db, userId);
    if (!user) return sendError(res, 'bad_request', 'User not found.');

    const period = currentPeriodStart();

    const { data: existing, error: existingErr } = await db
      .from('league_members')
      .select('league_id, handle, weekly_xp, rank, leagues!inner(tier, period_start)')
      .eq('user_id', userId)
      .eq('leagues.period_start', period)
      .maybeSingle();
    if (existingErr) throw existingErr;

    // A settled week is a finished record — rank and result are what the user
    // was told happened. Moving them now would rewrite history AND desync the
    // next join(), which derives the next tier from the last settled result.
    if (existing?.rank != null) {
      return sendError(res, 'bad_request', 'This week is already settled for that user.');
    }

    if (existing && existing.leagues.tier === tier) {
      const snapshot = await readGodModeSnapshot(db, userId, day);
      return res.status(200).json({ ...snapshot, email: user.email ?? null, moved: false });
    }

    // Delete-then-place, not an update: league_id is half the primary key, so
    // there is no in-place move, and the unique (user_id, period_start) index
    // means the old row has to go first.
    if (existing) {
      const { error: dErr } = await db
        .from('league_members')
        .delete()
        .eq('user_id', userId)
        .eq('league_id', existing.league_id);
      if (dErr) throw dErr;
    }

    // The same placement join.js and apply_progress_event use, with the tier
    // pinned: fills an open cohort before opening one, and recomputes the
    // week's XP from stats_daily, so the earned week carries over.
    const { error: aErr } = await db.rpc('assign_user_to_bucket', {
      p_user_id: userId,
      p_period: period,
      p_tier: tier,
    });
    if (aErr) throw aErr;

    console.error(`admin.league: ${auth.userId} moved ${userId} to tier ${tier} for ${period}`);

    const snapshot = await readGodModeSnapshot(db, userId, day);
    return res.status(200).json({ ...snapshot, email: user.email ?? null, moved: true });
  },
});
