import { useState, useEffect, useRef } from 'react';
import { COLORS, FONT_MONO, FONT_BODY, RADIUS, SHADOW } from '../lib/theme';
import { speak } from '../lib/speech';
import { callClaude } from '../lib/claude';
import { chatSystemPrompt } from '../lib/prompts';
import { activePack } from '../packs';
const { scenarios: SCENARIOS, chatTasks: CHAT_TASKS } = activePack.content;
import { recordEvent } from '../lib/stats';
import WelcomeBanner from './chat/WelcomeBanner';
import ScenarioPicker from './chat/ScenarioPicker';
import TaskPanel from './chat/TaskPanel';
import MessageList from './chat/MessageList';
import ChatInput from './chat/ChatInput';
import CorrectionPanel from './chat/CorrectionPanel';

const WELCOME_KEY = 'deutsch-welcome-dismissed';

export default function ChatTab({ level = 'a1', mobile = false, wide = true }) {
  const [scenario, setScenario] = useState('free');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [correction, setCorrection] = useState(null);
  const [taskIdx, setTaskIdx] = useState(0);
  const [hintVisible, setHintVisible] = useState(false);
  const [tasksCompleted, setTasksCompleted] = useState(false);
  const [welcomeVisible, setWelcomeVisible] = useState(() => {
    try {
      return localStorage.getItem(WELCOME_KEY) !== '1';
    } catch {
      return false;
    }
  });
  const dismissWelcome = () => {
    try {
      localStorage.setItem(WELCOME_KEY, '1');
    } catch {
      /* ignore */
    }
    setWelcomeVisible(false);
  };
  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);

  const tasks = CHAT_TASKS[scenario]?.[level] ?? [];
  const currentTask = tasks[taskIdx % Math.max(tasks.length, 1)] ?? null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  useEffect(() => {
    setTaskIdx(0);
    setHintVisible(false);
    setTasksCompleted(false);
  }, [scenario, level]);

  useEffect(() => {
    const greeting = SCENARIOS.find((s) => s.id === scenario)?.greeting;
    if (!greeting) return;
    setMessages([{ role: 'assistant', ...greeting }]);
    setCorrection(null);
    setTimeout(() => speak(greeting.de), 400);
  }, [scenario, level]);

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert('Speech recognition not supported in this browser. Try Chrome.');
      return;
    }
    const rec = new SR();
    rec.lang = 'de-DE';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setInput(text);
      setListening(false);
      setTimeout(() => sendMessage(text), 100);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const sendMessage = async (overrideText) => {
    const text = overrideText ?? input;
    if (!text.trim() || thinking) return;
    const userMsg = { role: 'user', de: text };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setThinking(true);

    const scenarioDesc = SCENARIOS.find((s) => s.id === scenario)?.desc || 'open conversation';

    const systemPrompt = chatSystemPrompt({
      prompts: activePack.prompts,
      scenarioDesc,
      task: currentTask?.task,
      level,
    });

    const history = messages.slice(1).map((m) => ({
      role: m.role,
      content: m.role === 'user' ? m.de : JSON.stringify({ de: m.de, ipa: m.ipa, en: m.en }),
    }));

    try {
      const raw = await callClaude(systemPrompt, text, history, {
        routingContext: { taskType: 'chat', userTier: 'guest' },
      });
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      const reply = { role: 'assistant', de: parsed.de, ipa: parsed.ipa, en: parsed.en };
      setMessages((m) => [...m, reply]);
      setCorrection(parsed.correction || null);
      recordEvent('chat', level, parsed.correction ? 'wrong' : 'correct');
      if (parsed.taskComplete) {
        const nextIdx = (taskIdx + 1) % Math.max(tasks.length, 1);
        if (nextIdx === 0) setTasksCompleted(true);
        setTaskIdx(nextIdx);
        setHintVisible(false);
      }
      setTimeout(() => speak(parsed.de), 200);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          de: 'Entschuldigung, ein Fehler.',
          ipa: '[ɛntˈʃʊldɪɡʊŋ aɪ̯n ˈfeːlɐ]',
          en: 'Sorry — ' + err.message,
        },
      ]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <>
      {welcomeVisible && <WelcomeBanner mobile={mobile} onDismiss={dismissWelcome} />}
      <div
        style={{
          display: 'grid',
          // minmax(0, …) rather than a bare 1fr: 1fr keeps min-width auto, so
          // the track refused to shrink below its content and pushed the page
          // 190px past a 375px viewport.
          // The three-column form needs 712px (280 + 320 + 2×24 gap + 2×32 page
          // padding), but `mobile` releases at 640 — so 640–719 rendered three
          // columns in too little room and scrolled the page sideways. It waits
          // for `bp.wide` instead of `!mobile`.
          gridTemplateColumns: wide ? '280px minmax(0, 1fr) 320px' : 'minmax(0, 1fr)',
          gap: mobile ? 16 : 24,
          minHeight: mobile ? 'auto' : 'calc(100vh - 280px)',
        }}
      >
        <aside>
          <ScenarioPicker scenario={scenario} setScenario={setScenario} mobile={mobile} />

          {currentTask && (
            <TaskPanel
              currentTask={currentTask}
              taskIdx={taskIdx}
              tasksCompleted={tasksCompleted}
              hintVisible={hintVisible}
              setHintVisible={setHintVisible}
              onResetTasks={() => {
                setTasksCompleted(false);
                setTaskIdx(0);
              }}
            />
          )}

          <div
            style={{
              marginTop: 24,
              padding: 18,
              background: COLORS.paperDeep,
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.lg,
              boxShadow: SHADOW.card,
            }}
          >
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 10,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Tip
            </div>
            <div
              style={{ fontFamily: FONT_BODY, fontSize: 13, lineHeight: 1.5, fontStyle: 'italic' }}
            >
              Click the mic and speak German. {activePack.prompts.persona} corrects your mistakes —
              don&apos;t worry about perfection.
            </div>
          </div>
        </aside>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            borderRadius: RADIUS.lg,
            boxShadow: SHADOW.card,
            overflow: 'hidden',
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <MessageList messages={messages} thinking={thinking} endRef={messagesEndRef} />

          <ChatInput
            input={input}
            setInput={setInput}
            listening={listening}
            thinking={thinking}
            onSend={sendMessage}
            onStartListening={startListening}
            onStopListening={stopListening}
          />
        </div>

        <CorrectionPanel correction={correction} mobile={mobile} />
      </div>
    </>
  );
}
