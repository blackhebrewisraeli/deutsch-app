import { useState } from 'react';
import { COLORS, FONTS, FONT_SIZE, RADIUS, SPACE, TEXT } from '../../lib/theme';
import { Stack } from '../ui/Layout';
import Button from '../ui/Button';
import StatusNote from '../ui/StatusNote';
import { updateProfile } from '../../lib/profile';
import AvatarPicker from './AvatarPicker';
import { AlertTriangle } from 'lucide-react';

// Personal details: a chosen display name, a unique social handle, and the
// avatar picture picker. The two text fields are intentionally distinct:
// display_name is how the app addresses the learner, while @handle is the
// stable identifier other learners see on leaderboards.
//
// Avatar is a picture or a generated identicon — one identity surface, the
// picture picker. There is no emoji field.
//
// Handle and avatar are PROFILE fields here, not league fields, so they are not
// gated behind LEAGUES_ENABLED the way the old Stats editor gated them. Only
// the league standings readout stays behind that flag.
//
// Optimistic UI would be wrong: handle is UNIQUE, so the server can reject a
// value the form already shows. The stored row it returns is the source of
// truth, and it is what the fields are reset to on success.
const asForm = (profile) => ({
  display_name: profile?.display_name ?? '',
  handle: profile?.handle ?? '',
});

const labelStyle = { ...TEXT.fieldLabel, marginBottom: SPACE[1] };

const inputStyle = {
  fontFamily: FONTS.mono,
  fontSize: FONT_SIZE.base,
  padding: `${SPACE[1]}px ${SPACE[2]}px`,
  borderRadius: RADIUS.sm,
  border: `1px solid ${COLORS.mute}`,
  background: 'transparent',
  color: COLORS.ink,
  width: '100%',
  boxSizing: 'border-box',
};

export default function ProfileSection({
  profile,
  userId,
  onSaved,
  onToast,
  save = updateProfile,
}) {
  const [form, setForm] = useState(() => asForm(profile));
  const [saved, setSaved] = useState(() => asForm(profile));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Dirty-tracking keeps a unique-column write off the wire until either
  // identity field actually changed.
  const dirty = form.display_name !== saved.display_name || form.handle !== saved.handle;

  const onDisplayNameChange = (e) => setForm((prev) => ({ ...prev, display_name: e.target.value }));
  const onHandleChange = (e) => setForm((prev) => ({ ...prev, handle: e.target.value }));

  const onSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const stored = await save({
        display_name: form.display_name,
        handle: form.handle,
      });
      // Reset to what the SERVER stored, not to what was typed.
      const next = asForm(stored);
      setForm(next);
      setSaved(next);
      onSaved?.(stored);
      onToast?.('Profile saved');
    } catch (err) {
      setError(err?.message ?? 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack gap={2}>
      {/* The picker writes avatar_path on its own — it does not share this
          form's dirty-tracking, because an upload is a completed act rather
          than an edit waiting on Save. */}
      <AvatarPicker
        userId={userId}
        profile={profile}
        onSaved={onSaved}
        onToast={onToast}
        save={save}
      />

      <label style={{ display: 'block' }}>
        <span style={labelStyle}>Display name</span>
        <input
          value={form.display_name}
          onChange={onDisplayNameChange}
          placeholder="First and last name"
          maxLength={40}
          style={{ ...inputStyle, fontFamily: FONTS.body }}
        />
      </label>

      <label style={{ display: 'block' }}>
        <span style={labelStyle}>Handle</span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            borderRadius: RADIUS.sm,
            border: `1px solid ${COLORS.mute}`,
            color: COLORS.mute,
            paddingLeft: SPACE[2],
          }}
        >
          <span aria-hidden="true" style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.base }}>
            @
          </span>
          <input
            value={form.handle}
            onChange={onHandleChange}
            placeholder="semion"
            maxLength={24}
            style={{ ...inputStyle, border: 'none', paddingLeft: SPACE[1] }}
          />
        </div>
      </label>

      {error && (
        <StatusNote tone="error" icon={AlertTriangle}>
          {error}
        </StatusNote>
      )}

      <div>
        <Button onClick={onSave} disabled={!dirty || saving} busy={saving}>
          Save profile
        </Button>
      </div>
    </Stack>
  );
}
