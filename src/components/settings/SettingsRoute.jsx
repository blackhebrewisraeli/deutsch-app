import { useState } from 'react';
import { SPACE, TEXT } from '../../lib/theme';
import { Stack } from '../ui/Layout';
import Heading from '../ui/Heading';
import SectionLabel from '../ui/SectionLabel';
import Surface from '../ui/Surface';
import { Body } from '../ui/Text';
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
import FeedbackDialog from '../FeedbackDialog';
import { replayTutorial } from '../../lib/tutorialPref';
import { userTierOf } from '../../lib/ai-routing/preference.js';
import { getThemeModeForUI, setThemePreference } from '../../lib/themeMode';
import { writeLevel, LEVEL_NAMES, LEVEL_MODES } from '../../lib/levelPref';
import { LEVEL_MULTIPLIERS } from '../../lib/gameConfig';
import { useAdminSession } from '../../lib/useAdminSession.js';

// Settings as a panel inside the Profile tab — not a seventh nav tab, and
// not a modal. Six tabs already ship; the 320px header budget is a measured
// 10px. The Profile tab's SETTINGS segment is the one surface, and the
// `#/settings` hash still deep-links here after the entry gate.
//
// Type on this route reads in exactly three tiers, and every block below picks
// one of them rather than inventing a recipe:
//
//   Section   mono caps, mute ...... the panel's own title (SectionLabel)
//   Field     body semibold, ink ... a control inside a panel (TEXT.subhead)
//   Hint      body 13/1.5, soft .... the sentence under a control (Body)
//
// Before this pass there were two: a panel title and a sub-heading wore the
// SAME mono-caps recipe, inlined five times, and the hint under a control was
// 12px in three places and 13px in three others, none of them with a
// line-height. That is what made the route read as flat — not the colours.

// Supporting copy under a control.
function Hint({ children }) {
  return (
    <Body size="sm" tone="soft" style={{ overflowWrap: 'anywhere' }}>
      {children}
    </Body>
  );
}

// A named control inside a panel: sub-heading, optional hint, then the control.
function Field({ label, hint, children }) {
  return (
    <Stack gap={2}>
      <div style={TEXT.subhead}>{label}</div>
      {hint ? <Hint>{hint}</Hint> : null}
      {children}
    </Stack>
  );
}

function Section({ label, children }) {
  return (
    <section>
      <SectionLabel>{label}</SectionLabel>
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
  const [reporting, setReporting] = useState(false);
  const adminSession = useAdminSession(user);

  return (
    <div>
      <Heading level={1} style={{ margin: 0, marginBottom: SPACE[6] }}>
        Einstellungen
      </Heading>

      <Stack gap={8}>
        {adminSession.me?.blocked ? (
          <Section label="Account status">
            <Body size="sm" style={{ overflowWrap: 'anywhere' }}>
              This account is blocked. You can still export or delete your data below.
            </Body>
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
            <Hint>
              The learner path for changing practice level. Also offered on Home after you finish
              three vocab decks.
            </Hint>
            {/* The current band, as a readout rather than a label. It used to
                be 10px mono at caps tracking with no uppercase transform, so
                "Beginner" rendered letter-spaced in a face meant for labels —
                the tracking said "label", the sentence case said "value", and
                it read as neither. */}
            <Body size="sm" tone="soft" style={{ overflowWrap: 'anywhere' }}>
              <strong>{LEVEL_NAMES[level] ?? ''}</strong>
              {levelBoost && (LEVEL_MULTIPLIERS[level] ?? 1) > 1
                ? ` · ×${LEVEL_MULTIPLIERS[level]} XP per answer`
                : ''}
            </Body>
            {/* What the level actually changes, in the learner's terms.
                Printed verbatim, never case-transformed: lowercasing the
                detail turned B1's "AI-graded" into "ai-graded". */}
            {LEVEL_MODES[level] && (
              <Hint>
                Translate exercises: <strong>{LEVEL_MODES[level].label}</strong> —{' '}
                {LEVEL_MODES[level].detail}.
              </Hint>
            )}
            <details
              open={showLevelOverride}
              onToggle={(e) => setShowLevelOverride(e.currentTarget.open)}
            >
              <summary
                style={{ ...TEXT.label, cursor: 'pointer', minWidth: 0, overflowWrap: 'anywhere' }}
              >
                Advanced — override classification
              </summary>
              {showLevelOverride && (
                <Stack gap={3} style={{ marginTop: SPACE[3] }}>
                  <Hint>
                    Writes CEFR without a placement test. Learners should retake placement. This
                    override exists for sync debugging and tests.
                  </Hint>
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
              <Field
                label="Interessen"
                hint="Optional topical vocabulary. Enabled decks appear under Interests in Vocab Practice."
              >
                <InterestPicker
                  topics={interestTopics}
                  enabled={enabledInterests}
                  onChange={onInterestsChange}
                />
              </Field>
            )}
            {/* Settings keeps the always-visible 2×2 grid. Chat collapsed its
                copy into a pull-down (ModelPopover) because Chat is the
                conversation; here the grid IS the surface, and hiding a
                setting behind a disclosure on the settings screen would be
                the wrong trade. */}
            <Field
              label="KI-Modell"
              hint="Used for Chat with Anna. Auto keeps the current router. Fast / Balanced / Capable pick a band when your plan allows it."
            >
              <ModelPicker
                value={preferredModel}
                onChange={onPreferredModelChange}
                userTier={userTierOf(user)}
              />
            </Field>
            {/* Was a hand-rolled button carrying its own copy of the
                secondary recipe — and therefore no focus ring, no press
                state, and a letter-spacing one stop off every other button on
                the route. The ALL-CAPS is the button token's, not the
                string's, so the accessible name stays sentence case. */}
            <Button
              variant="secondary"
              aria-pressed={soundOn}
              onClick={onSoundChange}
              style={{ alignSelf: 'flex-start' }}
            >
              {soundOn ? '🔊 Sound: on' : '🔇 Sound: off'}
            </Button>
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

        {/* Hilfe is for EVERY learner, admin or not, and it sits above the
            admin block on purpose.

            Reporting a problem already worked for non-admins — the insert is a
            plain RLS-guarded write, never gated on a role — but the only way to
            reach it was a small grey flag tucked inside a Translate or Vocab
            exercise. A learner who hit something wrong on Home, in Chat, or in
            Settings itself had nowhere to say so, which reads as "feedback is
            an admin feature". This is the standing entry point; the in-exercise
            flag stays, because a report filed there carries the deck and item
            the learner is actually looking at.

            The tour re-entry lives here too: it is now marked seen the first
            time it paints, so this is how anyone gets it back. */}
        <Section label="Hilfe">
          <Stack gap={5}>
            <div>
              <Button variant="secondary" onClick={() => setReporting(true)}>
                Report an issue
              </Button>
              <div style={{ marginTop: SPACE[2] }}>
                <Hint>
                  Something wrong with a word, a translation or the app itself? Tell us here. Inside
                  an exercise, the flag icon reports that exact card.
                </Hint>
              </div>
            </div>
            <div>
              <Button
                variant="secondary"
                onClick={() => {
                  replayTutorial();
                  onToast?.('Tutorial reopened');
                }}
              >
                Show tutorial
              </Button>
              <div style={{ marginTop: SPACE[2] }}>
                <Hint>Replay the short walkthrough of the header, Chat and Profile.</Hint>
              </div>
            </div>
          </Stack>
        </Section>

        {adminSession.me?.isAdmin ? (
          <Section label="Admin">
            <AdminSection me={adminSession.me} />
          </Section>
        ) : null}

        {/* `surface: 'settings'` rather than a drill name — there is no card
            being asked about here, so deckId / itemId / itemLabel stay absent
            and the row records where the report came from. */}
        {reporting && (
          <FeedbackDialog
            context={{ surface: 'settings', level }}
            onClose={() => setReporting(false)}
          />
        )}
      </Stack>
    </div>
  );
}
