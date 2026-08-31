import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, SPACE, Z } from '../../lib/theme';
import { Stack } from '../ui/Layout';
import Heading from '../ui/Heading';
import Button from '../ui/Button';
import Surface from '../ui/Surface';
import LevelSwitcher from '../ui/LevelSwitcher';
import GoalPicker from '../gamification/GoalPicker';
import AppearancePicker from '../AppearancePicker';
import AccountSection from './AccountSection';
import EmailSection from './EmailSection';
import ProfileSection from './ProfileSection';
import useFocusTrap from '../../lib/useFocusTrap';
import { getThemeModeForUI, setThemePreference } from '../../lib/themeMode';

// The dedicated Settings surface.
//
// Reached from the header AccountChip, NOT from a seventh nav tab: six tabs
// already ship, the nav went icon-only in #153 because labels stopped fitting,
// and the 320px header budget is a measured 10px.
//
// Unlike the three header chips — which are non-modal and deliberately NOT
// trapped — this is a full-screen surface, so it takes the standard focus trap.
function Section({ label, children }) {
  return (
    <section>
      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: FONT_SIZE.tag,
          fontWeight: FONT_WEIGHT.bold,
          letterSpacing: LETTER_SPACING.caps,
          textTransform: 'uppercase',
          color: COLORS.mute,
          marginBottom: SPACE[3],
        }}
      >
        {label}
      </div>
      <Surface elevation={1} padding={4}>
        {children}
      </Surface>
    </section>
  );
}

export default function SettingsRoute({
  open,
  onClose,
  user,
  profile,
  onProfileSaved,
  onToast,
  level,
  onLevelChange,
  goal,
  onGoalChange,
  onSignIn,
  onSignOut,
  onExport,
  onDelete,
  lastSyncedAt,
}) {
  // Appearance owns its own mode, exactly as ThemeChip does — the preference
  // lives in localStorage, not in App state, so threading it through would add
  // a second source for one device setting.
  const [themeMode, setThemeMode] = useState(() => getThemeModeForUI());
  const panelRef = useRef(null);
  useFocusTrap(panelRef, open);

  // Escape listens on the document, not the panel: the same handling the three
  // header sheets use. A handler bound to the panel alone misses the key
  // whenever focus has not yet landed inside it.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: Z.modal,
        background: COLORS.paper,
        overflowY: 'auto',
        padding: SPACE[5],
      }}
    >
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: SPACE[3],
            marginBottom: SPACE[6],
          }}
        >
          <Heading level={1} style={{ margin: 0 }}>
            Einstellungen
          </Heading>
          <Button variant="icon" aria-label="Close settings" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>

        <Stack gap={8}>
          <Section label="Profil">
            <ProfileSection
              profile={profile}
              userId={user?.id}
              onSaved={onProfileSaved}
              onToast={onToast}
            />
          </Section>

          {/* Level reuses the SAME control the header uses. A second level UI
              would be a second write path, and level carries its own LWW
              timestamp precisely because a stale device once clobbered it. */}
          <Section label="Lernen">
            <Stack gap={5}>
              <LevelSwitcher value={level} onChange={onLevelChange} />
              <GoalPicker goal={goal} onPick={onGoalChange} />
            </Stack>
          </Section>

          <Section label="Darstellung">
            <AppearancePicker
              mode={themeMode}
              onPick={(pref) => {
                setThemePreference(pref);
                setThemeMode(pref);
              }}
            />
          </Section>

          {/* Sync, export and the danger zone, moved here wholesale from Stats
              rather than re-authored. */}
          {/* Konto holds the ACCOUNT: which address it is reachable at, sync,
              export and the danger zone. Identity — handle and avatar — stays
              in Profil, so each field has exactly one editor. */}
          <Section label="Konto">
            <Stack gap={5}>
              <EmailSection user={user} onToast={onToast} onReauth={onSignIn} />
              <AccountSection
                user={user}
                onSignIn={onSignIn}
                onSignOut={onSignOut}
                onExport={onExport}
                onDelete={onDelete}
                lastSyncedAt={lastSyncedAt}
              />
            </Stack>
          </Section>
        </Stack>
      </div>
    </div>
  );
}
