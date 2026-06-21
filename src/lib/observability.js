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
import * as Sentry from '@sentry/react';

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

export function initObservability() {
  if (!isMonitoringConfigured() || initialized) return;
  initialized = true;
  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
    sendDefaultPii: false,
    // Errors only: do NOT add browserTracingIntegration or replayIntegration.
    beforeSend: scrubEvent,
  });
}

export function reportError(error, context) {
  if (!isMonitoringConfigured()) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
