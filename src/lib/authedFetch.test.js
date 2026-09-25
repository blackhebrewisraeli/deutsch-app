import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const authMock = vi.hoisted(() => ({ token: 'tok', refreshed: null }));
vi.mock('./auth.js', () => ({
  getAccessToken: () => Promise.resolve(authMock.token),
  refreshAccessToken: () => Promise.resolve(authMock.refreshed),
}));

import { authedFetch, errorMessage, SESSION_EXPIRED_MESSAGE } from './authedFetch';

const ok = (body = {}) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });
const unauthorized = () => ({ ok: false, status: 401, json: () => Promise.resolve({}) });

let fetchMock;
const stubFetch = (mock) => {
  fetchMock = mock;
  vi.stubGlobal('fetch', mock);
};

beforeEach(() => {
  authMock.token = 'tok';
  authMock.refreshed = null;
  stubFetch(vi.fn().mockResolvedValue(ok()));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('authedFetch', () => {
  it('sends the bearer token and passes the init through', async () => {
    await authedFetch('/api/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/x');
    expect(init.method).toBe('POST');
    expect(init.headers.authorization).toBe('Bearer tok');
    expect(init.headers['content-type']).toBe('application/json');
  });

  it('never sends the token outside our API', async () => {
    for (const url of ['https://evil.example/api/x', '//evil.example/api/x', '/auth/v1/user']) {
      await expect(authedFetch(url)).rejects.toThrow(TypeError);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses to call at all without a token', async () => {
    authMock.token = null;
    await expect(authedFetch('/api/x')).rejects.toThrow(/sign in/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes ONCE and retries on a 401', async () => {
    authMock.refreshed = 'fresh';
    stubFetch(vi.fn().mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(ok()));

    const res = await authedFetch('/api/x');

    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers.authorization).toBe('Bearer fresh');
  });

  // Not a loop. A fresh token that is also rejected means the session is gone,
  // and retrying only spends the learner's time before saying the same thing.
  it('gives up after one retry rather than looping', async () => {
    authMock.refreshed = 'fresh';
    stubFetch(vi.fn().mockResolvedValue(unauthorized()));

    await expect(authedFetch('/api/x')).rejects.toThrow(SESSION_EXPIRED_MESSAGE);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry when the refresh itself fails', async () => {
    authMock.refreshed = null;
    stubFetch(vi.fn().mockResolvedValue(unauthorized()));

    await expect(authedFetch('/api/x')).rejects.toThrow(SESSION_EXPIRED_MESSAGE);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns a non-401 failure for the caller to interpret', async () => {
    stubFetch(
      vi.fn().mockResolvedValue({ ok: false, status: 400, json: () => Promise.resolve({}) })
    );
    const res = await authedFetch('/api/x');
    expect(res.status).toBe(400);
  });
});

describe('errorMessage', () => {
  it('prefers the server’s own wording', async () => {
    const res = { json: () => Promise.resolve({ error: { message: 'That handle is taken.' } }) };
    expect(await errorMessage(res, 'fallback')).toBe('That handle is taken.');
  });

  it('falls back when the body is not the error envelope', async () => {
    expect(await errorMessage({ json: () => Promise.resolve({}) }, 'fallback')).toBe('fallback');
  });

  it('falls back when the body is not json at all', async () => {
    expect(await errorMessage({ json: () => Promise.reject(new Error('nope')) }, 'fb')).toBe('fb');
  });
});
