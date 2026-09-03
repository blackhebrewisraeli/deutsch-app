import { sendError } from './respond.js';
import { originAllowed, parseAllowedOrigins } from './origin.js';
import { createRateLimiter, defaultStore } from './ratelimit.js';
import { serviceClient } from './supabase.js';

// The public sibling of createAccountHandler, for lanes that read content
// nobody owns. Same chain minus auth:
//   method → origin → IP rate → db → run
//
// A separate factory rather than an `auth: false` flag on createAccountHandler:
// the flag would make three of that factory's branches conditional (auth, the
// per-identity rate limit, the re-auth gate) in the one file every account
// endpoint depends on, and the combination that ships is exactly the one a flag
// matrix forgets to test. There is no identity here, so there is no second rate
// limit — IP is the only key available.
export function createPublicHandler({
  method,
  ipRate,
  run,
  name = 'public',
  failureMessage = 'Request failed.',
  // Injectable for tests only; production reads env and the configured store.
  allowedOrigins,
  store = defaultStore(),
}) {
  const checkIpRate = createRateLimiter({ ...ipRate, store });

  return async function handler(req, res) {
    if (req.method !== method) {
      return sendError(res, 'method_not_allowed', 'Method not allowed');
    }
    if (!originAllowed(req, allowedOrigins ?? parseAllowedOrigins(process.env.ALLOWED_ORIGINS))) {
      return sendError(res, 'forbidden', 'Origin not allowed');
    }

    const limit = await checkIpRate(req);
    if (!limit.allowed) {
      return sendError(res, 'rate_limited', 'Too many requests — slow down.', {
        'Retry-After': String(limit.retryAfterSec),
      });
    }

    const db = serviceClient();
    if (!db) return sendError(res, 'server_error', 'Server is not configured.');

    try {
      return await run({ req, res, db });
    } catch (err) {
      // console.error is the reporting channel Vercel captures; there is no
      // server-side Sentry in this project. Same precedent as accountHandler.
      console.error(`${name} failed:`, err?.message ?? err);
      return sendError(res, 'server_error', failureMessage);
    }
  };
}
