import { useState } from 'react';
import { COLORS, FONTS, FONT_SIZE, RADIUS, SHADOW } from '../lib/theme';

// Header account affordance. Guest: a quiet "Sign in" link. Signed-in: an
// initial-in-a-circle that opens a small sheet (email · sign out). Full
// management lives in the Stats AccountSection; this is the glance + escape.
export default function AccountChip({ user, onSignIn, onSignOut }) {
  const [open, setOpen] = useState(false);

  if (!user) {
    return (
      <button
        onClick={onSignIn}
        style={{
          background: 'none',
          border: 'none',
          color: COLORS.ink,
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
      <button
        aria-label="Account"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: COLORS.ink,
          color: COLORS.paper,
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
