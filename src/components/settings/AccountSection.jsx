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
import { LEAGUES_ENABLED, updateHandle } from '../../lib/leagues';
import { isAuthConfigured } from '../../lib/auth.js';

// Mirrors CONFIRM_PHRASE in api/v1/account/delete.js. The server is the
// authority — this only decides when the button stops being disabled.
export const DELETE_CONFIRM_PHRASE = 'DELETE';

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
  const [typed, setTyped] = useState('');
  const [exporting, setExporting] = useState(false);
  const [handle, setHandle] = useState('');
  const [avatar, setAvatar] = useState('');
  const [handleMsg, setHandleMsg] = useState(null); // { ok: bool, text: string }

  // See AccountChip: with no auth backend configured there is nothing to sign in
  // to, so don't advertise it. A signed-in user still gets the full section.
  if (!user && !isAuthConfigured()) return null;

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

  // Trim before comparing: phone keyboards add a trailing space after an
  // autocapitalised word, and blocking on invisible whitespace reads as a bug.
  // The trimmed phrase is what gets sent, so the server still sees it exactly.
  const confirmArmed = typed.trim() === DELETE_CONFIRM_PHRASE;

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

      {/* Handle / avatar editing */}
      {LEAGUES_ENABLED && (
        <div style={{ marginBottom: SPACE[4] }}>
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.tag,
              fontWeight: FONT_WEIGHT.bold,
              letterSpacing: LETTER_SPACING.caps,
              color: COLORS.mute,
              marginBottom: SPACE[2],
            }}
          >
            PROFILE
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[2] }}>
            <input
              aria-label="Handle"
              placeholder="Handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              style={{
                fontFamily: FONTS.mono,
                fontSize: FONT_SIZE.base,
                padding: `${SPACE[1]}px ${SPACE[2]}px`,
                borderRadius: RADIUS.sm,
                border: `1px solid ${COLORS.mute}`,
                background: 'transparent',
                color: COLORS.ink,
              }}
            />
            <input
              aria-label="Avatar emoji"
              placeholder="Avatar emoji"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              style={{
                fontFamily: FONTS.mono,
                fontSize: FONT_SIZE.base,
                padding: `${SPACE[1]}px ${SPACE[2]}px`,
                borderRadius: RADIUS.sm,
                border: `1px solid ${COLORS.mute}`,
                background: 'transparent',
                color: COLORS.ink,
              }}
            />
            <Button
              variant="secondary"
              onClick={async () => {
                setHandleMsg(null);
                try {
                  await updateHandle({ handle, avatar_emoji: avatar });
                  setHandleMsg({ ok: true, text: 'Saved!' });
                } catch (err) {
                  setHandleMsg({ ok: false, text: err.message ?? 'Failed to save.' });
                }
              }}
            >
              Save
            </Button>
            {handleMsg && (
              <div
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: FONT_SIZE.tag,
                  color: handleMsg.ok ? COLORS.green : COLORS.red,
                }}
              >
                {handleMsg.text}
              </div>
            )}
          </div>
        </div>
      )}

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
              This erases all your progress and cannot be undone. Type {DELETE_CONFIRM_PHRASE} to
              confirm.
            </p>
            <input
              aria-label={`Type ${DELETE_CONFIRM_PHRASE} to confirm`}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck="false"
              style={{
                fontFamily: FONTS.mono,
                fontSize: FONT_SIZE.base,
                padding: `${SPACE[1]}px ${SPACE[2]}px`,
                borderRadius: RADIUS.sm,
                border: `1px solid ${COLORS.red}`,
                background: 'transparent',
                color: COLORS.ink,
                width: '100%',
                marginBottom: SPACE[2],
              }}
            />
            <div style={{ display: 'flex', gap: SPACE[2] }}>
              {/* Disabled until the phrase matches, so the destructive control
                  cannot be reached by muscle memory alone. */}
              <Button
                variant="danger"
                aria-label={`Permanently delete my account`}
                disabled={!confirmArmed}
                onClick={async () => {
                  try {
                    await onDelete?.(DELETE_CONFIRM_PHRASE);
                  } catch {
                    // Leave the phrase typed. The usual rejection here is
                    // reauth_required, and retrying after signing in again
                    // should be one click rather than a re-type.
                  }
                }}
              >
                Permanently delete
              </Button>
              {/* `flex: 1` is explicit now that BUTTON.secondary no longer
                  carries it — this Cancel used to fill the rest of the confirm
                  row beside the destructive action. */}
              <Button
                variant="secondary"
                aria-label="Cancel"
                style={{ flex: 1 }}
                onClick={() => {
                  setConfirmDelete(false);
                  setTyped('');
                }}
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
