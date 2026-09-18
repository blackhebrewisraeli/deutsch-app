import { sendError } from './respond.js';
import { originAllowed } from './origin.js';
import { validateAiBody } from './validate.js';
import { createRateLimiter, defaultStore } from './ratelimit.js';
import { forwardToProvider, isAnyProviderConfigured } from './forward.js';

// One factory builds every AI endpoint: same chain, per-endpoint quotas.
// Rate limiting runs before validation on purpose — malformed requests
// still consume quota, so garbage cannot be free.
export function createAiHandler({ rate, afterValidate }) {
  const checkRate = createRateLimiter({ ...rate, store: defaultStore() });

  return async function handler(req, res) {
    if (req.method !== 'POST') {
      return sendError(res, 'method_not_allowed', 'Method not allowed');
    }
    if (!originAllowed(req)) {
      return sendError(res, 'forbidden', 'Origin not allowed');
    }

    if (!isAnyProviderConfigured()) {
      return sendError(res, 'server_error', 'Server is not configured.');
    }

    const limit = await checkRate(req);
    if (!limit.allowed) {
      return sendError(res, 'rate_limited', 'Too many requests — slow down.', {
        'Retry-After': String(limit.retryAfterSec),
      });
    }

    const result = validateAiBody(req.body);
    if (!result.ok) {
      return sendError(res, 'bad_request', result.message);
    }

    let safeBody = result.safeBody;
    if (typeof afterValidate === 'function') {
      const extra = afterValidate(result.safeBody, req.body);
      if (!extra.ok) {
        return sendError(res, 'bad_request', extra.message);
      }
      safeBody = extra.safeBody;
    }

    try {
      const { status, data } = await forwardToProvider(safeBody);
      return res.status(status).json(data);
    } catch (err) {
      console.error('AI lane upstream failure:', err.message);
      return sendError(res, 'upstream_error', 'Upstream request failed');
    }
  };
}
