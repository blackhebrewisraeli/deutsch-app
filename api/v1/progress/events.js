import { createAccountHandler } from '../../_lib/accountHandler.js';
import { sendError } from '../../_lib/respond.js';
import { isValidDateKey } from '../../_lib/dateKey.js';

// Generic progress events. The write goes through one Postgres function
// because an event is an INCREMENT: client-side read-modify-write on
// `counters` races across devices.
//
// NOT CALLED FROM src/. B2 sync already writes stats_daily with whole-object
// LWW, and enabling both writers loses increments — see spec section 7.3. A
// later plan that moves the signed-in path onto this endpoint must disable the
// stats_daily sync adapter in the same PR.

const TABS = ['chat', 'alphabet', 'vocab', 'translate'];
const LEVELS = ['a1', 'a2', 'b1'];
const VERDICTS = ['correct', 'almost', 'wrong'];
const PACK_IDS = ['de'];

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

  const packId = body.packId ?? 'de';
  if (!PACK_IDS.includes(packId)) return { ok: false, message: 'Unknown packId.' };

  const bonusXp = body.bonusXp ?? 0;
  if (!Number.isInteger(bonusXp) || bonusXp < 0 || bonusXp > MAX_BONUS_XP) {
    return { ok: false, message: `bonusXp must be an integer between 0 and ${MAX_BONUS_XP}.` };
  }

  return { ok: true, value: { dateKey, packId, tab, level, verdict, bonusXp } };
}

const handler = createAccountHandler({
  method: 'POST',
  ipRate: { max: 120, windowMs: 300000 },
  userRate: { max: 60, windowMs: 300000 },
  name: 'progress events',
  failureMessage: 'Could not record progress.',
  run: async ({ req, res, auth, db }) => {
    const parsed = validateEventBody(req.body);
    if (!parsed.ok) return sendError(res, 'bad_request', parsed.message);

    const { dateKey, packId, tab, level, verdict, bonusXp } = parsed.value;

    const { data, error } = await db.rpc('apply_progress_event', {
      // The authenticated identity, never a body field.
      p_user_id: auth.userId,
      p_pack_id: packId,
      p_day: dateKey,
      p_tab: tab,
      p_level: level,
      p_verdict: verdict,
      p_bonus_xp: bonusXp,
    });

    if (error) {
      console.error('apply_progress_event failed:', error.message);
      return sendError(res, 'server_error', 'Could not record progress.');
    }

    return res.status(200).json({ dateKey, packId, counters: data });
  },
});

export default handler;
