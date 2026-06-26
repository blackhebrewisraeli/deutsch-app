import { sendError } from '../../_lib/respond.js';
import { serviceClient } from '../../_lib/supabase.js';
import { requireAuth } from '../../_lib/auth-middleware.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendError(res, 'method_not_allowed', 'Method not allowed');
  }

  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    return sendError(res, err.code ?? 'server_error', err.message ?? 'Unexpected error.');
  }

  const db = serviceClient();
  if (!db) return sendError(res, 'server_error', 'Server is not configured.');

  try {
    const [srsRes, dailyRes, settingsRes] = await Promise.all([
      db.from('srs_state').select('*').eq('user_id', auth.userId),
      db.from('stats_daily').select('*').eq('user_id', auth.userId),
      db.from('settings').select('*').eq('user_id', auth.userId),
    ]);

    if (srsRes.error) throw srsRes.error;
    if (dailyRes.error) throw dailyRes.error;
    if (settingsRes.error) throw settingsRes.error;

    return res.status(200).json({
      email: auth.email,
      exportedAt: new Date().toISOString(),
      data: {
        srs: srsRes.data ?? [],
        daily: dailyRes.data ?? [],
        settings: settingsRes.data?.[0] ?? null,
      },
    });
  } catch {
    return sendError(res, 'server_error', 'Failed to export data.');
  }
}
