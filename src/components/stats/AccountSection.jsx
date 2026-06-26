import { useState } from 'react';
import {
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  SPACE,
  RADIUS,
} from '../../lib/theme';
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

// Stats-tab account management.
// Guest: CTA to sign in for sync.
// Signed-in: email + sign out + last-synced + export + danger zone.
export default function AccountSection({
  user,
  onSignIn,
  onSignOut,
  onExport,
  onDelete,
  lastSyncedAt = null,
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exporting, setExporting] = useState(false);

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

  const handleExport = async () => {
    setExporting(true);
    try {
      await onExport?.();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ fontFamily: FONTS.body }}>
      <div style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.md, marginBottom: SPACE[2] }}>
        {user.email}
      </div>
      {lastSyncedAt != null && (
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: FONT_SIZE.tag,
            color: COLORS.mute,
            marginBottom: SPACE[2],
          }}
        >
          Last synced · {formatRelativeSync(lastSyncedAt)}
        </div>
      )}
      <Button variant="secondary" onClick={onSignOut} style={{ marginBottom: SPACE[4] }}>
        Sign out
      </Button>

      <div style={{ marginBottom: SPACE[3] }}>
        <Button
          variant="secondary"
          onClick={handleExport}
          disabled={exporting}
          aria-label="Export my data"
        >
          {exporting ? 'Exporting…' : 'Export my data'}
        </Button>
      </div>

      {/* Danger Zone */}
      <div
        style={{
          border: `1px solid ${COLORS.red}`,
          borderRadius: RADIUS.md,
          padding: SPACE[4],
          marginTop: SPACE[4],
        }}
      >
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: FONT_SIZE.tag,
            fontWeight: FONT_WEIGHT.bold,
            letterSpacing: LETTER_SPACING.caps,
            color: COLORS.red,
            marginBottom: SPACE[2],
          }}
        >
          DANGER ZONE
        </div>
        <p
          style={{
            fontFamily: FONTS.body,
            fontSize: FONT_SIZE.base,
            marginBottom: SPACE[3],
          }}
        >
          Permanently delete your account and all data. This cannot be undone.
        </p>
        {!confirmDelete ? (
          <Button
            variant="danger"
            aria-label="Delete account"
            onClick={() => setConfirmDelete(true)}
          >
            Delete account
          </Button>
        ) : (
          <div>
            <p
              style={{
                fontFamily: FONTS.mono,
                fontSize: FONT_SIZE.sm,
                marginBottom: SPACE[2],
                color: COLORS.red,
              }}
            >
              Are you sure? This will erase all your progress.
            </p>
            <div style={{ display: 'flex', gap: SPACE[2] }}>
              <Button
                variant="danger"
                aria-label="Yes, delete everything"
                onClick={async () => {
                  try {
                    await onDelete?.();
                  } catch {
                    setConfirmDelete(false);
                  }
                }}
              >
                Yes, delete everything
              </Button>
              <Button
                variant="secondary"
                aria-label="Cancel"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
