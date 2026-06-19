import { COLORS, FONTS, FONT_SIZE } from '../../lib/theme';
import Button from '../ui/Button';

// Stats-tab account management. Guest: CTA to sign in for sync. Signed-in:
// email + sign out. Sync status (last-synced time) is added in B2.2.
export default function AccountSection({ user, onSignIn, onSignOut }) {
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
      <Button variant="secondary" onClick={onSignOut}>
        Sign out
      </Button>
    </div>
  );
}
