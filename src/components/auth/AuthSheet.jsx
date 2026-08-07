import { useEffect } from 'react';
import { X } from 'lucide-react';
import { COLORS, FONTS, RADIUS, SHADOW, SPACE } from '../../lib/theme';
import { isAuthConfigured } from '../../lib/auth.js';
import MagicLinkForm from './MagicLinkForm';

/**
 * In-app auth modal used by WelcomeGate, AccountChip, AccountSection, and
 * App.requestSignIn. Renders nothing when auth is unconfigured (PR #79 class
 * of bug) or when `open` is false.
 *
 * Does not touch Supabase directly — MagicLinkForm awaits the code-split
 * client via signInWithMagicLink / verifyCode.
 */
export default function AuthSheet({ open, intent = 'signin', onClose, onSuccess }) {
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

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: COLORS.inkAa,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 70,
        padding: SPACE[6],
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        style={{
          position: 'relative',
          background: COLORS.paper,
          borderRadius: RADIUS.xl,
          padding: SPACE[6],
          maxWidth: 400,
          width: '100%',
          minWidth: 0,
          boxShadow: SHADOW.bar,
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
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
        <MagicLinkForm heading={heading} onSuccess={onSuccess} />
      </div>
    </div>
  );
}
