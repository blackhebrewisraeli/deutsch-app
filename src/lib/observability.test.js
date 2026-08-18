import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// @sentry/react is mocked so tests never touch the network. The stable
// `mockSentry` reference (the `mock` prefix lets Vitest hoist it) is asserted on
// directly, the same way auth.test.js asserts on its mocked client.
const mockSentry = {
  init: vi.fn(),
  captureException: vi.fn(),
};
vi.mock('@sentry/react', () => mockSentry);

// observability.js reads import.meta.env at module load, so each test stubs the
// env and then dynamically imports a fresh copy (mirrors auth.test.js).
beforeEach(() => {
  vi.resetModules();
  mockSentry.init.mockClear();
  mockSentry.captureException.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe('initObservability', () => {
  it('does not initialize Sentry when no DSN is set', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', '');
    const { initObservability } = await import('./observability.js');
    initObservability();
    expect(mockSentry.init).not.toHaveBeenCalled();
  });

  it('initializes Sentry with an errors-only config when a DSN is set', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://abc@o1.ingest.sentry.io/123');
    const { initObservability } = await import('./observability.js');
    // Sentry is code-split, so init resolves only once the chunk lands.
    await initObservability();
    expect(mockSentry.init).toHaveBeenCalledTimes(1);
    const config = mockSentry.init.mock.calls[0][0];
    expect(config.dsn).toBe('https://abc@o1.ingest.sentry.io/123');
    expect(config.sendDefaultPii).toBe(false);
    expect(config.beforeSend).toEqual(expect.any(Function));
    // errors-only: no tracing, no replay
    expect(config.tracesSampleRate).toBeUndefined();
    expect(config.integrations).toBeUndefined();
  });

  it('stamps the build commit as the Sentry release', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://abc@o1.ingest.sentry.io/123');
    vi.stubEnv('VITE_SENTRY_RELEASE', 'abc123def456');
    const { initObservability } = await import('./observability.js');
    await initObservability();
    expect(mockSentry.init.mock.calls[0][0].release).toBe('abc123def456');
  });

  it('sends no release rather than an empty one when the commit is unknown', async () => {
    // A git-less checkout resolves to ''. Passing that through would group every
    // such build under a single blank release, which is worse than none.
    vi.stubEnv('VITE_SENTRY_DSN', 'https://abc@o1.ingest.sentry.io/123');
    vi.stubEnv('VITE_SENTRY_RELEASE', '');
    const { initObservability } = await import('./observability.js');
    await initObservability();
    expect(mockSentry.init.mock.calls[0][0].release).toBeUndefined();
  });

  it('initializes at most once', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://abc@o1.ingest.sentry.io/123');
    const { initObservability } = await import('./observability.js');
    await Promise.all([initObservability(), initObservability()]);
    await initObservability();
    expect(mockSentry.init).toHaveBeenCalledTimes(1);
  });
});

describe('reportError', () => {
  it('is a no-op when no DSN is set', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', '');
    const { reportError } = await import('./observability.js');
    reportError(new Error('x'));
    expect(mockSentry.captureException).not.toHaveBeenCalled();
  });

  it('captures the exception with extra context when a DSN is set', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://abc@o1.ingest.sentry.io/123');
    const { reportError } = await import('./observability.js');
    const err = new Error('boom');
    reportError(err, { componentStack: '<App/>' });
    // Queued while the chunk loads, then flushed — hence the microtask flush.
    await vi.waitFor(() =>
      expect(mockSentry.captureException).toHaveBeenCalledWith(err, {
        extra: { componentStack: '<App/>' },
      })
    );
  });

  it('does not lose errors reported before the Sentry chunk has loaded', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://abc@o1.ingest.sentry.io/123');
    const { reportError, initObservability } = await import('./observability.js');
    const early = new Error('thrown during startup');
    // Deliberately report before init — the case deferring Sentry could regress.
    reportError(early);
    await initObservability();
    await vi.waitFor(() =>
      expect(mockSentry.captureException).toHaveBeenCalledWith(early, undefined)
    );
  });
});

describe('scrubEvent', () => {
  it('strips user, cookies, and URL query strings', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://abc@o1.ingest.sentry.io/123');
    const { scrubEvent } = await import('./observability.js');
    const event = {
      user: { id: 'anon-1', ip_address: '1.2.3.4' },
      request: {
        cookies: { session: 'secret' },
        url: 'https://app.example/auth/callback?token=abc&x=1',
      },
    };
    const out = scrubEvent(event);
    expect(out.user).toBeUndefined();
    expect(out.request.cookies).toBeUndefined();
    expect(out.request.url).toBe('https://app.example/auth/callback');
  });

  it('strips the URL hash fragment (implicit-flow tokens)', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://abc@o1.ingest.sentry.io/123');
    const { scrubEvent } = await import('./observability.js');
    const out = scrubEvent({
      request: { url: 'https://app.example/#access_token=secret&type=magiclink' },
    });
    expect(out.request.url).toBe('https://app.example/');
  });

  it('drops request.query_string', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://abc@o1.ingest.sentry.io/123');
    const { scrubEvent } = await import('./observability.js');
    const out = scrubEvent({ request: { query_string: 'token=abc' } });
    expect(out.request.query_string).toBeUndefined();
  });

  it('strips query/hash from breadcrumb URLs', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://abc@o1.ingest.sentry.io/123');
    const { scrubEvent } = await import('./observability.js');
    const out = scrubEvent({
      breadcrumbs: [
        { category: 'navigation', data: { from: '/a?code=1', to: '/b#access_token=2' } },
        { category: 'fetch', data: { url: 'https://api.example/x?key=secret' } },
      ],
    });
    expect(out.breadcrumbs[0].data.from).toBe('/a');
    expect(out.breadcrumbs[0].data.to).toBe('/b');
    expect(out.breadcrumbs[1].data.url).toBe('https://api.example/x');
  });
});
