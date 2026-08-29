import { useState, useEffect, useRef } from 'react';
import { COLORS, FONTS, FONT_SIZE, RADIUS, SHADOW } from '../lib/theme';
import { isAuthConfigured } from '../lib/auth.js';

// Header account affordance. Guest: a quiet "Sign in" link. Signed-in: an
// initial-in-a-circle that opens a small sheet (email · sign out). Full
// management lives in the Stats AccountSection; this is the glance + escape.
//
// The sheet is a `dialog`, matching ThemeChip and StatusChip. It previously
// advertised `aria-haspopup="true"` — which means MENU — over a panel carrying
// no role at all, so a screen reader announced a menu, opened it, and found an
// unlabelled generic div. `role="menu"` would not have been the fix either:
// menu semantics want `menuitem` children and arrow-key traversal, and half of
// this panel is static text (the email). It is a small labelled panel with
// mixed content, which is what a non-modal dialog is for.
//
// Being honest about that also brings it inside the contrast gate, which
// discovers header sheets by `aria-haspopup="dialog"`. Its interior — the
// email line and the red "Sign out" — had never been contrast-audited,
// because a sheet that never opens contributes no pairings.
export default function AccountChip({
  user,
  onSignIn,
  onSignOut,
  onOpenSettings,
  pending = false,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);

  // Escape and outside-click, the dismissal a dialog is expected to have and
  // the only two this sheet was missing. Same handling as its two siblings, so
  // the three header sheets behave alike rather than each having its own rules.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  // No auth backend configured → offer nothing to sign in to. WelcomeGate has
  // always checked this; this chip did not, so when the demo's Supabase project
  // stopped resolving (2026-08-01) the splash went clean while the header kept
  // offering a dead "Sign in". An already signed-in user still gets the chip, so
  // a session that outlives the config change keeps its way out.
  if (!user && !isAuthConfigured()) return null;

  if (!user) {
    return (
      <button
        onClick={onSignIn}
        style={{
          background: 'none',
          border: 'none',
          // Inherits the masthead ink. Not COLORS.ink: that is near-black in
          // light mode and this button sits on the charcoal bar.
          color: 'inherit',
          fontFamily: FONTS.mono,
          fontSize: FONT_SIZE.tag,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          cursor: 'pointer',
        }}
      >
        Sign in
      </button>
    );
  }

  const initial = (user.email?.[0] ?? '?').toUpperCase();
  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      {pending && (
        <span
          aria-label="Sync pending"
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: COLORS.accentRed,
            // Ringed in the bar's own colour so the dot reads as separate from
            // the avatar beneath it. `paper` would be the page ground, which
            // is no longer what is behind this.
            border: `2px solid ${COLORS.accentBlack}`,
            zIndex: 1,
          }}
        />
      )}
      <button
        aria-label="Account"
        aria-haspopup="dialog"
        aria-expanded={open}
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          // Inverted onto its own surface, like the ring discs and StatBlock:
          // an `ink` fill is near-black in light mode and would disappear into
          // the charcoal bar. `ink` on `surface` is an audited pairing.
          background: COLORS.surface,
          color: COLORS.ink,
          border: 'none',
          fontFamily: FONTS.mono,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        {initial}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Account"
          style={{
            position: 'absolute',
            right: 0,
            top: 40,
            background: COLORS.paper,
            // Carry the ink as well as the surface. The masthead sets
            // `color: accentBlackOn` for its charcoal bar and that INHERITS,
            // so a sheet that sets only a background renders on-charcoal ink
            // on light paper — the email line measured 1:1 in light.day, i.e.
            // literally invisible. Its siblings both set this; this one did
            // not, and nothing caught it because the sheet was never opened.
            color: COLORS.ink,
            border: `1px solid ${COLORS.ink}`,
            borderRadius: RADIUS.md,
            boxShadow: SHADOW.bar,
            padding: 12,
            minWidth: 200,
            zIndex: 60,
          }}
        >
          <div style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag, marginBottom: 8 }}>
            {user.email}
          </div>
          {/* The sheet stays the glance-and-escape it always was; full account
              management lives in the Settings route it now points at. */}
          <button
            // Distinct from the identity strip's own "Settings →" link on Home:
            // two controls with the same accessible name on one screen are
            // ambiguous to a screen reader as well as to a test.
            aria-label="Open settings"
            onClick={() => {
              setOpen(false);
              onOpenSettings?.();
            }}
            style={{
              display: 'block',
              background: 'none',
              border: 'none',
              color: COLORS.ink,
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.tag,
              cursor: 'pointer',
              padding: 0,
              marginBottom: 8,
            }}
          >
            Settings →
          </button>
          <button
            onClick={onSignOut}
            style={{
              background: 'none',
              border: 'none',
              color: COLORS.red,
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.tag,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
