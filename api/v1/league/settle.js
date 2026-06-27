import { sendError } from '../../_lib/respond.js';
import { serviceClient } from '../../_lib/supabase.js';
import { settleLeague, currentPeriodStart } from '../../_lib/leagueLogic.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendError(res, 'method_not_allowed', 'Method not allowed');

  const secret = process.env.CRON_SECRET;
  const header = req.headers?.authorization ?? '';
  if (!secret || header !== `Bearer ${secret}`) {
    return sendError(res, 'unauthorized', 'Invalid cron secret.');
  }

  const db = serviceClient();
  if (!db) return sendError(res, 'server_error', 'Server is not configured.');

  const period = currentPeriodStart();

  try {
    // Leagues from prior periods (period_start < current) — candidates to settle.
    const { data: leagues, error } = await db
      .from('leagues')
      .select('id, period_start')
      .lt('period_start', period);
    if (error) throw error;

    let settled = 0;
    for (const league of leagues ?? []) {
      // Idempotency: skip if any member already has a rank.
      const { data: members } = await db
        .from('league_members')
        .select('user_id, weekly_xp, updated_at')
        .eq('league_id', league.id)
        .is('rank', null);
      if (!members || members.length === 0) continue;

      const results = settleLeague(members);
      for (const r of results) {
        const { error: upErr } = await db
          .from('league_members')
          .update({ rank: r.rank, result: r.result })
          .match({ league_id: league.id, user_id: r.user_id });
        if (upErr) throw upErr;
      }
      settled += 1;
    }

    return res.status(200).json({ settled });
  } catch {
    return sendError(res, 'server_error', 'Failed to settle leagues.');
  }
}
