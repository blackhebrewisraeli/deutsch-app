import { useState } from 'react';
import { COLORS, FONTS, FONT_SIZE, RADIUS, SPACE } from '../../lib/theme';
import { Stack } from '../ui/Layout';
import Button from '../ui/Button';
import StatusNote from '../ui/StatusNote';
import { updateProfile } from '../../lib/profile';
import AvatarPicker from './AvatarPicker';
import { AlertTriangle } from 'lucide-react';

// Personal details: league handle and avatar emoji.
//
// display_name is gone. It shipped as a third field here and was populated on
// zero accounts, which made it a question the learner had to answer twice —
// "name" and "handle" — for one identity. `handle` wins because it is unique,
// already denormalised onto league_members, and already what other learners
// see. The COLUMN is left in place; dropping it is irreversible and it costs
// nothing empty.
//
// Handle and avatar are PROFILE fields here, not league fields, so they are not
// gated behind LEAGUES_ENABLED the way the old Stats editor gated them. Only
// the league standings readout stays behind that flag.
//
// Optimistic UI would be wrong: handle is UNIQUE, so the server can reject a
// value the form already shows. The stored row it returns is the source of
// truth, and it is what the fields are reset to on success.
const FIELDS = [
  { key: 'handle', label: 'Handle', placeholder: 'semion' },
  { key: 'avatar_emoji', label: 'Avatar emoji', placeholder: '🦊' },
];

const asForm = (profile) => ({
  handle: profile?.handle ?? '',
  avatar_emoji: profile?.avatar_emoji ?? '',
});

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

  // Dirty-tracking: Save is meaningless until something actually changed, and a
  // live Save button invites a pointless round trip on a UNIQUE column.
  const dirty = FIELDS.some((f) => form[f.key] !== saved[f.key]);

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const onSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const stored = await save({
        handle: form.handle,
        avatar_emoji: form.avatar_emoji,
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
    <Stack gap={3}>
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

      {FIELDS.map((field) => (
        <label key={field.key} style={{ display: 'block' }}>
          <span
            style={{
              display: 'block',
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.tag,
              color: COLORS.mute,
              marginBottom: SPACE[1],
            }}
          >
            {field.label}
          </span>
          <input
            value={form[field.key]}
            onChange={set(field.key)}
            placeholder={field.placeholder}
            style={{
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.base,
              padding: `${SPACE[1]}px ${SPACE[2]}px`,
              borderRadius: RADIUS.sm,
              border: `1px solid ${COLORS.mute}`,
              background: 'transparent',
              color: COLORS.ink,
              width: '100%',
            }}
          />
        </label>
      ))}

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
