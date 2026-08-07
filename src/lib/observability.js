// Client error monitoring for the browser bundle — language-blind, and the only
// module that imports @sentry/react. Reads the PUBLIC Sentry DSN (a DSN only
// permits SENDING events, never reading them, so it is safe in the client
// bundle — like the Supabase anon key). When VITE_SENTRY_DSN is absent (local
// dev, CI, or any Vercel environment before the DSN is set), the module no-ops:
// Sentry.init() is never called and reportError() does nothing, so the app
// behaves exactly as it does today.
//
// Scope is errors only — no performance tracing, no session replay. See
// docs/superpowers/specs/2026-06-21-sentry-error-monitoring-design.md.
// @sentry/react is ~300KB of source and nothing on the first paint needs it, so
// it is pulled in with a dynamic import and lands in its own chunk. The original
// contract — "start monitoring before anything renders, so early errors are
// captured" — is preserved by the bootstrap handlers below: errors raised during
// the load window are queued and replayed into Sentry the moment it arrives.

const DSN = import.meta.env.VITE_SENTRY_DSN || '';

export function isMonitoringConfigured() {
  return Boolean(DSN);
}

// Drop anything potentially identifying before an event leaves the browser.
// Anonymous-first app: no user identity, no cookies, and auth tokens can ride in
// a URL's query string (PKCE `?code=`) OR its hash fragment (implicit-flow
// `#access_token=`) — strip both, on the request URL and on breadcrumb URLs.
function stripUrl(url) {
  return url.split(/[?#]/)[0];
}

export function scrubEvent(event) {
  delete event.user;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.query_string;
    if (typeof event.request.url === 'string') {
      event.request.url = stripUrl(event.request.url);
    }
  }
  if (Array.isArray(event.breadcrumbs)) {
    for (const crumb of event.breadcrumbs) {
      if (!crumb || !crumb.data) continue;
      for (const key of ['url', 'to', 'from']) {
        if (typeof crumb.data[key] === 'string') {
          crumb.data[key] = stripUrl(crumb.data[key]);
        }
      }
    }
  }
  return event;
}

let initialized = false;
let sentry = null;
let sentryPromise = null;

// Errors raised before the Sentry chunk finishes loading. Bounded: if the chunk
// never arrives (offline, blocked) this must not grow without limit.
const QUEUE_LIMIT = 25;
const queued = [];

function loadSentry() {
  if (!sentryPromise) {
    // Destructure the two bindings we use rather than keeping the namespace
    // object. A bare `import('@sentry/react')` forces Rollup to retain every
    // export — including replayIntegration, which drags in @sentry/replay
    // (258KB of source this app explicitly does not use). Naming the exports
    // lets tree-shaking work through the dynamic import.
    sentryPromise = import('@sentry/react').then(({ init, captureException }) => {
      sentry = { init, captureException };
      return sentry;
    });
  }
  return sentryPromise;
}

function flushQueue() {
  if (!sentry) return;
  for (const { error, context } of queued.splice(0, queued.length)) {
    sentry.captureException(error, context ? { extra: context } : undefined);
  }
}

/**
 * Catch errors thrown during the load window and hold them, so deferring the
 * Sentry chunk does not create a blind spot at exactly the point in startup
 * where errors are most likely.
 */
function installBootstrapHandlers() {
  if (typeof window === 'undefined') return () => {};
  const onError = (e) => enqueue(e.error ?? new Error(e.message), { via: 'window.onerror' });
  const onRejection = (e) =>
    enqueue(e.reason ?? new Error('unhandledrejection'), {
      via: 'unhandledrejection',
    });
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}

function enqueue(error, context) {
  if (queued.length >= QUEUE_LIMIT) return;
  queued.push({ error, context });
}

export async function initObservability() {
  if (!isMonitoringConfigured() || initialized) return;
  initialized = true;

  // Sentry installs its own global handlers on init; ours only cover the gap.
  const removeBootstrap = installBootstrapHandlers();
  try {
    const Sentry = await loadSentry();
    Sentry.init({
      dsn: DSN,
      environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
      sendDefaultPii: false,
      // Errors only: do NOT add browserTracingIntegration or replayIntegration.
      beforeSend: scrubEvent,
    });
    flushQueue();
  } catch {
    // Monitoring must never take the app down with it.
    initialized = false;
  } finally {
    removeBootstrap();
  }
}

export function reportError(error, context) {
  if (!isMonitoringConfigured()) return;
  if (sentry) {
    sentry.captureException(error, context ? { extra: context } : undefined);
    return;
  }
  // Still loading — hold it, and make sure a load is actually in flight so the
  // queue gets drained even if reportError beat initObservability.
  enqueue(error, context);
  loadSentry().then(flushQueue);
}
