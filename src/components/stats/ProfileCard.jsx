import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { fetchProfile, TIER_NAMES } from '../../lib/leagues.js';
import { COLORS, SPACE, RADIUS, Z } from '../../lib/theme.js';
import useFocusTrap from '../../lib/useFocusTrap.js';
import StatusNote from '../ui/StatusNote';

export default function ProfileCard({ userId, onClose }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);
  const cardRef = useRef(null);
  const openerRef = useRef(null);
  const capturedRef = useRef(false);

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

  // Captured during RENDER, on the first pass — NOT in the effect below. React
  // applies a child's `autoFocus` during the commit, which runs before effects,
  // so an effect-time read of `document.activeElement` returns whatever won the
  // commit rather than the row that opened us. On close that control has
  // unmounted with the card, and focus falls to <body>.
  //
  // The card has no autofocusing child today, which is exactly why this was
  // invisible: the effect-time read happened to be correct, and the test that
  // covered it used a trigger with no autofocusing sibling. AuthSheet shipped
  // that same shape to production green and broken, and was fixed in PR 148.
  // (Written without a leading hash: noHardcodedHex.test.js matches a hash
  // followed by three or more hex digits, so a PR reference reads as a colour.)
  // Reading it here, before the commit, is the only point at which the opener
  // is still focused.
  if (!capturedRef.current) {
    capturedRef.current = true;
    openerRef.current = document.activeElement;
  }

  useEffect(() => {
    cardRef.current?.focus();
    return () => {
      const opener = openerRef.current;
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
  }, []);

  // Tab wraps inside the card. This is a modal — there is a scrim over the page
  // and `aria-modal` tells assistive tech the rest of the document is inert —
  // so letting Tab walk out into a leaderboard the user cannot see would make
  // both claims false. The card only renders while open, so the trap is always
  // armed.
  useFocusTrap(cardRef, true);

  // Escape dismisses, matching AccountChip / ThemeChip / AuthSheet. Listening
  // on `document` rather than the card means it still fires if focus has been
  // dragged outside by something we don't control.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    // Retry re-runs this effect via `nonce` without remounting the card, so a
    // stale error from the previous attempt must be cleared here — otherwise
    // it stays true and renders back over freshly-loaded data.
    setError(false);
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
  }, [userId, nonce]);

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
        {error && (
          <StatusNote
            tone="error"
            icon={AlertTriangle}
            action={{ label: 'Retry', onClick: () => setNonce((n) => n + 1) }}
          >
            Couldn&apos;t load profile.
          </StatusNote>
        )}
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
