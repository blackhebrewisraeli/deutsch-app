import { createAccountHandler } from '../../_lib/accountHandler.js';
import { sendError } from '../../_lib/respond.js';
import { isValidDateKey } from '../../_lib/dateKey.js';

// Completes the developer interface: read a day back without a browser
// supabase-js select. The signed-in PWA does not have to switch to this — the
// existing sync pull keeps working.
//
// Query parameter rather than a dynamic route segment: this project compiles
// static function filenames and has no [param] routes. See the plan's Ruling 1.

const TABS = ['chat', 'alphabet', 'vocab', 'translate'];
const LEVELS = ['a1', 'a2', 'b1'];
const VERDICTS = ['correct', 'almost', 'wrong'];
const PACK_IDS = ['de'];

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

const handler = createAccountHandler({
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

export default handler;
