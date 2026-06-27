import { sendError } from '../../_lib/respond.js';
import { serviceClient } from '../../_lib/supabase.js';
import { requireAuth } from '../../_lib/auth-middleware.js';
import { xpForDay } from '../../../src/lib/xpCore.js';

// Longest run of consecutive calendar days present in the sorted key list.
export function longestStreak(dayKeys) {
  const days = [...new Set(dayKeys)].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const key of days) {
    const t = Date.parse(key + 'T00:00:00Z');
    if (prev !== null && t - prev === 86400000) run += 1;
    else run = 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendError(res, 'method_not_allowed', 'Method not allowed');

  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    return sendError(res, err.code ?? 'server_error', err.message ?? 'Unexpected error.');
  }

  const target = req.query?.userId;
  if (!target) return sendError(res, 'bad_request', 'Missing userId.');

  const db = serviceClient();
  if (!db) return sendError(res, 'server_error', 'Server is not configured.');

  try {
    if (target !== auth.userId) {
      const { data: shares } = await db.rpc('shares_league', { p_a: auth.userId, p_b: target });
      if (!shares) return sendError(res, 'forbidden', 'Not in your league.');
    }

    const [{ data: profile }, { data: stats }, { data: member }] = await Promise.all([
      db.from('profiles').select('handle, avatar_emoji').eq('user_id', target).maybeSingle(),
      db.from('stats_daily').select('day, counters').eq('user_id', target),
      db
        .from('league_members')
        .select('leagues!inner(tier, period_start)')
        .eq('user_id', target)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const rows = stats ?? [];
    const total_xp = rows.reduce((s, r) => s + xpForDay(r.counters), 0);
    const longest_streak = longestStreak(rows.map((r) => r.day));

    return res.status(200).json({
      handle: profile?.handle ?? null,
      avatar_emoji: profile?.avatar_emoji ?? null,
      tier: member?.leagues?.tier ?? 0,
      total_xp,
      longest_streak,
      achievements: [], // top achievements summarized client-side from public data
    });
  } catch {
    return sendError(res, 'server_error', 'Failed to load profile.');
  }
}
