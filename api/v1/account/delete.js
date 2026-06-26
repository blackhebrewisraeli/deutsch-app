import { sendError } from '../../_lib/respond.js';
import { serviceClient } from '../../_lib/supabase.js';
import { requireAuth } from '../../_lib/auth-middleware.js';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
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
    // Delete data rows first. If any fail, bail before touching auth.
    const tables = ['srs_state', 'stats_daily', 'settings'];
    for (const table of tables) {
      const { error } = await db.from(table).delete().eq('user_id', auth.userId);
      if (error) throw error;
    }
    const { error: authErr } = await db.auth.admin.deleteUser(auth.userId);
    if (authErr) throw authErr;

    return res.status(204).end();
  } catch {
    return sendError(res, 'server_error', 'Failed to delete account.');
  }
}
