// The error envelope — the single definition of machine codes → HTTP status.
// Contract: docs/api/README.md. `unauthorized` is reserved for phase B2 (JWTs).

export const ERROR_CODES = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  method_not_allowed: 405,
  rate_limited: 429,
  upstream_error: 502,
  server_error: 500,
};

export function sendError(res, code, message, extraHeaders = {}) {
  for (const [key, value] of Object.entries(extraHeaders)) {
    res.setHeader(key, value);
  }
  return res.status(ERROR_CODES[code]).json({ error: { code, message } });
}
