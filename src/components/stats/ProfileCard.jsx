import { useEffect, useState } from 'react';
import { fetchProfile, TIER_NAMES } from '../../lib/leagues.js';
import { COLORS, SPACE, RADIUS, Z } from '../../lib/theme.js';

export default function ProfileCard({ userId, onClose }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(false);

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
        background: 'rgba(0,0,0,0.5)',
        zIndex: Z.modal,
      }}
    >
      <div
        style={{
          background: COLORS.card,
          padding: `${SPACE[6]}px`,
          borderRadius: RADIUS.md,
          minWidth: 260,
          color: COLORS.ink,
        }}
      >
        <button
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
            <h3 style={{ margin: `${SPACE[2]}px 0` }}>{profile.handle}</h3>
            <p style={{ margin: 0 }}>{TIER_NAMES[profile.tier]}</p>
            <p style={{ margin: 0 }}>{profile.total_xp} total XP</p>
            <p style={{ margin: 0 }}>Longest streak: {profile.longest_streak} days</p>
          </div>
        )}
      </div>
    </div>
  );
}
