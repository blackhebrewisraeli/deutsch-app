import { sendError } from '../../_lib/respond.js';
import { serviceClient } from '../../_lib/supabase.js';
import { requireAuth } from '../../_lib/auth-middleware.js';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return sendError(res, 'method_not_allowed', 'Method not allowed');

  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    return sendError(res, err.code ?? 'server_error', err.message ?? 'Unexpected error.');
  }

  const { handle, avatar_emoji } = req.body ?? {};
  const patch = {};
  if (typeof handle === 'string') patch.handle = handle.trim();
  if (typeof avatar_emoji === 'string') patch.avatar_emoji = avatar_emoji;
  if (Object.keys(patch).length === 0) return sendError(res, 'bad_request', 'Nothing to update.');

  const db = serviceClient();
  if (!db) return sendError(res, 'server_error', 'Server is not configured.');

  const { error } = await db.from('profiles').update(patch).eq('user_id', auth.userId);
  if (error) {
    if (error.code === '23505') return sendError(res, 'bad_request', 'That handle is taken.');
    return sendError(res, 'server_error', 'Failed to update profile.');
  }
  return res
    .status(200)
    .json({ handle: patch.handle ?? null, avatar_emoji: patch.avatar_emoji ?? null });
}
