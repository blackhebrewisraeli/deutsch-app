# Sentry — client error monitoring (design)

**Date:** 2026-06-21
**Status:** Approved design (brainstormed and user-approved in session).
**Scope:** Standalone observability concern — not part of the backend B-series.
**Starting state:** `@sentry/react@10.59.0` installed on branch `feat/add-sentry`
(`package.json` / `package-lock.json` modified, uncommitted). The package is
inert until the wiring below lands.

---

## Problem

The app has no visibility into client-side crashes. Existing telemetry covers
everything *except* JavaScript exceptions in the browser:

- `@vercel/speed-insights` + `@vercel/analytics` → performance and usage, not errors.
- Vercel runtime logs → the `api/` serverless functions, not the client bundle.

So a render crash, an unhandled promise rejection, or a thrown error on a user's
device is invisible — you'd see a usage dip, never a stack trace. That blind spot
matters more now: this is a PWA on uncontrolled devices (old mobile Safari,
offline, stale service-worker caches) that just gained real client-side
complexity (the B2.2 sync/merge engine, anonymous auth, an LLM call path) —
exactly the "can't reproduce locally" class of bug.

This spec wires `@sentry/react` for **client error reporting only**, on Sentry's
free tier, **gated behind `VITE_SENTRY_DSN`** so it is a complete no-op until a
DSN is set in Vercel.

---

## Decisions locked in brainstorming

| Decision | Choice |
|---|---|
| Capture scope | **Errors only** — unhandled exceptions, promise rejections, React render errors. **No** performance tracing, **no** session replay. Perf is already covered by Speed Insights; errors-only is the smallest bundle and the smallest privacy surface. |
| Gate | **DSN presence is the flag.** `VITE_SENTRY_DSN` unset/empty → `Sentry.init` is never called and `reportError` is a no-op. No separate boolean flag. |
| Vendor isolation | A single module, `src/lib/observability.js`, is the **only** file that imports `@sentry/react` (mirrors how `src/lib/auth.js` is the sole Supabase entry point). App code reports through `reportError()`, never Sentry directly — swappable and testable. |
| Privacy | `sendDefaultPii: false` + a `beforeSend` that drops `event.user`, cookies, and query-string tokens. Fits the anonymous-first / RLS posture — no identifiable data leaves the client. |
| Rollout | DSN is added to Vercel **Preview + Production only**, never Development. The prod/preview-only rollout falls out of *where* the var is set; the code needs no environment switch. |
| Environment tag | `environment: import.meta.env.VITE_SENTRY_ENVIRONMENT \|\| import.meta.env.MODE` (optional per-env override; defaults to Vite's build mode). |
| Crash UX | A themed `ErrorBoundary` renders a calm "Something went wrong" card (theme tokens, inline styles) with an accessible **Reload** button. Works even when Sentry is disabled. |
| Out of scope (v1) | Performance tracing · session replay · source-map upload · release/version tagging · service-worker-scope errors. See last section. |

---

## Architecture

```
  src/main.jsx
    ├─ initObservability()          ← called before createRoot(); no-op if no DSN
    └─ <ErrorBoundary>              ← wraps <App/>; catches React render errors
          └─ <App/>

  src/lib/observability.js          ← the ONLY importer of @sentry/react
    ├─ initObservability()   → Sentry.init({ dsn, environment, beforeSend })  [errors-only]
    └─ reportError(err, ctx) → Sentry.captureException (no-op when disabled)
                              ▲
  src/components/ErrorBoundary.jsx ─ componentDidCatch → reportError(err, { componentStack })

  Coverage:
    • React render errors    → ErrorBoundary → reportError
    • window.onerror         ┐ Sentry default global handlers (installed by init)
    • unhandledrejection     ┘
    • anything explicit      → reportError(err, ctx)
```

`observability.js` is the seam: everything Sentry-specific lives behind it, so the
rest of the app (and the tests) depend only on `initObservability` / `reportError`.

---

## Files

| File | Change | Responsibility |
|---|---|---|
| `src/lib/observability.js` | **new** | DSN-gated `initObservability()`; `reportError()` wrapper; `beforeSend` scrubber. Only importer of `@sentry/react`. |
| `src/components/ErrorBoundary.jsx` | **new** | Class error boundary; reports via `reportError`; renders themed fallback + Reload. |
| `src/main.jsx` | **modify** (~3 lines) | `initObservability()` before `createRoot`; wrap `<App/>` in `<ErrorBoundary>`. |
| `.env.example` | **modify** | Document `VITE_SENTRY_DSN` (+ optional `VITE_SENTRY_ENVIRONMENT`) in the `VITE_` / "public by design" section. |
| `src/lib/observability.test.js` | **new** | No-op gating, init config, `beforeSend` scrubbing. |
| `src/components/ErrorBoundary.test.jsx` | **new** | Normal render, fallback-on-throw + report, a11y of Reload. |
| `package.json` / `package-lock.json` | already modified | `@sentry/react@10.59.0` (installed; commits with this implementation). |

---

## Gating / no-op semantics

`const DSN = import.meta.env.VITE_SENTRY_DSN; const enabled = Boolean(DSN);`

- **No DSN (dev, CI, preview/prod before setup):** `initObservability()` returns
  immediately; `reportError()` returns immediately; `ErrorBoundary` still catches
  and still shows the fallback (it just reports into a no-op). Tests run with no
  DSN, so the suite never touches the network.
- **DSN set (Vercel Preview/Prod):** `Sentry.init` runs with the errors-only
  config; render errors, global errors, and rejections flow to Sentry.

The `@sentry/react` code is statically imported, so it ships in the bundle
regardless (errors-only build, low tens of KB gzipped). A lazy/dynamic import to
drop it when disabled is a possible later optimization — **not** v1.

---

## Privacy (`beforeSend`)

```js
beforeSend(event) {
  delete event.user;                          // no anonymous/user id, no IP
  if (event.request) delete event.request.cookies;
  // strip query strings from any captured URLs (tokens, magic-link params)
  return event;
}
```

Plus `sendDefaultPii: false`. Magic-link auth means URLs can carry tokens —
stripping query strings keeps them out of Sentry. (Exact scrub list finalized in
the implementation plan.)

---

## Testing (Vitest + RTL, `globals: false`, co-located)

- **`observability.test.js`** (mock `@sentry/react`, `vi.stubEnv`):
  - DSN unset → `Sentry.init` **not** called; `reportError` calls nothing.
  - DSN set → `init` called once with `beforeSend` present and **no** tracing /
    replay integrations; `reportError` → `captureException`.
  - `beforeSend` strips `user`, cookies, and URL query strings.
- **`ErrorBoundary.test.jsx`**:
  - Renders children when no error.
  - Throwing child → fallback shown **and** `reportError` called (mock `observability`).
  - Reload button has an accessible name.

Gate to "done": `npm test`, `npm run lint`, `npm run format:check` all green (the
pre-commit contract).

---

## Explicitly out of scope (v1) — and why

| Deferred | Why | Lands when |
|---|---|---|
| Source-map upload (`@sentry/vite-plugin`) | Needs a `SENTRY_AUTH_TOKEN` build secret + build-step wiring. Errors still report; stack traces stay minified until then. | Follow-up once v1 proves useful. |
| Performance tracing | Duplicates Speed Insights; adds bundle + quota burn. | If a perf-debugging need appears. |
| Session replay | ~50KB+ and records the DOM — the biggest privacy surface on an anonymous app. | Only with a deliberate privacy pass. |
| Release / version tagging | Limited value without source maps. | With the source-map follow-up. |
| Service-worker-scope errors | Sentry's browser SDK runs in the window, not the SW; SW-internal errors aren't captured. | If SW reliability becomes a concern. |

---

## Landing

Implementation is well-scoped and test-verifiable, so it may be done by Claude
Code directly on `feat/add-sentry` **or** handed to Cursor as a Tier A brief —
decided at the writing-plans handoff. Either way, the file list and test cases
above are the contract. The `@sentry/react` dependency (already in the working
tree) commits together with the implementation, landing via PR per the
coordination protocol.
