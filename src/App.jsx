import { useState, useEffect } from 'react';
import { Check, Flame, BookOpen, MessageSquare, Type, Languages } from 'lucide-react';
import { Analytics } from '@vercel/analytics/react';
import { COLORS, FONT_DISPLAY, FONT_MONO, FONT_BODY } from './lib/theme';
import { loadState, saveState } from './lib/storage';
import { StatBlock } from './components/UI';
import ChatTab from './components/ChatTab';
import AlphabetTab from './components/AlphabetTab';
import VocabTab from './components/VocabTab';
import TranslateTab from './components/TranslateTab';

export default function App() {
  const [tab, setTab] = useState('chat');
  const [stats, setStats] = useState({ streak: 0, learnedCount: 0, lastVisit: null });
  const [learnedWords, setLearnedWords] = useState({});

  useEffect(() => {
    const s = loadState();
    if (s) {
      setLearnedWords(s.learnedWords || {});
      const today = new Date().toDateString();
      const last = s.stats?.lastVisit;
      let streak = s.stats?.streak || 0;
      if (last !== today) {
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (last === yesterday) streak += 1;
        else if (last) streak = 1;
        else streak = 1;
      }
      const learnedCount = Object.values(s.learnedWords || {}).filter(Boolean).length;
      setStats({ streak, learnedCount, lastVisit: today });
    } else {
      const today = new Date().toDateString();
      setStats({ streak: 1, learnedCount: 0, lastVisit: today });
    }
  }, []);

  useEffect(() => {
    if (stats.lastVisit) saveState({ stats, learnedWords });
  }, [stats, learnedWords]);

  const markLearned = (word) => {
    setLearnedWords((prev) => {
      const next = { ...prev, [word]: !prev[word] };
      const count = Object.values(next).filter(Boolean).length;
      setStats((s) => ({ ...s, learnedCount: count }));
      return next;
    });
  };

  const tabs = [
    { id: 'chat', label: 'Chat', icon: MessageSquare, num: '01' },
    { id: 'alphabet', label: 'Alphabet', icon: Type, num: '02' },
    { id: 'vocab', label: 'Vocab', icon: BookOpen, num: '03' },
    { id: 'translate', label: 'Translate', icon: Languages, num: '04' },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: COLORS.paper,
      color: COLORS.ink,
      fontFamily: FONT_BODY,
      backgroundImage: `radial-gradient(circle at 1px 1px, ${COLORS.inkSoft}08 1px, transparent 0)`,
      backgroundSize: '24px 24px',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600;9..144,700;9..144,900&family=JetBrains+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        button { font-family: inherit; cursor: pointer; }
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-track { background: ${COLORS.paperDeep}; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.ink}; border: 2px solid ${COLORS.paperDeep}; }
        @keyframes blink { 0%, 60% { opacity: 1; } 61%, 100% { opacity: 0; } }
        @keyframes pulse-red { 0%, 100% { box-shadow: 0 0 0 0 ${COLORS.red}80; } 50% { box-shadow: 0 0 0 12px ${COLORS.red}00; } }
        @keyframes slide-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .slide-up { animation: slide-up 0.3s ease-out; }
      `}</style>

      <header style={{
        borderBottom: `2px solid ${COLORS.ink}`,
        padding: '20px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: COLORS.paper,
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <div style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 36,
            fontWeight: 900,
            letterSpacing: '-0.04em',
            lineHeight: 1,
          }}>
            Deutsch<span style={{ color: COLORS.red }}>.</span>
          </div>
          <div style={{
            fontFamily: FONT_MONO,
            fontSize: 10,
            letterSpacing: '0.2em',
            color: COLORS.mute,
            textTransform: 'uppercase',
          }}>
            Sprachschule × Est. {new Date().getFullYear()}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <StatBlock label="STREAK" value={stats.streak} icon={<Flame size={14} />} accent />
          <div style={{ width: 1, height: 32, background: COLORS.ink }} />
          <StatBlock label="LEARNED" value={stats.learnedCount} icon={<Check size={14} />} />
        </div>
      </header>

      <nav style={{
        display: 'flex',
        borderBottom: `2px solid ${COLORS.ink}`,
        background: COLORS.paper,
        position: 'sticky',
        top: 81,
        zIndex: 49,
      }}>
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1,
                padding: '20px 24px',
                background: active ? COLORS.ink : 'transparent',
                color: active ? COLORS.paper : COLORS.ink,
                border: 'none',
                borderRight: `2px solid ${COLORS.ink}`,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                position: 'relative',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = COLORS.paperDeep; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{
                fontFamily: FONT_MONO,
                fontSize: 10,
                opacity: 0.6,
                letterSpacing: '0.1em',
              }}>{t.num}</span>
              <span style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: '-0.02em',
              }}>{t.label}</span>
              {active && (
                <span style={{
                  position: 'absolute',
                  right: 16,
                  width: 8,
                  height: 8,
                  background: COLORS.red,
                  borderRadius: '50%',
                }} />
              )}
            </button>
          );
        })}
      </nav>

      <main style={{ padding: 32, maxWidth: 1400, margin: '0 auto' }}>
        {tab === 'chat' && <ChatTab />}
        {tab === 'alphabet' && <AlphabetTab />}
        {tab === 'vocab' && <VocabTab learnedWords={learnedWords} markLearned={markLearned} />}
        {tab === 'translate' && <TranslateTab />}
      </main>

      <footer style={{
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
      }}>
        <span>Lernen × Sprechen × Verstehen</span>
        <span>// Powered by Claude</span>
      </footer>
      <Analytics />
    </div>
  );
}
