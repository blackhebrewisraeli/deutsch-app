import { serviceClient } from './supabase.js';
import { assertSignupAllowed, readServerSignupAllowlist } from '../../src/lib/signupAllowlist.js';

/**
 * Validates the Bearer JWT in req.headers.authorization.
 * Returns { userId, email, user } on success. `user` is the Supabase user from
 * getUser — classifyAuthUser reads verified emails off it. Callers must not
 * take admin flags from the request body or from user_metadata.
 * Throws { code, message } on failure — callers pass this to sendError.
 *
 * Signup allowlist: when SIGNUP_EMAIL_ALLOWLIST is unset/empty this is a
 * no-op (production default). When it is set, a valid token whose verified
 * email is not on the list is rejected here — the same gate every
 * accountHandler, league, progress, and admin caller already goes through,
 * so a client cannot bypass it for privileged ops. Guests never present a
 * Bearer token and are unchanged.
 */
export async function requireAuth(req) {
  const header = req.headers?.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw { code: 'unauthorized', message: 'Missing authorization token.' };

  const client = serviceClient();
  if (!client) throw { code: 'server_error', message: 'Server is not configured.' };

  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) throw { code: 'unauthorized', message: 'Invalid or expired token.' };

  assertSignupAllowed(data.user, readServerSignupAllowlist(process.env));

  return { userId: data.user.id, email: data.user.email, user: data.user };
}
