import { createAccountHandler } from './accountHandler.js';
import { sendError } from './respond.js';
import { isValidDateKey } from './dateKey.js';

// Generic progress events. The write goes through one Postgres function
// because an event is an INCREMENT: client-side read-modify-write on
// `counters` races across devices.
//
// The signed-in PWA calls this (E4). The daily sync upsert is gone; this RPC
// is the only writer of stats_daily. Running both would DOUBLE-COUNT because
// mergeDailyAdditive would push local−lastSynced on top of an already
// incremented row — see docs/superpowers/specs/2026-09-04-e4-client-adoption.md.
//
// eventsHandler and dailyHandler live in one file — not two api/v1/progress/*
// files — because Vercel's Hobby plan caps a deployment at 12 Serverless
// Functions and this project was over. api/v1/progress.js dispatches on
// req.method between the two; see that file for the dispatcher and
// vercel.json for the rewrites that keep the documented URLs working.

const TABS = ['chat', 'alphabet', 'vocab', 'translate'];
const LEVELS = ['a1', 'a2', 'b1'];
const VERDICTS = ['correct', 'almost', 'wrong'];
const PACK_IDS = ['de'];
const EVENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Per-event cap on the league-XP pipe (`counters.bonusXp` → `xpForDay` →
 * `weekly_xp`). It bounds ONE request, not the lane: at 60 requests per 5
 * minutes a caller can still push far more than any real week's XP. The real
 * limit on abuse is that a signed-in user can already write their own
 * `stats_daily` row directly through RLS, so this endpoint grants no capability
 * they did not have. Do not describe this as league protection.
 */
export const MAX_BONUS_XP = 500;

export function validateEventBody(raw) {
  let body = raw;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return { ok: false, message: 'Body must be JSON.' };
    }
  }
  if (!body || typeof body !== 'object') return { ok: false, message: 'Body must be an object.' };

  // Named explicitly rather than aliased: progress is pack-scoped, and
  // silently accepting courseCode is how two keys drift apart.
  if ('courseCode' in body) {
    return { ok: false, message: 'Progress is pack-scoped: send packId, not courseCode.' };
  }

  const { dateKey, tab, level, verdict } = body;
  if (!isValidDateKey(dateKey)) {
    return { ok: false, message: 'dateKey must be YYYY-MM-DD.' };
  }
  if (!TABS.includes(tab)) return { ok: false, message: 'Unknown tab.' };
  if (!LEVELS.includes(level)) return { ok: false, message: 'Unknown level.' };
  if (!VERDICTS.includes(verdict)) return { ok: false, message: 'Unknown verdict.' };

  if (typeof body.id !== 'string' || !EVENT_ID.test(body.id)) {
    return { ok: false, message: 'id must be a UUID.' };
  }

  const packId = body.packId ?? 'de';
  if (!PACK_IDS.includes(packId)) return { ok: false, message: 'Unknown packId.' };

  const bonusXp = body.bonusXp ?? 0;
  if (!Number.isInteger(bonusXp) || bonusXp < 0 || bonusXp > MAX_BONUS_XP) {
    return { ok: false, message: `bonusXp must be an integer between 0 and ${MAX_BONUS_XP}.` };
  }

  return { ok: true, value: { id: body.id, dateKey, packId, tab, level, verdict, bonusXp } };
}

export const eventsHandler = createAccountHandler({
  method: 'POST',
  ipRate: { max: 120, windowMs: 300000 },
  userRate: { max: 60, windowMs: 300000 },
  name: 'progress events',
  failureMessage: 'Could not record progress.',
  run: async ({ req, res, auth, db }) => {
    const parsed = validateEventBody(req.body);
    if (!parsed.ok) return sendError(res, 'bad_request', parsed.message);

    const { id, dateKey, packId, tab, level, verdict, bonusXp } = parsed.value;

    const { data, error } = await db.rpc('apply_progress_event', {
      // The authenticated identity, never a body-supplied user id.
      p_user_id: auth.userId,
      p_pack_id: packId,
      p_day: dateKey,
      p_tab: tab,
      p_level: level,
      p_verdict: verdict,
      p_bonus_xp: bonusXp,
      p_event_id: id,
    });

    if (error) {
      console.error('apply_progress_event failed:', error.message);
      return sendError(res, 'server_error', 'Could not record progress.');
    }

    return res.status(200).json({ dateKey, packId, counters: data });
  },
});

// Completes the developer interface: read a day back without a browser
// supabase-js select. The signed-in PWA does not have to switch to this — the
// existing sync pull keeps working.
//
// Query parameter rather than a dynamic route segment: this project compiles
// static function filenames and has no [param] routes. See the plan's Ruling 1.

/**
 * The zeroed aggregate, mirroring emptyDayAggregate in src/lib/stats.js.
 * A quiet day is zeros, never a 404 and never `{}` — readers index straight
 * into byLevel[level][verdict], and an empty object gives them undefined.
 */
export function emptyCounters() {
  const byTab = {};
  for (const tab of TABS) byTab[tab] = 0;
  const byLevel = {};
  for (const level of LEVELS) {
    byLevel[level] = {};
    for (const verdict of VERDICTS) byLevel[level][verdict] = 0;
  }
  return { total: 0, bonusXp: 0, byTab, byLevel };
}

export const dailyHandler = createAccountHandler({
  method: 'GET',
  ipRate: { max: 120, windowMs: 300000 },
  userRate: { max: 60, windowMs: 300000 },
  name: 'progress daily',
  failureMessage: 'Could not read progress.',
  run: async ({ req, res, auth, db }) => {
    const dateKey = req.query?.date;
    if (!isValidDateKey(dateKey)) {
      return sendError(res, 'bad_request', 'date must be YYYY-MM-DD.');
    }
    const packId = req.query?.packId ?? 'de';
    if (!PACK_IDS.includes(packId)) {
      return sendError(res, 'bad_request', 'Unknown packId.');
    }

    const { data, error } = await db
      .from('stats_daily')
      .select('counters')
      .eq('user_id', auth.userId)
      .eq('pack_id', packId)
      .eq('day', dateKey)
      .maybeSingle();

    if (error) {
      console.error('progress daily query failed:', error.message);
      return sendError(res, 'server_error', 'Could not read progress.');
    }

    return res.status(200).json({
      dateKey,
      packId,
      counters: data?.counters ?? emptyCounters(),
    });
  },
});
