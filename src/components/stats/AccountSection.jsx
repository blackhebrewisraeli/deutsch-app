import { COLORS, FONTS, FONT_SIZE } from '../../lib/theme';
import Button from '../ui/Button';

function formatRelativeSync(ms) {
  if (!ms) return null;
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

// Stats-tab account management. Guest: CTA to sign in for sync. Signed-in:
// email + sign out + last-synced time when sync is active.
export default function AccountSection({ user, onSignIn, onSignOut, lastSyncedAt = null }) {
  if (!user) {
    return (
      <div style={{ fontFamily: FONTS.body }}>
        <p style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag, color: COLORS.mute }}>
          Sign in to sync your progress across devices.
        </p>
        <Button onClick={onSignIn}>Sign in to sync →</Button>
      </div>
    );
  }
  return (
    <div style={{ fontFamily: FONTS.body }}>
      <div style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.md, marginBottom: 8 }}>
        {user.email}
      </div>
      {lastSyncedAt != null && (
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: FONT_SIZE.tag,
            color: COLORS.mute,
            marginBottom: 8,
          }}
        >
          Last synced · {formatRelativeSync(lastSyncedAt)}
        </div>
      )}
      <Button variant="secondary" onClick={onSignOut}>
        Sign out
      </Button>
    </div>
  );
}
