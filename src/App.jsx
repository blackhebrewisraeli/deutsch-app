import { useState, useEffect, useRef } from 'react';
import { BarChart3, Flame, BookOpen, MessageSquare, Type, Languages } from 'lucide-react';
import { COLORS, FONT_DISPLAY, FONT_MONO, FONT_BODY, RADIUS, SHADOW } from './lib/theme';
import { loadState, saveState } from './lib/storage';
import { stampSettings } from './lib/settingsStamp';
import { getReviewItems, todayKey } from './lib/stats';
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
import MagicLinkForm from './components/auth/MagicLinkForm';
import AccountChip from './components/AccountChip';
import { useAuth, signOut, getAccessToken } from './lib/auth';
import { SYNC_ENABLED, start, stop, markDirty } from './lib/sync';
import { useSyncStatus } from './lib/useSyncStatus';
import { useLeagueRewards } from './lib/useLeagueRewards';
import Confetti from './components/ui/Confetti';
import ToastStack from './components/ui/Toast';
import LevelBadge from './components/gamification/LevelBadge';
import GoalRing from './components/gamification/GoalRing';
import GoalStrip from './components/gamification/GoalStrip';
import { Analytics } from '@vercel/analytics/react';
import { useWindowWidth, isMobile } from './lib/useWindowWidth';

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

  // Auth
  const { user } = useAuth();
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
  const [showGate, setShowGate] = useState(() => !localStorage.getItem('deutsch-onboarded'));
  const [authModal, setAuthModal] = useState(null); // 'create' | 'signin' | null

  const handleGuest = () => setShowGate(false);
  const handleAuthDone = () => {
    setAuthModal(null);
    setShowGate(false);
    localStorage.setItem('deutsch-onboarded', '1');
  };
  // Re-surfaces the WelcomeGate with the sign-in modal open — the gate is the
  // only host for the auth modal, so signing in from within the app routes back
  // through it. (B2.2: an in-app modal host would avoid the gate round-trip.)
  const requestSignIn = () => {
    setShowGate(true);
    setAuthModal('signin');
  };

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
  const [showSplash, setShowSplash] = useState(() => !localStorage.getItem('deutsch-onboarded'));
  const [level, setLevel] = useState(() => {
    const stored = localStorage.getItem('deutsch-level');
    if (stored === 'beginner' || stored === 'a1') return 'a1';
    if (stored === 'a2') return 'a2';
    if (stored === 'intermediate' || stored === 'b1') return 'b1';
    return 'a1';
  });

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
      try {
        localStorage.setItem('deutsch-level', item.context);
        stampSettings();
      } catch {
        // ignore — best-effort persistence
      }
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

  if (showGate && !user) {
    return (
      <>
        <WelcomeGate onGuest={handleGuest} onAuth={(intent) => setAuthModal(intent)} />
        {authModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: `${COLORS.ink}aa`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 70,
              padding: 24,
            }}
            onClick={() => setAuthModal(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={authModal === 'create' ? 'Create your account' : 'Sign in'}
              style={{
                background: COLORS.paper,
                borderRadius: 16,
                padding: 24,
                maxWidth: 400,
                width: '100%',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <MagicLinkForm
                heading={authModal === 'create' ? 'Create your account' : 'Sign in'}
                onSuccess={handleAuthDone}
              />
            </div>
          </div>
        )}
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
        backgroundImage: `radial-gradient(circle at 1px 1px, ${COLORS.inkSoft}08 1px, transparent 0)`,
        backgroundSize: '24px 24px',
      }}
    >
      {streakBurst && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, pointerEvents: 'none' }}>
          <Confetti count={40} />
        </div>
      )}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600;9..144,700;9..144,900&family=JetBrains+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        button { font-family: inherit; cursor: pointer; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: ${COLORS.paperDeep}; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.ink}; border: 2px solid ${COLORS.paperDeep}; }
        @keyframes blink      { 0%, 60% { opacity: 1; } 61%, 100% { opacity: 0; } }
        @keyframes pulse-red  { 0%, 100% { box-shadow: 0 0 0 0 ${COLORS.red}80; } 50% { box-shadow: 0 0 0 12px ${COLORS.red}00; } }
        @keyframes slide-up   { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bounce     { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.18); } }
        @keyframes pulse-gold { 0%, 100% { box-shadow: 0 0 0 0 rgba(245,197,24,0.7); } 50% { box-shadow: 0 0 0 10px rgba(245,197,24,0); } }
        @keyframes shimmer    { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        .slide-up { animation: slide-up 0.3s ease-out; }
        @keyframes pop      { 0% { transform: scale(0.9); } 60% { transform: scale(1.06); } 100% { transform: scale(1); } }
        @keyframes wiggle   { 0%, 100% { transform: translateX(0) rotate(0); } 25% { transform: translateX(-4px) rotate(-1.5deg); } 75% { transform: translateX(4px) rotate(1.5deg); } }
        @keyframes confetti { 0% { transform: translate(0,0) rotate(0); opacity: 1; } 100% { transform: translate(var(--dx), 120px) rotate(var(--rot)); opacity: 0; } }
        .pop    { animation: pop 0.28s ease-out; }
        .wiggle { animation: wiggle 0.30s ease-in-out; }
        @media (prefers-reduced-motion: reduce) {
          .pop, .wiggle, .slide-up { animation: none !important; }
          .confetti-layer { display: none !important; }
        }
      `}</style>

      {/* ── Header ───────────────────────────────────────────── */}
      <header
        style={{
          borderBottom: 'none',
          boxShadow: SHADOW.bar,
          padding: mobile ? '12px 16px' : '20px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: COLORS.paper,
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: mobile ? 26 : 36,
              fontWeight: 900,
              letterSpacing: '-0.04em',
              lineHeight: 1,
            }}
          >
            Deutsch<span style={{ color: COLORS.red }}>.</span>
          </div>
          {!mobile && (
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

        <div style={{ display: 'flex', gap: mobile ? 10 : 16, alignItems: 'center' }}>
          <LevelBadge
            level={game.lvl.level}
            progress={game.lvl.progress}
            rank={game.lvl.rankName}
            size={mobile ? 42 : 52}
          />
          <StatBlock
            label="STREAK"
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
          <GoalRing pct={game.goal.pct} met={game.goal.met} size={mobile ? 40 : 48} />
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
        {(tab === 'translate' || tab === 'vocab') && (
          <GoalStrip
            streak={game.streak}
            current={game.goal.current}
            target={game.goal.target}
            mult={game.mult}
          />
        )}
        {tab === 'chat' && <ChatTab level={level} mobile={mobile} />}
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
    </div>
  );
}
