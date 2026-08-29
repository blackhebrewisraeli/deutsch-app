import { sendError } from './respond.js';
import { originAllowed, parseAllowedOrigins } from './origin.js';
import { createRateLimiter, defaultStore } from './ratelimit.js';
import { requireAuth } from './auth-middleware.js';
import { serviceClient } from './supabase.js';
import { isRecentAuth } from './authTime.js';

// One factory builds every account-lane endpoint, the way createAiHandler builds
// the AI lane. Before this existed, `delete` and `export` each hand-rolled their
// own method check + requireAuth + serviceClient preamble and had NO origin check
// and NO rate limit at all — export in particular returns a user's entire dataset
// in a single response and could be called in a loop.
//
// Guard order is deliberate:
//   method → origin → IP rate → auth → identity rate → re-auth → db → run
//
// The IP limit runs BEFORE requireAuth because requireAuth is not free: it calls
// Supabase getUser() on every request. Limiting only after auth would let an
// unauthenticated flood spend that call at will. The identity limit then runs
// after auth, because that is the only point where the caller's identity is
// known, and it is what stops one account rotating IPs to drain the lane.
export function createAccountHandler({
  method,
  ipRate,
  userRate,
  run,
  name = 'account',
  failureMessage = 'Request failed.',
  // Optional: demand that the caller authenticated within this many seconds.
  // Omitted means ungated, which is every endpoint that is not destructive.
  recentAuthMaxAgeSec,
  // Both injectable for tests only; production reads the env var and the
  // configured store, same as the AI lane.
  allowedOrigins,
  store = defaultStore(),
}) {
  const checkIpRate = createRateLimiter({ ...ipRate, store });
  const checkUserRate = createRateLimiter({ ...userRate, store });

  return async function handler(req, res) {
    if (req.method !== method) {
      return sendError(res, 'method_not_allowed', 'Method not allowed');
    }
    if (!originAllowed(req, allowedOrigins ?? parseAllowedOrigins(process.env.ALLOWED_ORIGINS))) {
      return sendError(res, 'forbidden', 'Origin not allowed');
    }

    const ipLimit = await checkIpRate(req);
    if (!ipLimit.allowed) {
      return sendError(res, 'rate_limited', 'Too many requests — slow down.', {
        'Retry-After': String(ipLimit.retryAfterSec),
      });
    }

    let auth;
    try {
      auth = await requireAuth(req);
    } catch (err) {
      return sendError(res, err.code ?? 'server_error', err.message ?? 'Unexpected error.');
    }

    const userLimit = await checkUserRate(req, `user:${auth.userId}`);
    if (!userLimit.allowed) {
      return sendError(res, 'rate_limited', 'Too many requests — slow down.', {
        'Retry-After': String(userLimit.retryAfterSec),
      });
    }

    // A valid token is not the same question as "authenticated recently".
    // Keyed on the token's amr claim, never iat — iat is reissued on every
    // background refresh, so a session stolen weeks ago would present a
    // minutes-old iat and sail through. See authTime.js. Fails closed.
    if (recentAuthMaxAgeSec != null) {
      const bearer = (req.headers?.authorization ?? '').replace(/^Bearer /, '');
      if (!isRecentAuth(bearer, recentAuthMaxAgeSec)) {
        return sendError(res, 'reauth_required', 'Please sign in again to confirm this action.');
      }
    }

    const db = serviceClient();
    if (!db) return sendError(res, 'server_error', 'Server is not configured.');

    try {
      return await run({ req, res, auth, db });
    } catch (err) {
      // Bind the error. Both endpoints previously used a bare `catch {}`, so a
      // failure reached neither the logs nor a human — and on the delete path
      // that made a partial delete undiagnosable. There is no server-side Sentry
      // in this project (@sentry/react is browser-only and observability.js reads
      // import.meta.env), so console.error is the reporting channel Vercel
      // actually captures — same precedent as handler.js and ratelimit.js.
      console.error(`${name} failed for user ${auth.userId}:`, err?.message ?? err);
      return sendError(res, 'server_error', failureMessage);
    }
  };
}
