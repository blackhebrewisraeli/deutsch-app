import { sendError } from '../../_lib/respond.js';
import { serviceClient } from '../../_lib/supabase.js';
import { requireAuth } from '../../_lib/auth-middleware.js';
import { currentPeriodStart } from '../../_lib/leagueLogic.js';

// Placement lives in one Postgres function, assign_user_to_bucket
// (20260923200000): it is idempotent, derives the tier from the last settled
// result, and serializes cohort filling per (tier, period) so concurrent joins
// can neither overfill a cohort nor open duplicate half-empty ones.
// apply_progress_event calls the same function on a learner's first XP of the
// week, so this endpoint is usually just reading back an existing placement.
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

  const { data, error } = await db.rpc('assign_user_to_bucket', {
    p_user_id: auth.userId,
    p_period: currentPeriodStart(),
  });
  if (error || !data) return sendError(res, 'server_error', 'Failed to join league.');

  return res.status(200).json(data);
}
