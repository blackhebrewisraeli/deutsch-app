import { sendError } from '../../_lib/respond.js';
import { serviceClient } from '../../_lib/supabase.js';
import { requireAuth } from '../../_lib/auth-middleware.js';
import { currentPeriodStart, LEAGUE_SIZE, TIERS } from '../../_lib/leagueLogic.js';
import { generateHandle } from '../../_lib/handle.js';

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
    // 1. Idempotency: already a member this period?
    const { data: existing } = await db
      .from('league_members')
      .select('league_id, handle, leagues!inner(tier, period_start)')
      .eq('user_id', auth.userId)
      .eq('leagues.period_start', period)
      .maybeSingle();

    if (existing) {
      return res.status(200).json({
        league_id: existing.league_id,
        tier: existing.leagues.tier,
        period_start: period,
        handle: existing.handle,
      });
    }

    // 2. Ensure a handle on the profile.
    const { data: profile } = await db
      .from('profiles')
      .select('handle')
      .eq('user_id', auth.userId)
      .maybeSingle();
    let handle = profile?.handle;
    if (!handle) {
      handle = generateHandle();
      await db.from('profiles').update({ handle }).eq('user_id', auth.userId);
    }

    // 3. Determine tier from last settled result.
    const { data: last } = await db
      .from('league_members')
      .select('result, leagues!inner(tier, period_start)')
      .eq('user_id', auth.userId)
      .not('result', 'is', null)
      .order('period_start', { ascending: false, foreignTable: 'leagues' })
      .limit(1)
      .maybeSingle();
    let tier = TIERS.MIN;
    if (last) {
      const step = last.result === 'promoted' ? 1 : last.result === 'demoted' ? -1 : 0;
      tier = Math.max(TIERS.MIN, Math.min(TIERS.MAX, last.leagues.tier + step));
    }

    // 4. Find an open league at this tier+period, else create one.
    const { data: open } = await db
      .from('leagues')
      .select('id, league_members(count)')
      .eq('tier', tier)
      .eq('period_start', period);
    let leagueId = (open ?? []).find(
      (l) => Number(l.league_members?.[0]?.count ?? 0) < LEAGUE_SIZE
    )?.id;
    if (!leagueId) {
      const { data: created, error: cErr } = await db
        .from('leagues')
        .insert({ tier, period_start: period })
        .select('id')
        .single();
      if (cErr) throw cErr;
      leagueId = created.id;
    }

    // 5. Insert membership.
    const { error: mErr } = await db
      .from('league_members')
      .insert({ league_id: leagueId, user_id: auth.userId, handle, weekly_xp: 0 });
    if (mErr) throw mErr;

    return res.status(200).json({ league_id: leagueId, tier, period_start: period, handle });
  } catch {
    return sendError(res, 'server_error', 'Failed to join league.');
  }
}
