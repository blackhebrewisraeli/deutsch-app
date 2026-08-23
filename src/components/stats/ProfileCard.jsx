import { useEffect, useRef, useState } from 'react';
import { fetchProfile, TIER_NAMES } from '../../lib/leagues.js';
import { COLORS, SPACE, RADIUS, Z } from '../../lib/theme.js';

// Tab stops the trap cycles through. `[tabindex="-1"]` is excluded on purpose:
// the card container carries -1 so it can be focused programmatically, and it
// must not become a stop of its own.
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function ProfileCard({ userId, onClose }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(false);
  const cardRef = useRef(null);

  // Focus lands on the card itself, not on its Close button: the card is
  // labelled, so a screen reader announces "Player profile" and the user reads
  // downward, instead of arriving at "Close" with the profile unread. The
  // profile is still loading at this point, which is the other reason not to
  // aim at content.
  //
  // The cleanup is the other half of the loop. Whatever had focus when the card
  // opened is the league row that opened it, and that row stays mounted behind
  // the scrim — so on close we put focus back on it and the user keeps their
  // place in a list that can be 25 rows long. Without this, closing dropped
  // focus to <body> and the next Tab restarted at the top of the page.
  // Captured on mount rather than in a render-time ref so it reads the
  // activeElement of the commit that mounted us.
  useEffect(() => {
    const opener = document.activeElement;
    cardRef.current?.focus();
    return () => {
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
  }, []);

  // Escape dismisses, matching AccountChip / ThemeChip / AuthSheet. Listening
  // on `document` rather than the card means it still fires if focus has been
  // dragged outside by something we don't control.
  //
  // Tab wraps inside the card. This is a modal — there is a scrim over the page
  // and `aria-modal` tells assistive tech the rest of the document is inert —
  // so letting Tab walk out into a leaderboard the user cannot see would make
  // both claims false.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const card = cardRef.current;
      if (!card) return;
      const stops = card.querySelectorAll(FOCUSABLE);
      if (stops.length === 0) {
        // Nothing to land on (the error state has no controls): hold the card.
        e.preventDefault();
        card.focus();
        return;
      }
      const first = stops[0];
      const last = stops[stops.length - 1];
      const here = document.activeElement;
      if (e.shiftKey) {
        // The card container is the entry point, so going backwards off it
        // wraps to the end just as it would from the first real stop.
        if (here === first || here === card) {
          e.preventDefault();
          last.focus();
        }
      } else if (here === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    fetchProfile(userId)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: COLORS.scrim,
        zIndex: Z.modal,
        padding: SPACE[4],
        boxSizing: 'border-box',
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label="Player profile"
        // Not naturally focusable, so it needs -1 to be a programmatic target.
        // -1 keeps it out of the Tab order, which is what we want: it is the
        // entry point, not a stop.
        tabIndex={-1}
        style={{
          background: COLORS.card,
          padding: `${SPACE[6]}px`,
          borderRadius: RADIUS.md,
          // border-box puts the 24px padding inside the width instead of adding
          // 48px to it, which is what pushed the card past a 320px viewport.
          // minWidth:0 overrides the flex item's automatic min-content floor —
          // the same rule as the `minmax(0, 1fr)` grid convention — so the card
          // gives way rather than the text escaping it.
          boxSizing: 'border-box',
          width: '100%',
          minWidth: 0,
          maxWidth: 360,
          color: COLORS.ink,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            float: 'right',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: COLORS.mute,
          }}
        >
          ✕
        </button>
        {error && <p style={{ color: COLORS.red }}>Couldn't load profile.</p>}
        {!error && !profile && <p style={{ color: COLORS.mute }}>Loading…</p>}
        {profile && (
          <div>
            <div style={{ fontSize: 40 }}>{profile.avatar_emoji ?? '🙂'}</div>
            {/* Handles are user-supplied and can be one long unbroken token,
                which normal wrapping refuses to break. */}
            <h3 style={{ margin: `${SPACE[2]}px 0`, overflowWrap: 'anywhere' }}>
              {profile.handle}
            </h3>
            <p style={{ margin: 0 }}>{TIER_NAMES[profile.tier]}</p>
            <p style={{ margin: 0 }}>{profile.total_xp} total XP</p>
            <p style={{ margin: 0 }}>Longest streak: {profile.longest_streak} days</p>
          </div>
        )}
      </div>
    </div>
  );
}
