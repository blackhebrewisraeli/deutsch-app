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
import Button from '../ui/Button';
import GoalPicker from '../gamification/GoalPicker';
import AppearancePicker from '../AppearancePicker';
import AccountSection from './AccountSection';
import EmailSection from './EmailSection';
import ProfileSection from './ProfileSection';
import OfflineCacheSection from './OfflineCacheSection';
import InterestPicker from './InterestPicker';
import ModelPicker from '../ModelPicker';
import AdminSection from '../admin/AdminSection';
import { userTierOf } from '../../lib/ai-routing/preference.js';
import { getThemeModeForUI, setThemePreference } from '../../lib/themeMode';
import { writeLevel, LEVEL_NAMES, LEVEL_MODES } from '../../lib/levelPref';
import { LEVEL_MULTIPLIERS } from '../../lib/gameConfig';
import { useAdminSession } from '../../lib/useAdminSession.js';

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
  onRetakePlacement,
  goal,
  onGoalChange,
  soundOn = false,
  onSoundChange,
  interestTopics = [],
  enabledInterests = [],
  onInterestsChange,
  preferredModel = 'auto',
  onPreferredModelChange,
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
  const [showLevelOverride, setShowLevelOverride] = useState(false);
  const adminSession = useAdminSession(user);

  return (
    <div>
      <Heading level={1} style={{ margin: 0, marginBottom: SPACE[6] }}>
        Einstellungen
      </Heading>

      <Stack gap={8}>
        {adminSession.me?.blocked ? (
          <Section label="Account status">
            <div
              style={{
                fontFamily: FONTS.body,
                fontSize: FONT_SIZE.base,
                color: COLORS.ink,
                overflowWrap: 'anywhere',
              }}
            >
              This account is blocked. You can still export or delete your data below.
            </div>
          </Section>
        ) : null}

        <Section label="Profil">
          <ProfileSection
            profile={profile}
            userId={user?.id}
            onSaved={onProfileSaved}
            onToast={onToast}
          />
        </Section>

        {/* Placement is the learner path. The switcher is an advanced
            override (sync debug / tests / stuck learner) — Phase 2 gating
            treats classified CEFR as the source of truth. */}
        <Section label="Lernen">
          <Stack gap={5}>
            <Button variant="secondary" onClick={onRetakePlacement}>
              Retake placement
            </Button>
            <div
              style={{
                fontFamily: FONTS.body,
                fontSize: FONT_SIZE.sm,
                color: COLORS.inkSoft,
                overflowWrap: 'anywhere',
              }}
            >
              The learner path for changing practice level. Also offered on Home after you finish
              three vocab decks.
            </div>
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
            <details
              open={showLevelOverride}
              onToggle={(e) => setShowLevelOverride(e.currentTarget.open)}
            >
              <summary
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: FONT_SIZE.tag,
                  letterSpacing: LETTER_SPACING.caps,
                  textTransform: 'uppercase',
                  color: COLORS.mute,
                  cursor: 'pointer',
                  minWidth: 0,
                  overflowWrap: 'anywhere',
                }}
              >
                Advanced — override classification
              </summary>
              {showLevelOverride && (
                <Stack gap={3} style={{ marginTop: SPACE[3] }}>
                  <div
                    style={{
                      fontFamily: FONTS.body,
                      fontSize: FONT_SIZE.sm,
                      color: COLORS.inkSoft,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    Writes CEFR without a placement test. Learners should retake placement. This
                    override exists for sync debugging and tests.
                  </div>
                  <LevelSwitcher
                    value={level}
                    onChange={(next) => {
                      writeLevel(next);
                      onLevelChange?.(next);
                    }}
                  />
                </Stack>
              )}
            </details>
            <GoalPicker goal={goal} onPick={onGoalChange} />
            {interestTopics.length > 0 && (
              <Stack gap={3}>
                <div
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: FONT_SIZE.tag,
                    fontWeight: FONT_WEIGHT.bold,
                    letterSpacing: LETTER_SPACING.caps,
                    textTransform: 'uppercase',
                    color: COLORS.mute,
                  }}
                >
                  Interessen
                </div>
                <div
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: FONT_SIZE.sm,
                    color: COLORS.inkSoft,
                    overflowWrap: 'anywhere',
                  }}
                >
                  Optional topical vocabulary. Enabled decks appear under Interests in Vocab
                  Practice.
                </div>
                <InterestPicker
                  topics={interestTopics}
                  enabled={enabledInterests}
                  onChange={onInterestsChange}
                />
              </Stack>
            )}
            <Stack gap={3}>
              <div
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: FONT_SIZE.tag,
                  fontWeight: FONT_WEIGHT.bold,
                  letterSpacing: LETTER_SPACING.caps,
                  textTransform: 'uppercase',
                  color: COLORS.mute,
                }}
              >
                KI-Modell
              </div>
              <div
                style={{
                  fontFamily: FONTS.body,
                  fontSize: FONT_SIZE.sm,
                  color: COLORS.inkSoft,
                  overflowWrap: 'anywhere',
                }}
              >
                Used for Chat with Anna. Auto keeps the current router. Fast / Balanced / Capable
                pick a band when your plan allows it.
              </div>
              <ModelPicker
                value={preferredModel}
                onChange={onPreferredModelChange}
                userTier={userTierOf(user)}
              />
            </Stack>
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

        {/* Gerät is device Cache Storage, not account data — guests need it
            too, and AccountSection is hidden when auth is unconfigured. */}
        <Section label="Gerät">
          <OfflineCacheSection onToast={onToast} />
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

        {adminSession.me?.isAdmin ? (
          <Section label="Admin">
            <AdminSection me={adminSession.me} />
          </Section>
        ) : null}
      </Stack>
    </div>
  );
}
