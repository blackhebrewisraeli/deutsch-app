import { useState, useEffect, useRef } from 'react';
import { BarChart3, Flame, BookOpen, MessageSquare, Type, Languages } from 'lucide-react';
import { COLORS, FONT_DISPLAY, FONT_MONO, FONT_BODY, RADIUS, SHADOW } from './lib/theme';
import { loadState, saveState } from './lib/storage';
import { stampSettings } from './lib/settingsStamp';
import { readLevel, writeLevel } from './lib/levelPref';
import { getReviewItems, todayKey, TABS } from './lib/stats';
import { trialStatus } from './lib/trial';
import { getDueCount } from './lib/srs';
import {
  totalXp,
  todayXp,
  levelFromXp,
  goalProgress,
  earnedAchievements,
  gamificationContext,
  ACHIEVEMENTS,
  DEFAULT_GOAL,
} from './lib/gamification';
import { setSoundEnabled, playLevelUp, playAchievement, playGoalMet } from './lib/sound';
import {
  currentStreak,
  bestStreakFromHistory,
  qualifies,
  crossedMilestone,
  reconcile,
  freezesAvailable,
  multiplier,
} from './lib/streak';
import { activePack } from './packs';
const { decks: PRESET_DECKS } = activePack.content;
import { StatBlock } from './components/UI';
import ChatTab from './components/ChatTab';
import AlphabetTab from './components/AlphabetTab';
import VocabTab from './components/VocabTab';
import TranslateTab from './components/TranslateTab';
import StatsTab from './components/StatsTab';
import SplashScreen from './components/SplashScreen';
import WelcomeGate from './components/WelcomeGate';
import TrialWall from './components/TrialWall';
import AuthSheet from './components/auth/AuthSheet';
import AuthCallbackLanding from './components/auth/AuthCallbackLanding';
import AccountChip from './components/AccountChip';
import ThemeChip from './components/ThemeChip';
import {
  useAuth,
  signOut,
  getAccessToken,
  isAuthConfigured,
  mayHaveSession,
  signInWithGoogle,
  humanAuthError,
} from './lib/auth';
import { SYNC_ENABLED, start, stop, markDirty } from './lib/sync';
import { useSyncStatus } from './lib/useSyncStatus';
import { useLeagueRewards } from './lib/useLeagueRewards';
import Confetti from './components/ui/Confetti';
import ToastStack from './components/ui/Toast';
import LevelBadge from './components/gamification/LevelBadge';
import GoalRing from './components/gamification/GoalRing';
import GoalStrip from './components/gamification/GoalStrip';
import { Analytics } from '@vercel/analytics/react';
import { useWindowWidth, isMobile, isTiny, bp } from './lib/useWindowWidth';

export default function App() {
  const [tab, setTab] = useState('chat');
  const [stats, setStats] = useState({ streak: 0, learnedCount: 0, lastVisit: null });
  const [learnedWords, setLearnedWords] = useState({});
  const [reviewTarget, setReviewTarget] = useState(null);
  const [streakBurst, setStreakBurst] = useState(false);

  // ── Gamification ──────────────────────────────────────────────
  // Derived from storage, refreshed on every `deutsch:progress` event.
  const prevLevelRef = useRef(null);
  const prevStreakRef = useRef(null);
  const deriveGame = () => {
    const s = loadState() ?? {};
    const daily = s.daily ?? {};
    const goalXp = s.gamification?.goal ?? DEFAULT_GOAL;
    const frozenDays = s.gamification?.frozenDays ?? {};
    const streakNow = currentStreak(daily, goalXp, todayKey(), frozenDays);
    return {
      lvl: levelFromXp(totalXp(daily)),
      goal: goalProgress(todayXp(daily, todayKey()), goalXp),
      streak: streakNow,
      freezes: freezesAvailable(s, todayKey()),
      mult: multiplier(streakNow),
      // Guest-trial status rides along here so it refreshes with everything
      // else: applyProgress re-runs deriveGame on every `deutsch:progress`
      // event and on window focus. No extra effect, no extra listener.
      trial: trialStatus(daily, s.gamification),
    };
  };
  const [game, setGame] = useState(deriveGame);

  // Celebration toasts (level-up / achievement / goal-met).
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);
  const pushToasts = (items) => {
    setToasts((cur) => [
      ...cur,
      ...items.map((it) => {
        const id = ++toastIdRef.current;
        if (it.kind === 'ach') {
          const a = ACHIEVEMENTS.find((x) => x.id === it.id);
          return {
            id,
            icon: a?.icon ?? '🏅',
            title: a?.name ?? 'Achievement',
            sub: 'Achievement freigeschaltet',
          };
        }
        return { id, icon: it.icon, title: it.title, sub: it.sub };
      }),
    ]);
  };
  const dismissToast = (id) => setToasts((cur) => cur.filter((t) => t.id !== id));

  // Recompute gamification on every progress event; fire toasts for new wins.
  // First run silently backfills already-earned badges/level (no toast flood).
  useEffect(() => {
    function applyProgress() {
      const s = loadState() ?? {};
      const g = s.gamification ?? {
        goal: DEFAULT_GOAL,
        soundOn: false,
        achievements: {},
        lastGoalMet: null,
        bestStreak: 0,
      };
      const ctx = gamificationContext(s);
      const lvlInfo = levelFromXp(totalXp(s.daily ?? {}));
      const earned = earnedAchievements(ctx);
      const tKey = todayKey();
      const goal = goalProgress(todayXp(s.daily ?? {}, tKey), g.goal);

      const firstRun = prevLevelRef.current === null;
      const nextG = { ...g, achievements: { ...g.achievements } };
      const newToasts = [];

      if (firstRun) {
        for (const id of earned)
          if (!(id in nextG.achievements)) nextG.achievements[id] = Date.now();
        if (goal.met) nextG.lastGoalMet = tKey;
        prevLevelRef.current = lvlInfo.level;
      } else {
        if (lvlInfo.level > prevLevelRef.current) {
          newToasts.push({
            kind: 'level',
            title: `Level ${lvlInfo.level}`,
            sub: lvlInfo.rankName,
            icon: '⭐',
          });
        }
        prevLevelRef.current = lvlInfo.level;
        for (const id of earned) {
          if (!(id in nextG.achievements)) {
            nextG.achievements[id] = Date.now();
            newToasts.push({ kind: 'ach', id });
          }
        }
        if (goal.met && nextG.lastGoalMet !== tKey) {
          nextG.lastGoalMet = tKey;
          newToasts.push({
            kind: 'goal',
            title: 'Tagesziel erreicht!',
            sub: `${goal.target} XP`,
            icon: '🎯',
          });
        }
      }

      // Day-rollover reconcile: spend freezes to bridge missed days (once/day).
      const prevFrozen = g.frozenDays ?? {};
      const hadReconciled = g.lastReconcileDay != null;
      if (g.lastReconcileDay !== tKey) {
        const rec = reconcile(s, tKey);
        nextG.frozenDays = rec.frozenDays;
        nextG.lastReconcileDay = rec.lastReconcileDay;
      } else {
        nextG.frozenDays = prevFrozen;
      }
      const frozenDays = nextG.frozenDays;
      const freezeSpent =
        hadReconciled && Object.keys(frozenDays).length > Object.keys(prevFrozen).length;

      const tStreak = currentStreak(s.daily ?? {}, g.goal, tKey, frozenDays);
      const histBest = bestStreakFromHistory(s.daily ?? {}, g.goal, frozenDays);
      const prevBest = g.bestStreak ?? 0;
      // First run seeds the record from history or the prior (login-era) streak
      // so it isn't "lost" when the streak switches to practice-based.
      nextG.bestStreak = firstRun
        ? Math.max(prevBest, histBest, s.stats?.streak ?? 0)
        : Math.max(prevBest, histBest, tStreak);
      if (freezeSpent) {
        newToasts.push({
          kind: 'freeze',
          title: 'Freeze genutzt',
          sub: 'Streak gerettet',
          icon: '❄️',
        });
      }

      if (firstRun) {
        prevStreakRef.current = tStreak;
      } else {
        const prevStreak = prevStreakRef.current ?? 0;
        if (tStreak > prevStreak) {
          newToasts.push({
            kind: 'streak',
            title: `Streak → ${tStreak}`,
            sub: 'gesichert!',
            icon: '🔥',
          });
          if (tStreak > prevBest) {
            newToasts.push({
              kind: 'record',
              title: 'Neuer Rekord!',
              sub: `${tStreak} Tage`,
              icon: '🏆',
            });
          }
          const milestone = crossedMilestone(prevStreak, tStreak);
          if (milestone) {
            newToasts.push({
              kind: 'milestone',
              title: `${milestone}-Tage-Streak!`,
              sub: 'Meilenstein',
              icon: '⚡',
            });
          }
          const boost = multiplier(tStreak);
          if (boost > multiplier(prevStreak)) {
            newToasts.push({
              kind: 'boost',
              title: `×${boost} XP-Boost!`,
              sub: 'Multiplikator',
              icon: '🚀',
            });
          }
        }
        prevStreakRef.current = tStreak;
      }
      setStats((prev) => ({ ...prev, streak: tStreak }));

      saveState({ ...s, gamification: nextG });
      setSoundEnabled(!!nextG.soundOn);
      setGame(deriveGame());

      if (newToasts.length) {
        pushToasts(newToasts);
        setStreakBurst(true);
        setTimeout(() => setStreakBurst(false), 1600);
        if (nextG.soundOn) {
          newToasts.forEach((t) => {
            if (t.kind === 'level') playLevelUp();
            else if (t.kind === 'ach') playAchievement();
            else if (t.kind === 'goal') playGoalMet();
            else if (
              t.kind === 'streak' ||
              t.kind === 'record' ||
              t.kind === 'milestone' ||
              t.kind === 'freeze' ||
              t.kind === 'boost'
            )
              playGoalMet();
          });
        }
      }
    }

    applyProgress();
    window.addEventListener('deutsch:progress', applyProgress);
    window.addEventListener('focus', applyProgress);
    return () => {
      window.removeEventListener('deutsch:progress', applyProgress);
      window.removeEventListener('focus', applyProgress);
    };
  }, []);
  const width = useWindowWidth();
  const mobile = isMobile(width);
  const tiny = isTiny(width);

  // Auth
  const { user, status: authStatus } = useAuth();
  const syncStatus = useSyncStatus();
  // Claim any league-winner rewards on load (not just when the Leagues tab
  // opens), and celebrate a fresh win with a toast.
  useLeagueRewards(user?.id, (count, xp) =>
    pushToasts([
      {
        kind: 'league',
        title: count > 1 ? `${count} Ligen gewonnen!` : 'Liga gewonnen!',
        sub: `+${xp} XP · Liga-Meister`,
        icon: '🥇',
      },
    ])
  );
  // Dismissal is component state, not storage: the gate is a property of "is
  // there a session", so it comes back on the next load for anyone without one.
  const [gateDismissed, setGateDismissed] = useState(false);
  // Seeded from `deutsch-level`, not from isAuthConfigured(): env-independent
  // (spec F7), and it states the real precondition — someone who has never
  // picked a level needs the picker however they arrived.
  const [showSplash, setShowSplash] = useState(() => !localStorage.getItem('deutsch-level'));
  const [authModal, setAuthModal] = useState(null); // 'create' | 'signin' | null

  const handleGuest = () => {
    setGateDismissed(true);
    setShowSplash(true);
  };
  const handleAuthDone = () => {
    setAuthModal(null);
    setGateDismissed(true);
    setShowSplash(true);
    // Nothing reads this key any more; kept because AGENTS.md forbids removing
    // or migrating a storage key.
    localStorage.setItem('deutsch-onboarded', '1');
  };
  // Opens the shared AuthSheet in-place — no WelcomeGate round-trip.
  const requestSignIn = () => {
    if (!isAuthConfigured()) return;
    setAuthModal('signin');
  };

  // One Google entry point for all three surfaces — the sheet, the gate and
  // the trial wall each render the same button and call this. On success the
  // browser leaves for Google, so `busy` is deliberately never cleared: the
  // page is going away, and clearing it would re-enable the button for the
  // moment before it does.
  const [googleBusy, setGoogleBusy] = useState(false);
  const handleGoogle = async () => {
    if (googleBusy) return;
    setGoogleBusy(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setGoogleBusy(false);
      showToast(humanAuthError(error));
    }
  };

  const authOverlay = (
    <>
      <AuthCallbackLanding
        status={authStatus}
        onSignedIn={handleAuthDone}
        onRequestNew={requestSignIn}
      />
      <AuthSheet
        open={Boolean(authModal)}
        intent={authModal ?? 'signin'}
        onClose={() => setAuthModal(null)}
        onSuccess={handleAuthDone}
        onGoogle={handleGoogle}
        googleBusy={googleBusy}
      />
    </>
  );

  const showToast = (title) => pushToasts([{ kind: 'info', title, sub: '', icon: 'ℹ️' }]);

  const handleExport = async () => {
    const token = await getAccessToken();
    if (!token) {
      showToast('Please sign in again.');
      return;
    }
    try {
      const res = await fetch('/api/v1/account/export', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sprachschule-export.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast('Export failed — try again.');
    }
  };

  const handleDelete = async () => {
    const token = await getAccessToken();
    if (!token) {
      showToast('Please sign in again.');
      return;
    }
    try {
      const res = await fetch('/api/v1/account/delete', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      localStorage.clear();
      await signOut();
    } catch {
      showToast('Could not delete account — try again.');
    }
  };

  useEffect(() => {
    if (!SYNC_ENABLED || !user?.id) {
      stop();
      return;
    }
    start(user.id);
    return () => stop();
  }, [user?.id]);

  useEffect(() => {
    if (!SYNC_ENABLED || !user?.id) return;
    const onProgress = () => markDirty();
    window.addEventListener('deutsch:progress', onProgress);
    return () => window.removeEventListener('deutsch:progress', onProgress);
  }, [user?.id]);

  // Onboarding + level
  const [level, setLevel] = useState(readLevel);

  const handleSplashComplete = (chosenLevel) => {
    setLevel(chosenLevel);
    setShowSplash(false);
  };

  useEffect(() => {
    const s = loadState();
    if (s) {
      setLearnedWords(s.learnedWords || {});
      const today = todayKey();
      const goal = s.gamification?.goal ?? DEFAULT_GOAL;
      const streak = currentStreak(s.daily ?? {}, goal, today);
      const learnedCount = Object.values(s.learnedWords || {}).filter(Boolean).length;
      setStats({ streak, learnedCount, lastVisit: today });
    } else {
      setStats({ streak: 0, learnedCount: 0, lastVisit: todayKey() });
    }
  }, []);

  useEffect(() => {
    if (stats.lastVisit) {
      // Merge into existing state — recordEvent (from stats.js) writes a
      // `daily` field we must not clobber, and `markLearned` stamps
      // `settingsUpdatedAt`. The `{ ...current }` spread preserves both, so
      // this must stay a merge (never a replacement) or settings LWW breaks.
      const current = loadState() ?? {};
      saveState({ ...current, stats, learnedWords });
    }
  }, [stats, learnedWords]);

  // Review feed click handler — switches tab (and level for Translate),
  // then drops `reviewTarget` so the destination tab can pre-load the item.
  const handleReview = (item) => {
    if (item.tab === 'translate' && item.context && item.context !== level) {
      setLevel(item.context);
      writeLevel(item.context);
    }
    setReviewTarget(item);
    setTab(item.tab);
  };

  const clearReviewTarget = () => setReviewTarget(null);

  const markLearned = (word) => {
    setLearnedWords((prev) => {
      const next = { ...prev, [word]: !prev[word] };
      const count = Object.values(next).filter(Boolean).length;
      setStats((s) => ({ ...s, learnedCount: count }));
      return next;
    });
    stampSettings();
  };

  const tabs = [
    { id: 'chat', label: 'Chat', icon: MessageSquare, num: '01' },
    { id: 'alphabet', label: 'Alphabet', icon: Type, num: '02' },
    { id: 'vocab', label: 'Vocab', icon: BookOpen, num: '03' },
    { id: 'translate', label: 'Translate', icon: Languages, num: '04' },
    { id: 'stats', label: 'Stats', icon: BarChart3, num: '05' },
  ];

  // Stats nav badge — count of wrong items + due vocab cards.
  // Read fresh from storage on every render so it reflects exercises taken in
  // other tabs since the last App re-render. Cheap (single localStorage hit).
  const liveState = loadState() ?? {};
  const attentionCount =
    getReviewItems(liveState.items ?? {}).length +
    getDueCount(liveState.srs ?? {}, PRESET_DECKS, Date.now());

  // Streak at risk: user has a run going but today hasn't qualified yet.
  const goalNow = liveState.gamification?.goal ?? DEFAULT_GOAL;
  const streakPulsing =
    stats.streak > 0 && !qualifies((liveState.daily ?? {})[todayKey()], goalNow);

  // The guest trial is spent: block earning new progress, leave everything
  // else reachable. Every clause is load-bearing —
  //   • isAuthConfigured — a wall with no sign-in behind it is PR #79's
  //     dead-affordance bug again.
  //   • 'anonymous' only — never for a signed-in user, and never while
  //     'loading', or a returning account sees the wall flash before their
  //     session resolves.
  //   • practice tab only — Stats is the escape hatch, so it is never walled.
  //   • no celebration running — the designed peak fires on the very round
  //     that completes the first daily goal, i.e. the round that pushes the
  //     "Tagesziel erreicht!" toast and the confetti burst. Waiting for both
  //     to clear lets the celebration play in full; the wall lands after it,
  //     before the next round can start.
  const trialWallUp =
    isAuthConfigured() &&
    authStatus === 'anonymous' &&
    game.trial.exhausted &&
    TABS.includes(tab) &&
    toasts.length === 0 &&
    !streakBurst;

  // `loading` is the first render for everyone, and useAuth settles in an
  // effect — i.e. after paint. Without the mayHaveSession() clause a guest sees
  // one frame of the app before the gate; with it, a device holding no token
  // gets the gate on the first paint and a device that might have a session
  // renders the app and never blinks.
  const sessionUnresolved = authStatus === 'loading' && !mayHaveSession();
  const showGate =
    !gateDismissed && isAuthConfigured() && (authStatus === 'anonymous' || sessionUnresolved);

  if (showGate) {
    return (
      <>
        <WelcomeGate
          onGuest={handleGuest}
          onAuth={(intent) => setAuthModal(intent)}
          onGoogle={handleGoogle}
          googleBusy={googleBusy}
        />
        {authOverlay}
      </>
    );
  }

  if (showSplash) return <SplashScreen onComplete={handleSplashComplete} />;

  return (
    <div
      style={{
        minHeight: '100vh',
        position: 'relative',
        background: COLORS.paper,
        color: COLORS.ink,
        fontFamily: FONT_BODY,
        backgroundImage: `radial-gradient(circle at 1px 1px, ${COLORS.inkSoftA08} 1px, transparent 0)`,
        backgroundSize: '24px 24px',
      }}
    >
      {streakBurst && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, pointerEvents: 'none' }}>
          <Confetti count={40} />
        </div>
      )}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Header ───────────────────────────────────────────── */}
      <header
        style={{
          borderBottom: 'none',
          boxShadow: SHADOW.bar,
          padding: mobile ? '12px 10px' : '20px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: COLORS.paper,
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        {/* Dropped below 360px: a real year-long streak renders level 30 + "365"
            + a freeze chip + SIGN IN, which ran 34px past a 320px viewport, and
            each of those is the only surface for its signal (the freeze count
            appears nowhere else in the app). The wordmark is the one decorative
            item here, so it gives way instead.

            No minWidth: 0 on this block either — letting it shrink below its
            content made the nowrap wordmark spill over the level badge instead
            of pushing width: "over: 0" by overlap, which reads as a rendering
            bug. It scales via font-size instead. */}
        {!tiny && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                // Scales with the viewport between 360px and 640px.
                fontSize: mobile ? 'min(26px, 6.5vw)' : 36,
                whiteSpace: 'nowrap',
                fontWeight: 900,
                letterSpacing: '-0.04em',
                lineHeight: 1,
              }}
            >
              Deutsch<span style={{ color: COLORS.red }}>.</span>
            </div>
            {/* Tagline waits for bp.wide alongside the goal ring and the chat's
                third column: appearing at 640 it left the header 2px wider than
                the viewport, which is small but is still sideways scroll. */}
            {width >= bp.wide && (
              <div
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 10,
                  letterSpacing: '0.2em',
                  color: COLORS.mute,
                  textTransform: 'uppercase',
                }}
              >
                Sprachschule × Est. {new Date().getFullYear()}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: mobile ? 6 : 16, alignItems: 'center', flexShrink: 0 }}>
          <LevelBadge
            level={game.lvl.level}
            progress={game.lvl.progress}
            rank={game.lvl.rankName}
            size={mobile ? 42 : 52}
          />
          <StatBlock
            label={mobile ? '' : 'STREAK'}
            value={stats.streak}
            icon={<Flame size={mobile ? 12 : 14} />}
            accent
            pulsing={streakPulsing}
          />
          {game.freezes > 0 && (
            <span
              title={`${game.freezes} streak freeze${game.freezes > 1 ? 's' : ''} held`}
              style={{ fontSize: mobile ? 14 : 16 }}
            >
              ❄️{game.freezes}
            </span>
          )}
          {/* Held back until bp.wide: the desktop header wants 700px but
              `mobile` flips at 640, so the ring overflowed by 60px in between.
              It duplicates the goal strip under the nav, so it waits for room. */}
          {width >= bp.wide && <GoalRing pct={game.goal.pct} met={game.goal.met} size={48} />}
          <ThemeChip />
          <AccountChip
            user={user}
            onSignIn={requestSignIn}
            onSignOut={() => signOut()}
            pending={syncStatus.pending}
          />
        </div>
      </header>

      {/* ── Nav ──────────────────────────────────────────────── */}
      <nav
        style={{
          display: 'flex',
          gap: mobile ? 6 : 8,
          padding: mobile ? '8px 10px' : '12px 16px',
          background: COLORS.paper,
          position: 'sticky',
          top: mobile ? 53 : 81,
          zIndex: 49,
          boxShadow: SHADOW.bar,
        }}
      >
        {tabs.map((t) => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-label={t.label}
              aria-current={active ? 'page' : undefined}
              style={{
                flex: 1,
                // minWidth: 0 is the flex counterpart of the minmax(0, 1fr) rule
                // in AGENTS.md — `flex: 1` leaves min-width at auto, so these
                // buttons refused to shrink below their label and pushed the nav
                // 28px past a 640px viewport, on every tab.
                minWidth: 0,
                padding: mobile ? '12px 6px' : '14px 18px',
                background: active ? COLORS.ink : 'transparent',
                color: active ? COLORS.paper : COLORS.ink,
                border: 'none',
                borderRadius: RADIUS.md,
                boxShadow: active ? SHADOW.press('#000000') : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: mobile ? 'center' : 'flex-start',
                gap: 10,
                position: 'relative',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = COLORS.paperDeep;
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = 'transparent';
              }}
            >
              {mobile ? (
                // Mobile: icon only
                <Icon size={20} />
              ) : (
                <>
                  <span
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: 10,
                      opacity: 0.6,
                      letterSpacing: '0.1em',
                    }}
                  >
                    {t.num}
                  </span>
                  <span
                    style={{
                      fontFamily: FONT_DISPLAY,
                      fontSize: 20,
                      fontWeight: 600,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {t.label}
                  </span>
                </>
              )}
              {t.id === 'stats' && !active && attentionCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: mobile ? 4 : 8,
                    right: mobile ? 4 : 8,
                    minWidth: 18,
                    height: 18,
                    padding: '0 5px',
                    background: COLORS.red,
                    color: COLORS.paper,
                    fontFamily: FONT_MONO,
                    fontSize: 10,
                    fontWeight: 700,
                    lineHeight: 1,
                    borderRadius: 9,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {attentionCount > 9 ? '9+' : attentionCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Main ─────────────────────────────────────────────── */}
      <main
        style={{
          padding: mobile ? '16px 16px 32px' : '32px 32px',
          maxWidth: 1400,
          margin: '0 auto',
        }}
      >
        {/* On mobile this is the only daily-goal indicator — the header ring is
            dropped there for width — so it has to appear on every tab. On
            desktop the ring covers it, and the strip stays scoped to the two
            practice tabs it was built for. */}
        {(mobile || tab === 'translate' || tab === 'vocab') && (
          <GoalStrip
            streak={game.streak}
            current={game.goal.current}
            target={game.goal.target}
            mult={game.mult}
          />
        )}
        {/* The four practice tabs share one positioned wrapper so the trial
            wall can scrim THEM and nothing else. A position: fixed modal would
            take the header and nav with it, and the wall is explicitly not
            allowed to: Stats and settings stay reachable while it is up. */}
        {TABS.includes(tab) && (
          <div style={{ position: 'relative' }}>
            {tab === 'chat' && <ChatTab level={level} mobile={mobile} wide={width >= bp.wide} />}
            {tab === 'alphabet' && (
              <AlphabetTab
                level={level}
                mobile={mobile}
                reviewTarget={reviewTarget?.tab === 'alphabet' ? reviewTarget : null}
                onReviewConsumed={clearReviewTarget}
              />
            )}
            {tab === 'vocab' && (
              <VocabTab
                learnedWords={learnedWords}
                markLearned={markLearned}
                level={level}
                mobile={mobile}
                reviewTarget={reviewTarget?.tab === 'vocab' ? reviewTarget : null}
                onReviewConsumed={clearReviewTarget}
              />
            )}
            {tab === 'translate' && (
              <TranslateTab
                level={level}
                mobile={mobile}
                reviewTarget={reviewTarget?.tab === 'translate' ? reviewTarget : null}
                onReviewConsumed={clearReviewTarget}
              />
            )}
            {trialWallUp && (
              <TrialWall
                roundsUsed={game.trial.roundsUsed}
                mobile={mobile}
                onCreateAccount={() => setAuthModal('create')}
                onSignIn={requestSignIn}
                onGoogle={handleGoogle}
                googleBusy={googleBusy}
              />
            )}
          </div>
        )}
        {tab === 'stats' && (
          <StatsTab
            mobile={mobile}
            onReview={handleReview}
            user={user}
            onSignIn={requestSignIn}
            onSignOut={() => signOut()}
            onExport={handleExport}
            onDelete={handleDelete}
            lastSyncedAt={syncStatus.lastSyncedAt}
          />
        )}
      </main>

      {/* ── Footer — hidden on mobile ─────────────────────────── */}
      {!mobile && (
        <footer
          style={{
            borderTop: `2px solid ${COLORS.ink}`,
            padding: '16px 32px',
            marginTop: 64,
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: FONT_MONO,
            fontSize: 10,
            letterSpacing: '0.15em',
            color: COLORS.mute,
            textTransform: 'uppercase',
          }}
        >
          <span>Lernen × Sprechen × Verstehen</span>
          <span>// Powered by Claude</span>
        </footer>
      )}

      <Analytics />
      {authOverlay}
    </div>
  );
}
