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
