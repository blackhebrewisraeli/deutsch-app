import { useEffect } from 'react';
import { X } from 'lucide-react';
import { COLORS, FONTS, FONT_SIZE, LETTER_SPACING, RADIUS, SHADOW, SPACE } from '../../lib/theme';
import { isAuthConfigured, isGoogleAuthConfigured } from '../../lib/auth.js';
import MagicLinkForm from './MagicLinkForm';
import GoogleButton from './GoogleButton';

/**
 * In-app auth modal used by WelcomeGate, the trial wall, AccountChip,
 * AccountSection, and App.requestSignIn. Renders nothing when auth is
 * unconfigured (PR #79 class of bug) or when `open` is false.
 *
 * Does not touch Supabase directly — MagicLinkForm awaits the code-split
 * client via signInWithMagicLink / verifyCode, and Google goes through the
 * single handler App passes as onGoogle.
 */
export default function AuthSheet({
  open,
  intent = 'signin',
  onClose,
  onSuccess,
  onGoogle,
  googleBusy = false,
}) {
  useEffect(() => {
    if (!open || !isAuthConfigured()) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!isAuthConfigured() || !open) return null;

  const heading = intent === 'create' ? 'Create your account' : 'Sign in';
  // Gate the divider on the same fact as the button. GoogleButton self-guards,
  // but a bare "or" left behind when the flag is off would change this sheet
  // in exactly the state that must stay identical to today.
  const googleOn = isGoogleAuthConfigured();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 70,
        padding: SPACE[6],
        boxSizing: 'border-box',
      }}
    >
      <button
        type="button"
        aria-label="Dismiss sign-in"
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          border: 'none',
          margin: 0,
          padding: 0,
          background: COLORS.scrim,
          cursor: 'pointer',
        }}
      />
      <dialog
        open
        aria-modal="true"
        aria-label={heading}
        style={{
          position: 'relative',
          zIndex: 1,
          margin: 0,
          border: 'none',
          // Explicit ink on paper — native <dialog> UA styles + WelcomeGate's
          // dark page otherwise leave headings/labels as dark-on-dark.
          background: COLORS.paper,
          color: COLORS.ink,
          borderRadius: RADIUS.xl,
          padding: SPACE[6],
          maxWidth: 400,
          width: '100%',
          minWidth: 0,
          boxShadow: SHADOW.bar,
          boxSizing: 'border-box',
        }}
      >
        <button
          type="button"
          aria-label="Close sign-in"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: SPACE[3],
            right: SPACE[3],
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: `1px solid ${COLORS.ink}`,
            background: COLORS.card,
            color: COLORS.ink,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            fontFamily: FONTS.mono,
          }}
        >
          <X size={16} aria-hidden="true" />
        </button>
        {googleOn && (
          <div style={{ maxWidth: 360, margin: '0 auto' }}>
            <GoogleButton onClick={onGoogle} busy={googleBusy} autoFocus />
            <div
              aria-hidden="true"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACE[3],
                margin: `${SPACE[4]}px 0`,
                fontFamily: FONTS.mono,
                fontSize: FONT_SIZE.tag,
                letterSpacing: LETTER_SPACING.caps,
                textTransform: 'uppercase',
                color: COLORS.mute,
              }}
            >
              <span style={{ flex: 1, minWidth: 0, height: 1, background: COLORS.inkA20 }} />
              or
              <span style={{ flex: 1, minWidth: 0, height: 1, background: COLORS.inkA20 }} />
            </div>
          </div>
        )}
        <MagicLinkForm heading={heading} onSuccess={onSuccess} />
      </dialog>
    </div>
  );
}
