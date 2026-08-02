import React from 'react';
import ReactDOM from 'react-dom/client';
import { SpeedInsights } from '@vercel/speed-insights/react';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { initObservability } from './lib/observability.js';
import { bootTheme } from './lib/themeMode.js';

// Resolve CSS custom properties before React mounts — no flash of wrong theme.
bootTheme();

// Start error monitoring before anything renders, so early errors are captured.
// No-op unless VITE_SENTRY_DSN is set.
// Fire-and-forget: the Sentry chunk loads off the critical path, and errors
// raised while it is in flight are queued and replayed once it lands.
initObservability();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    <SpeedInsights />
  </React.StrictMode>
);

// Debug-only live vitals readout: `?vitals=1`. Dynamically imported into its
// own root so it is a separate chunk — users who never pass the flag never
// download it, and it cannot re-render the app tree while measuring it.
if (new URLSearchParams(window.location.search).has('vitals')) {
  import('./components/VitalsOverlay.jsx').then(({ default: VitalsOverlay }) => {
    const host = document.createElement('div');
    host.id = 'vitals-overlay';
    document.body.appendChild(host);
    // No StrictMode here: its double-invoked effects would start the observers
    // twice and double-count long tasks.
    ReactDOM.createRoot(host).render(<VitalsOverlay />);
  });
}
