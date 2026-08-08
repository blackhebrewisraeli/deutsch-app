import { useEffect, useState } from 'react';
import { COLORS, FONTS, FONT_SIZE, RADIUS, SHADOW, SPACE } from '../../lib/theme';
import { authCallbackKind, authCallbackReason, isAuthConfigured } from '../../lib/auth.js';
import Button from '../ui/Button';

function clearAuthParamsFromUrl() {
  if (typeof window === 'undefined') return;
  const { pathname, search, hash } = window.location;
  // Drop credential / error fragments so a refresh does not re-enter the landing.
  if (!search && !hash) return;
  window.history.replaceState({}, '', pathname || '/');
}

/**
 * Explicit UI for the magic-link / PKCE auth callback.
 * Detection lives in authCallbackKind() — this is the visible half only.
 */
export default function AuthCallbackLanding({ status, onSignedIn, onRequestNew }) {
  const [kind] = useState(() => (isAuthConfigured() ? authCallbackKind() : null));
  // Captured at mount: clearAuthParamsFromUrl() wipes the URL, so reading the
  // reason lazily later would always come back null.
  const [reason] = useState(() => (isAuthConfigured() ? authCallbackReason() : null));
  const [phase, setPhase] = useState(() => {
    if (!kind) return null;
    return kind === 'error' ? 'error' : 'pending';
  });

  useEffect(() => {
    if (kind !== 'pending' || phase !== 'pending') return undefined;
    if (status === 'authenticated') {
      setPhase('success');
      clearAuthParamsFromUrl();
      onSignedIn?.();
      return undefined;
    }
    // getSession can briefly report anonymous while PKCE/hash exchange is still
    // in flight — do not treat that as failure. Only time out if nothing lands.
    const t = setTimeout(() => {
      setPhase('error');
      clearAuthParamsFromUrl();
    }, 15000);
    return () => clearTimeout(t);
  }, [kind, phase, status, onSignedIn]);

  if (!isAuthConfigured() || !phase) return null;

  let copy;
  if (phase === 'pending') {
    copy = { title: 'Signing you in…', body: null, action: null };
  } else if (phase === 'success') {
    copy = { title: 'Signed in', body: 'Welcome back.', action: null };
  } else if (reason === 'cancelled') {
    copy = {
      title: 'Sign-in cancelled',
      body: 'No problem — you can try again whenever you like.',
      action: 'Sign in again',
    };
  } else if (reason === 'expired') {
    copy = {
      title: 'That link expired — request a new one',
      body: 'Sign-in links only work once and time out. Ask for a fresh code.',
      action: 'Sign in again',
    };
  } else {
    // 'failed', or a pending callback that timed out (reason null — the URL
    // carried a credential, not an error). Never surface the provider's raw
    // message or a URL fragment; neither is written for a person to read.
    copy = {
      title: "That didn't work",
      body: 'Something went wrong finishing sign-in. Please try again.',
      action: 'Sign in again',
    };
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: COLORS.inkAa,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 80,
        padding: SPACE[6],
        boxSizing: 'border-box',
      }}
    >
      <div
        role="status"
        aria-live="polite"
        aria-label={copy.title}
        style={{
          background: COLORS.paper,
          color: COLORS.ink,
          borderRadius: RADIUS.xl,
          padding: SPACE[6],
          maxWidth: 400,
          width: '100%',
          minWidth: 0,
          boxShadow: SHADOW.bar,
          boxSizing: 'border-box',
          textAlign: 'center',
          fontFamily: FONTS.body,
        }}
      >
        <h2
          style={{
            fontFamily: FONTS.display,
            margin: `0 0 ${SPACE[3]}px`,
            fontSize: FONT_SIZE['2xl'],
          }}
        >
          {copy.title}
        </h2>
        {copy.body && (
          <p
            style={{
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.tag,
              color: COLORS.mute,
              margin: 0,
            }}
          >
            {copy.body}
          </p>
        )}
        {copy.action && (
          <div style={{ marginTop: SPACE[5] }}>
            <Button
              onClick={() => {
                clearAuthParamsFromUrl();
                setPhase(null);
                onRequestNew?.();
              }}
            >
              {copy.action}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
