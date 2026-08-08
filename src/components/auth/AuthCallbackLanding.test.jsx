import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { isAuthConfigured, authCallbackKind, authCallbackReason } = vi.hoisted(() => ({
  isAuthConfigured: vi.fn(() => true),
  authCallbackKind: vi.fn(() => null),
  authCallbackReason: vi.fn(() => null),
}));

vi.mock('../../lib/auth.js', () => ({
  isAuthConfigured,
  authCallbackKind,
  authCallbackReason,
}));

import AuthCallbackLanding from './AuthCallbackLanding';

describe('AuthCallbackLanding', () => {
  beforeEach(() => {
    isAuthConfigured.mockReturnValue(true);
    authCallbackKind.mockReturnValue(null);
    authCallbackReason.mockReturnValue(null);
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

  it('shows human expired-link copy for an expired callback', () => {
    authCallbackKind.mockReturnValue('error');
    authCallbackReason.mockReturnValue('expired');
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

  // Relabelled from "Email me a sign-in code": the sheet it opens now offers
  // Google as well, so naming one method would name the wrong one.
  it('offers a Sign in again CTA that calls onRequestNew', async () => {
    authCallbackKind.mockReturnValue('error');
    authCallbackReason.mockReturnValue('expired');
    const onRequestNew = vi.fn();
    render(
      <AuthCallbackLanding status="anonymous" onSignedIn={() => {}} onRequestNew={onRequestNew} />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Sign in again' }));
    expect(onRequestNew).toHaveBeenCalled();
  });

  // Phase C told every failure the same story: "That link expired". After a
  // user taps Cancel on Google's consent screen nothing expired and no email
  // was involved — the copy was simply false.
  it('tells the truth when the user backs out of consent', () => {
    authCallbackKind.mockReturnValue('error');
    authCallbackReason.mockReturnValue('cancelled');
    render(
      <AuthCallbackLanding status="anonymous" onSignedIn={() => {}} onRequestNew={() => {}} />
    );
    expect(screen.getByText('Sign-in cancelled')).toBeInTheDocument();
    expect(
      screen.getByText('No problem — you can try again whenever you like.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/expired/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/email/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in again' })).toBeInTheDocument();
  });

  it('falls back to a plain story for any other failure', () => {
    authCallbackKind.mockReturnValue('error');
    authCallbackReason.mockReturnValue('failed');
    render(
      <AuthCallbackLanding status="anonymous" onSignedIn={() => {}} onRequestNew={() => {}} />
    );
    expect(screen.getByText("That didn't work")).toBeInTheDocument();
    // Never a raw provider message or a URL fragment.
    expect(screen.queryByText(/error_code|access_denied|#/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/expired/i)).not.toBeInTheDocument();
  });

  // A pending callback that never resolves times out into the error phase with
  // no reason at all — the URL carried a credential, not an error.
  it('uses the plain fallback when a pending callback times out', () => {
    vi.useFakeTimers();
    try {
      authCallbackKind.mockReturnValue('pending');
      authCallbackReason.mockReturnValue(null);
      render(
        <AuthCallbackLanding status="anonymous" onSignedIn={() => {}} onRequestNew={() => {}} />
      );
      expect(screen.getByText(/signing you in/i)).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(16000));
      expect(screen.getByText("That didn't work")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
