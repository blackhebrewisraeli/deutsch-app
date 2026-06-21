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
      </ErrorBoundary>
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
      </ErrorBoundary>
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
      </ErrorBoundary>
    );
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
    spy.mockRestore();
  });
});
