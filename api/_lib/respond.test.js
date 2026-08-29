import { describe, it, expect } from 'vitest';
import { sendError, ERROR_CODES } from './respond.js';

function createRes() {
  return {
    statusCode: 0,
    headers: {},
    body: undefined,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe('sendError', () => {
  it('maps every code to its HTTP status and wraps the envelope', () => {
    expect(ERROR_CODES).toEqual({
      bad_request: 400,
      unauthorized: 401,
      reauth_required: 401,
      forbidden: 403,
      method_not_allowed: 405,
      rate_limited: 429,
      upstream_error: 502,
      server_error: 500,
    });
    const res = createRes();
    sendError(res, 'bad_request', 'nope');
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: { code: 'bad_request', message: 'nope' } });
  });

  // reauth_required shares 401 with unauthorized but means something different:
  // the session is fine, the operation just demands a recent authentication.
  // The client branches on the CODE, so the code must survive the envelope.
  it('keeps reauth_required distinguishable from unauthorized at the same status', () => {
    const res = createRes();
    sendError(res, 'reauth_required', 'Please sign in again to confirm this action.');
    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe('reauth_required');
    expect(res.body.error.code).not.toBe('unauthorized');
  });

  it('sets extra headers when provided', () => {
    const res = createRes();
    sendError(res, 'rate_limited', 'slow down', { 'Retry-After': '42' });
    expect(res.statusCode).toBe(429);
    expect(res.headers['Retry-After']).toBe('42');
  });
});
