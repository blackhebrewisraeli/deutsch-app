import { useState } from 'react';
import { COLORS, FONTS, FONT_SIZE, RADIUS, SHADOW } from '../lib/theme';
import { isAuthConfigured } from '../lib/auth.js';

// Header account affordance. Guest: a quiet "Sign in" link. Signed-in: an
// initial-in-a-circle that opens a small sheet (email · sign out). Full
// management lives in the Stats AccountSection; this is the glance + escape.
export default function AccountChip({ user, onSignIn, onSignOut, pending = false }) {
  const [open, setOpen] = useState(false);

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
    <div style={{ position: 'relative' }}>
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
        aria-haspopup="true"
        aria-expanded={open}
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
          style={{
            position: 'absolute',
            right: 0,
            top: 40,
            background: COLORS.paper,
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
