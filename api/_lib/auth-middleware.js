import { serviceClient } from './supabase.js';

/**
 * Validates the Bearer JWT in req.headers.authorization.
 * Returns { userId, email } on success.
 * Throws { code, message } on failure — callers pass this to sendError.
 */
export async function requireAuth(req) {
  const header = req.headers?.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw { code: 'unauthorized', message: 'Missing authorization token.' };

  const client = serviceClient();
  if (!client) throw { code: 'server_error', message: 'Server is not configured.' };

  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) throw { code: 'unauthorized', message: 'Invalid or expired token.' };

  return { userId: data.user.id, email: data.user.email };
}
