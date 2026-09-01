import { useState } from 'react';
import {
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  SPACE,
  RADIUS,
  SHADOW,
} from '../../lib/theme';
import { Stack } from '../ui/Layout';
import Heading from '../ui/Heading';
import Surface from '../ui/Surface';
import LevelSwitcher from '../ui/LevelSwitcher';
import GoalPicker from '../gamification/GoalPicker';
import AppearancePicker from '../AppearancePicker';
import AccountSection from './AccountSection';
import EmailSection from './EmailSection';
import ProfileSection from './ProfileSection';
import { getThemeModeForUI, setThemePreference } from '../../lib/themeMode';
import { writeLevel, LEVEL_NAMES, LEVEL_MODES } from '../../lib/levelPref';
import { LEVEL_MULTIPLIERS } from '../../lib/gameConfig';

// Settings as a panel inside the Profile tab — not a seventh nav tab, and
// not a modal. Six tabs already ship; the 320px header budget is a measured
// 10px. The Profile tab's SETTINGS segment is the one surface, and the
// `#/settings` hash still deep-links here after the entry gate.
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
  user,
  profile,
  onProfileSaved,
  onToast,
  level,
  onLevelChange,
  goal,
  onGoalChange,
  soundOn = false,
  onSoundChange,
  levelBoost = false,
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

  return (
    <div>
      <Heading level={1} style={{ margin: 0, marginBottom: SPACE[6] }}>
        Einstellungen
      </Heading>

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
            <LevelSwitcher
              value={level}
              onChange={(next) => {
                writeLevel(next);
                onLevelChange?.(next);
              }}
            />
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: FONT_SIZE.tag,
                letterSpacing: LETTER_SPACING.caps,
                color: COLORS.mute,
              }}
            >
              {LEVEL_NAMES[level] ?? ''}
              {levelBoost && (LEVEL_MULTIPLIERS[level] ?? 1) > 1
                ? ` · ×${LEVEL_MULTIPLIERS[level]} XP per answer`
                : ''}
            </div>
            {/* What the level actually changes, in the learner's terms.
                Printed verbatim, never case-transformed: lowercasing the
                detail turned B1's "AI-graded" into "ai-graded". */}
            {LEVEL_MODES[level] && (
              <div
                style={{
                  fontFamily: FONTS.body,
                  fontSize: FONT_SIZE.base,
                  color: COLORS.inkSoft,
                  overflowWrap: 'anywhere',
                }}
              >
                Translate exercises: <strong>{LEVEL_MODES[level].label}</strong> —{' '}
                {LEVEL_MODES[level].detail}.
              </div>
            )}
            <GoalPicker goal={goal} onPick={onGoalChange} />
            <button
              type="button"
              aria-pressed={soundOn}
              onClick={onSoundChange}
              style={{
                border: 'none',
                borderRadius: RADIUS.md,
                boxShadow: SHADOW.press(COLORS.lip),
                background: COLORS.card,
                color: COLORS.ink,
                padding: `${SPACE[2]}px ${SPACE[4]}px`,
                fontFamily: FONTS.mono,
                fontSize: FONT_SIZE.sm,
                letterSpacing: LETTER_SPACING.widest,
                cursor: 'pointer',
                alignSelf: 'flex-start',
              }}
            >
              {soundOn ? '🔊 SOUND: ON' : '🔇 SOUND: OFF'}
            </button>
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
  );
}
