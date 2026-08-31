import { useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { COLORS, FONTS, FONT_SIZE, RADIUS, SPACE } from '../../lib/theme';
import Button from '../ui/Button';
import StatusNote from '../ui/StatusNote';
import { avatarFor } from '../../lib/avatar.js';
import { prepareAvatar, ACCEPTED_TYPES, ImagePrepError } from '../../lib/imagePrep.js';
import { uploadAvatar, removeAvatar } from '../../lib/avatarStorage.js';

// Pick → process → upload → point the row at it.
//
// ORDER MATTERS, and it is the only interesting thing in this component.
//
//   1. process   — strips EXIF; a failure here must never reach the bucket
//   2. upload    — a NEW object, at a new random path
//   3. save      — repoint profiles.avatar_path
//   4. delete    — the object we replaced, best-effort
//
// Save before delete. Reversing them would mean a failed save leaves the row
// pointing at an object that no longer exists — a broken avatar for everyone
// who can see it. Doing it this way, the worst case is an orphan nobody
// references, which costs 40 KB and no correctness.

const PREVIEW = 64;

export default function AvatarPicker({
  userId,
  profile,
  onSaved,
  onToast,
  save,
  prepare = prepareAvatar,
  upload = uploadAvatar,
  remove = removeAvatar,
}) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const current = avatarFor({ profile, userId });

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    // Cleared immediately so picking the SAME file twice still fires a change
    // event — otherwise a failed attempt cannot be retried without choosing a
    // different image.
    e.target.value = '';
    if (!file) return;

    setBusy(true);
    setError(null);
    const previous = profile?.avatar_path ?? null;
    try {
      const blob = await prepare(file);
      const path = await upload(userId, blob);
      const stored = await save({ avatar_path: path });
      onSaved?.(stored);
      onToast?.('Avatar updated');
      if (previous && previous !== path) await remove(previous);
    } catch (err) {
      setError(
        err instanceof ImagePrepError
          ? err.message
          : (err?.message ?? 'Could not update your avatar.')
      );
    } finally {
      setBusy(false);
    }
  };

  const onClear = async () => {
    const previous = profile?.avatar_path ?? null;
    if (!previous) return;
    setBusy(true);
    setError(null);
    try {
      const stored = await save({ avatar_path: null });
      onSaved?.(stored);
      onToast?.('Avatar removed');
      await remove(previous);
    } catch (err) {
      setError(err?.message ?? 'Could not remove your avatar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <span
        style={{
          display: 'block',
          fontFamily: FONTS.mono,
          fontSize: FONT_SIZE.tag,
          color: COLORS.mute,
          marginBottom: SPACE[1],
        }}
      >
        Avatar
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[3] }}>
        {current.kind === 'emoji' ? (
          <div
            data-avatar="emoji"
            style={{
              width: PREVIEW,
              height: PREVIEW,
              display: 'grid',
              placeItems: 'center',
              fontSize: 36,
              borderRadius: RADIUS.md,
              border: `1px solid ${COLORS.mute}`,
            }}
          >
            {current.glyph}
          </div>
        ) : (
          <img
            data-avatar={current.kind}
            src={current.src}
            alt=""
            width={PREVIEW}
            height={PREVIEW}
            style={{ borderRadius: RADIUS.md, display: 'block' }}
          />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[2] }}>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={onPick}
            aria-label="Choose an avatar image"
            style={{ display: 'none' }}
          />
          <Button variant="secondary" onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? 'Working…' : 'Upload a picture'}
          </Button>
          {profile?.avatar_path && (
            <Button variant="secondary" onClick={onClear} disabled={busy}>
              Remove picture
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ marginTop: SPACE[2] }}>
          <StatusNote tone="error" icon={AlertTriangle}>
            {error}
          </StatusNote>
        </div>
      )}
    </div>
  );
}
