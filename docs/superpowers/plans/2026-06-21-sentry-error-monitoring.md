# Sentry Client Error Monitoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `@sentry/react` for client-side error reporting only, gated behind `VITE_SENTRY_DSN` so it is a complete no-op until a DSN is set in Vercel.

**Architecture:** A single module (`src/lib/observability.js`) is the only importer of `@sentry/react` — it owns DSN-gated init, a `reportError()` wrapper, and a `beforeSend` PII scrubber. A class `ErrorBoundary` wraps `<App/>` in `src/main.jsx`, reports render errors through that seam, and shows a branded fallback. Unhandled `window.onerror` / `unhandledrejection` events are caught for free by Sentry's default global handlers.

**Tech Stack:** React 18, Vite 5, `@sentry/react@10.59.0` (already installed, uncommitted), Vitest + React Testing Library (`globals: false`, jsdom).

**Spec:** `docs/superpowers/specs/2026-06-21-sentry-error-monitoring-design.md`

**Branch:** `feat/add-sentry` (already checked out).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/observability.js` (new) | The only importer of `@sentry/react`. `initObservability()` (DSN-gated), `reportError(err, ctx)`, `scrubEvent(event)`, `isMonitoringConfigured()`. |
| `src/lib/observability.test.js` (new) | Unit tests: no-op gating, errors-only init config, scrubbing. |
| `src/components/ErrorBoundary.jsx` (new) | Class error boundary; reports via `reportError`; renders themed fallback + Reload. |
| `src/components/ErrorBoundary.test.jsx` (new) | Renders children; fallback-on-throw + report; a11y of Reload. |
| `src/main.jsx` (modify) | `initObservability()` before `createRoot`; wrap `<App/>` in `<ErrorBoundary>`. |
| `.env.example` (modify) | Document `VITE_SENTRY_DSN` + optional `VITE_SENTRY_ENVIRONMENT`. |
| `package.json` / `package-lock.json` (already modified) | `@sentry/react@10.59.0`; commits with Task 1. |

**Conventions to follow:** inline styles only with tokens from `src/lib/theme.js`; explicit file extensions in imports; tests import `{ describe, it, expect, vi, ... }` from `'vitest'`; the pre-commit hook runs `lint-staged` + the full `npm test` on every commit (never `--no-verify`).

---

### Task 1: The observability seam (`src/lib/observability.js`)

**Files:**
- Create: `src/lib/observability.js`
- Test: `src/lib/observability.test.js`
- Commit also: `package.json`, `package-lock.json` (the already-installed dependency lands with its first consumer)

- [ ] **Step 1: Write the failing test**

Create `src/lib/observability.test.js`:

```js
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
    initObservability();
    expect(mockSentry.init).toHaveBeenCalledTimes(1);
    const config = mockSentry.init.mock.calls[0][0];
    expect(config.dsn).toBe('https://abc@o1.ingest.sentry.io/123');
    expect(config.sendDefaultPii).toBe(false);
    expect(config.beforeSend).toEqual(expect.any(Function));
    // errors-only: no tracing, no replay
    expect(config.tracesSampleRate).toBeUndefined();
    expect(config.integrations).toBeUndefined();
  });

  it('initializes at most once', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://abc@o1.ingest.sentry.io/123');
    const { initObservability } = await import('./observability.js');
    initObservability();
    initObservability();
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
    expect(mockSentry.captureException).toHaveBeenCalledWith(err, {
      extra: { componentStack: '<App/>' },
    });
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
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/observability.test.js`
Expected: FAIL — `Failed to load url ./observability.js` (the module does not exist yet).

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/observability.js`:

```js
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
// Anonymous-first app: no user identity, no cookies, and magic-link URLs can
// carry tokens in the query string — strip those too.
export function scrubEvent(event) {
  delete event.user;
  if (event.request) {
    delete event.request.cookies;
    if (typeof event.request.url === 'string') {
      event.request.url = event.request.url.split('?')[0];
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/observability.test.js`
Expected: PASS — 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/observability.js src/lib/observability.test.js
git commit -m "feat(observability): add DSN-gated Sentry seam (errors-only) + tests" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

Expected: the pre-commit hook runs `lint-staged` then the full `npm test` and all tests pass before the commit is created.

---

### Task 2: The error boundary (`src/components/ErrorBoundary.jsx`)

**Files:**
- Create: `src/components/ErrorBoundary.jsx`
- Test: `src/components/ErrorBoundary.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ErrorBoundary.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// The observability seam is mocked so the boundary's reporting is observable
// without loading Sentry (mirrors how WelcomeGate.test.jsx mocks ../lib/auth.js).
vi.mock('../lib/observability.js', () => ({ reportError: vi.fn() }));
import { reportError } from '../lib/observability.js';
import ErrorBoundary from './ErrorBoundary.jsx';

function Boom() {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    reportError.mockClear();
  });

  it('renders its children when there is no error', () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('all good')).toBeInTheDocument();
    expect(reportError).not.toHaveBeenCalled();
  });

  it('renders the fallback and reports the error when a child throws', () => {
    // React logs caught render errors to console.error; silence it for a clean run.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError.mock.calls[0][0]).toBeInstanceOf(Error);
    spy.mockRestore();
  });

  it('gives the reload control an accessible name', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/ErrorBoundary.test.jsx`
Expected: FAIL — `Failed to load url ./ErrorBoundary.jsx` (the component does not exist yet).

- [ ] **Step 3: Write the minimal implementation**

Create `src/components/ErrorBoundary.jsx`:

```jsx
import React from 'react';
import { reportError } from '../lib/observability.js';
import { COLORS, CARD, BUTTON, TEXT, FONTS, FONT_SIZE, SPACE } from '../lib/theme.js';

// Top-level React error boundary. Error boundaries must be class components —
// this is the one class component in the app, by React's design. It catches
// render-time errors anywhere below it, reports them through the observability
// seam (a no-op when Sentry is unconfigured), and shows a calm, branded recovery
// screen instead of a blank page.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    reportError(error, { componentStack: info?.componentStack });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: COLORS.paper,
          padding: SPACE[6],
        }}
      >
        <div
          style={{
            ...CARD.base,
            maxWidth: 420,
            width: '100%',
            padding: SPACE[8],
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              ...TEXT.display,
              fontSize: FONT_SIZE['3xl'],
              color: COLORS.ink,
              margin: `0 0 ${SPACE[3]}px`,
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              fontFamily: FONTS.body,
              fontSize: FONT_SIZE.base,
              color: COLORS.inkSoft,
              margin: `0 0 ${SPACE[6]}px`,
            }}
          >
            The app hit an unexpected error. Reloading usually fixes it — your saved
            progress is safe.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ ...BUTTON.primary, width: '100%' }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/ErrorBoundary.test.jsx`
Expected: PASS — 3 tests pass. (You may see no console noise; the `console.error` spy silences React's caught-error log.)

- [ ] **Step 5: Commit**

```bash
git add src/components/ErrorBoundary.jsx src/components/ErrorBoundary.test.jsx
git commit -m "feat(observability): add themed ErrorBoundary that reports via the seam" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

Expected: pre-commit runs `lint-staged` + full `npm test`; all pass.

---

### Task 3: Wire the entry point + document the env var

No unit test: `src/main.jsx` is the composition root (there is no `main.test.jsx` today, by convention). It is verified by the full suite still passing, a clean production build, and the Task 1/2 unit tests. The wiring is ~4 lines.

**Files:**
- Modify: `src/main.jsx`
- Modify: `.env.example`

- [ ] **Step 1: Update `src/main.jsx`**

Replace the entire file with:

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { SpeedInsights } from '@vercel/speed-insights/react';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { initObservability } from './lib/observability.js';

// Start error monitoring before anything renders, so early errors are captured.
// No-op unless VITE_SENTRY_DSN is set.
initObservability();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    <SpeedInsights />
  </React.StrictMode>
);
```

- [ ] **Step 2: Document the env var in `.env.example`**

Append to the end of `.env.example` (after the `VITE_SUPABASE_ANON_KEY` line):

```bash
# Sentry client error monitoring — PUBLIC by design (a DSN only permits SENDING
# events, never reading them). Optional: when unset the app reports nothing and
# behaves exactly as today. Set it in Vercel Preview + Production only (not
# Development) to turn reporting on. Get a DSN from a free Sentry project
# (Settings → Projects → Client keys (DSN)).
# VITE_SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
# Optional label shown in Sentry (defaults to the Vite build mode):
# VITE_SENTRY_ENVIRONMENT=production
```

- [ ] **Step 3: Format, lint, test, and build to verify**

Run each and confirm success:

```bash
npm run format        # prettier --write src/  (formats the new files)
npm run format:check  # passes
npm run lint          # eslint src/ api/ supabase/  — no errors
npm test              # full suite, all pass (now includes the 9 new tests)
npm run build         # vite build — production bundle compiles with @sentry/react
```

Expected: all five succeed. `npm run build` is the integration smoke test — it confirms the new imports resolve and the bundle builds.

- [ ] **Step 4: Commit**

```bash
git add src/main.jsx .env.example
git commit -m "feat(observability): wire Sentry init + ErrorBoundary into the app entry" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

Expected: pre-commit runs `lint-staged` + full `npm test`; all pass.

---

## After implementation

- **PR:** push `feat/add-sentry` and open a PR to `main` (per the coordination protocol). The diff is the dependency + the four new files + the two ~small entry edits.
- **Turn it on (separate, no code):** in Vercel → project → Settings → Environment Variables, add `VITE_SENTRY_DSN` (and optionally `VITE_SENTRY_ENVIRONMENT`) to **Preview** and **Production** only. Redeploy. The first forced error should appear in Sentry within seconds.
- **Deferred follow-ups (own specs):** source-map upload via `@sentry/vite-plugin`, then optionally tracing / replay. See the spec's "out of scope" table.

---

## Self-Review (completed by author)

- **Spec coverage:** observability seam (init gated + reportError + scrubEvent) → Task 1; ErrorBoundary themed fallback + report → Task 2; `main.jsx` wiring + `.env.example` → Task 3; `@sentry/react` dependency → committed in Task 1; tests for gating/config/scrubbing and boundary/a11y → Tasks 1–2; global `window.onerror`/`unhandledrejection` coverage → provided automatically by `Sentry.init`'s default integrations (documented, no code). All spec sections map to a task.
- **Placeholder scan:** none — every code step contains complete, runnable code and exact commands with expected output.
- **Type/name consistency:** `initObservability`, `reportError`, `scrubEvent`, `isMonitoringConfigured` are defined in Task 1 and referenced identically in `ErrorBoundary.jsx` (`reportError`), `main.jsx` (`initObservability`), and the tests. `ErrorBoundary` is a default export, imported the same way in `main.jsx` and its test. Env vars `VITE_SENTRY_DSN` / `VITE_SENTRY_ENVIRONMENT` are spelled identically everywhere.
