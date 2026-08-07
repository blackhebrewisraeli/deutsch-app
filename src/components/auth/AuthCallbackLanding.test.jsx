import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { isAuthConfigured, authCallbackKind } = vi.hoisted(() => ({
  isAuthConfigured: vi.fn(() => true),
  authCallbackKind: vi.fn(() => null),
}));

vi.mock('../../lib/auth.js', () => ({
  isAuthConfigured,
  authCallbackKind,
}));

import AuthCallbackLanding from './AuthCallbackLanding';

describe('AuthCallbackLanding', () => {
  beforeEach(() => {
    isAuthConfigured.mockReturnValue(true);
    authCallbackKind.mockReturnValue(null);
    window.history.replaceState({}, '', '/');
  });

  it('renders nothing when the URL is not an auth callback', () => {
    const { container } = render(
      <AuthCallbackLanding status="loading" onSignedIn={() => {}} onRequestNew={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when auth is unconfigured', () => {
    isAuthConfigured.mockReturnValue(false);
    authCallbackKind.mockReturnValue('pending');
    const { container } = render(
      <AuthCallbackLanding status="loading" onSignedIn={() => {}} onRequestNew={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows Signing you in… for a pending callback hash', () => {
    authCallbackKind.mockReturnValue('pending');
    render(<AuthCallbackLanding status="loading" onSignedIn={() => {}} onRequestNew={() => {}} />);
    expect(screen.getByRole('status', { name: /signing you in/i })).toBeInTheDocument();
    expect(screen.getByText(/signing you in/i)).toBeInTheDocument();
  });

  it('shows human expired-link copy for an error callback', () => {
    authCallbackKind.mockReturnValue('error');
    render(
      <AuthCallbackLanding status="anonymous" onSignedIn={() => {}} onRequestNew={() => {}} />
    );
    expect(screen.getByText(/that link expired — request a new one/i)).toBeInTheDocument();
    // Never dump the raw fragment / Supabase error_description.
    expect(screen.queryByText(/error_code/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/otp_expired/i)).not.toBeInTheDocument();
  });

  it('moves to success when auth status becomes authenticated', async () => {
    authCallbackKind.mockReturnValue('pending');
    const onSignedIn = vi.fn();
    const { rerender } = render(
      <AuthCallbackLanding status="loading" onSignedIn={onSignedIn} onRequestNew={() => {}} />
    );
    expect(screen.getByText(/signing you in/i)).toBeInTheDocument();

    rerender(
      <AuthCallbackLanding status="authenticated" onSignedIn={onSignedIn} onRequestNew={() => {}} />
    );
    expect(await screen.findByText(/signed in/i)).toBeInTheDocument();
    expect(onSignedIn).toHaveBeenCalled();
  });

  it('offers a fresh-code CTA that calls onRequestNew', async () => {
    authCallbackKind.mockReturnValue('error');
    const onRequestNew = vi.fn();
    render(
      <AuthCallbackLanding status="anonymous" onSignedIn={() => {}} onRequestNew={onRequestNew} />
    );
    await userEvent.click(screen.getByRole('button', { name: /email me a sign-in code/i }));
    expect(onRequestNew).toHaveBeenCalled();
  });
});
