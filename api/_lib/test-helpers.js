// Shared fixtures for endpoint contract tests. Routes are module singletons
// whose MemoryStore quota counters persist for the life of the test process,
// so callers give each test its own client IP.

export function createRes() {
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
    end() {
      return this;
    },
  };
}

export const validAiBody = () => ({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 100,
  messages: [{ role: 'user', content: 'Hallo' }],
});

export const postReq = (ip, overrides = {}) => ({
  method: 'POST',
  headers: { 'x-forwarded-for': ip },
  body: validAiBody(),
  ...overrides,
});

export const getReq = (ip, token = 'test-token', overrides = {}) => ({
  method: 'GET',
  headers: {
    'x-forwarded-for': ip,
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  },
  ...overrides,
});
