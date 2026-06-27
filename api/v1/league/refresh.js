import { sendError } from '../../_lib/respond.js';
import { serviceClient } from '../../_lib/supabase.js';
import { requireAuth } from '../../_lib/auth-middleware.js';
import { currentPeriodStart } from '../../_lib/leagueLogic.js';
import { weeklyXpFromRows } from '../../_lib/weeklyXp.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendError(res, 'method_not_allowed', 'Method not allowed');

  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    return sendError(res, err.code ?? 'server_error', err.message ?? 'Unexpected error.');
  }

  const db = serviceClient();
  if (!db) return sendError(res, 'server_error', 'Server is not configured.');

  const period = currentPeriodStart();

  try {
    const { data: rows, error } = await db
      .from('stats_daily')
      .select('day, counters')
      .eq('user_id', auth.userId)
      .gte('day', period);
    if (error) throw error;

    const weekly = weeklyXpFromRows(rows ?? [], period);

    const { data: membership } = await db
      .from('league_members')
      .select('league_id, leagues!inner(period_start)')
      .eq('user_id', auth.userId)
      .eq('leagues.period_start', period)
      .maybeSingle();

    if (!membership) {
      return res.status(200).json({ weekly_xp: weekly });
    }

    const { error: uErr } = await db
      .from('league_members')
      .update({ weekly_xp: weekly, updated_at: new Date().toISOString() })
      .eq('user_id', auth.userId)
      .eq('league_id', membership.league_id);
    if (uErr) throw uErr;

    return res.status(200).json({ weekly_xp: weekly });
  } catch {
    return sendError(res, 'server_error', 'Failed to refresh league XP.');
  }
}
