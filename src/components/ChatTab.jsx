import { useState, useEffect, useRef, useMemo } from 'react';
import {
  COLORS,
  FONT_MONO,
  FONT_BODY,
  FONT_SIZE,
  LETTER_SPACING,
  SPACE,
  RADIUS,
} from '../lib/theme';
import { callClaude } from '../lib/claude';
import { chatSystemPrompt } from '../lib/prompts';
import { classifiedLevel } from '../lib/levelGate';
import { getUserLevel } from '../lib/levelPref';
import { buildChatAllowlist, scenariosForLevel } from '../lib/chatVocab';
import { interestPromptHints } from '../lib/interests';
import { sanitizePreferredModel, userTierOf } from '../lib/ai-routing/preference.js';
import ModelPicker from './ModelPicker';
import { activePack } from '../packs';
const {
  scenarios: SCENARIOS,
  chatTasks: CHAT_TASKS,
  decks: PACK_DECKS,
  interestDecks: PACK_INTEREST_DECKS,
  interestTopics: INTEREST_TOPICS,
} = activePack.content;
import { recordEvent } from '../lib/stats';
import WelcomeBanner from './chat/WelcomeBanner';
import ScenarioPicker from './chat/ScenarioPicker';
import TaskPanel from './chat/TaskPanel';
import MessageList from './chat/MessageList';
import ChatInput from './chat/ChatInput';

const WELCOME_KEY = 'deutsch-welcome-dismissed';

// Pack field `de` is the surface form (recorded AGENTS.md exception). The
// engine never reads it; this callback is how Chat resolves card ids.
const termOf = (card) => card.de;

export default function ChatTab({
  mobile = false,
  wide = true,
  learnedWords = {},
  learnedByDeck = {},
  enabledInterests = [],
  preferredModel = 'auto',
  onPreferredModelChange,
  user = null,
}) {
  // Classified CEFR is the source of truth. A `level` prop (still passed by
  // App for tab-API consistency) cannot raise the band.
  const chatLevel = classifiedLevel(getUserLevel());
  const visibleScenarios = useMemo(
    () => scenariosForLevel(SCENARIOS, CHAT_TASKS, chatLevel),
    [chatLevel]
  );
  const { vocab, sparse } = useMemo(
    () =>
      buildChatAllowlist({
        learnedByDeck,
        learnedWords,
        decks: { ...PACK_DECKS, ...PACK_INTEREST_DECKS },
        termOf,
      }),
    [learnedByDeck, learnedWords]
  );
  const interestHints = useMemo(
    () => interestPromptHints(INTEREST_TOPICS, enabledInterests),
    [enabledInterests]
  );

  const [scenario, setScenario] = useState(() => visibleScenarios[0]?.id ?? 'free');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
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

  const tasks = CHAT_TASKS[scenario]?.[chatLevel] ?? [];
  const currentTask = tasks[taskIdx % Math.max(tasks.length, 1)] ?? null;
  const stacked = !wide;

  useEffect(() => {
    if (visibleScenarios.some((s) => s.id === scenario)) return;
    setScenario(visibleScenarios[0]?.id ?? 'free');
  }, [visibleScenarios, scenario]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  useEffect(() => {
    setTaskIdx(0);
    setHintVisible(false);
    setTasksCompleted(false);
  }, [scenario, chatLevel]);

  useEffect(() => {
    const greeting = SCENARIOS.find((s) => s.id === scenario)?.greeting;
    if (!greeting) return;
    setMessages([{ role: 'assistant', ...greeting }]);
  }, [scenario, chatLevel]);

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
      level: chatLevel,
      vocab,
      sparse,
      interestHints,
    });

    const history = messages.slice(1).map((m) => ({
      role: m.role,
      content: m.role === 'user' ? m.de : JSON.stringify({ de: m.de, ipa: m.ipa, en: m.en }),
    }));

    try {
      const raw = await callClaude(systemPrompt, text, history, {
        routingContext: {
          taskType: 'chat',
          userTier: userTierOf(user),
          preferredModel: sanitizePreferredModel(preferredModel),
        },
        level: chatLevel,
        vocab,
      });
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      const reply = { role: 'assistant', de: parsed.de, ipa: parsed.ipa, en: parsed.en };
      setMessages((m) => {
        const next = [...m];
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].role === 'user') {
            next[i] = {
              ...next[i],
              graded: true,
              correction: parsed.correction || null,
            };
            break;
          }
        }
        next.push(reply);
        return next;
      });
      recordEvent('chat', chatLevel, parsed.correction ? 'wrong' : 'correct');
      if (parsed.taskComplete) {
        const nextIdx = (taskIdx + 1) % Math.max(tasks.length, 1);
        if (nextIdx === 0) setTasksCompleted(true);
        setTaskIdx(nextIdx);
        setHintVisible(false);
      }
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

  const modelPicker = (
    <ModelPicker
      value={preferredModel}
      onChange={onPreferredModelChange}
      userTier={userTierOf(user)}
      compact
    />
  );

  return (
    <>
      {welcomeVisible && <WelcomeBanner mobile={mobile} onDismiss={dismissWelcome} />}
      <div
        style={{
          display: 'grid',
          // minmax(0, …) rather than a bare 1fr: 1fr keeps min-width auto, so
          // the track refused to shrink below its content and pushed the page
          // 190px past a 375px viewport.
          // Two columns (220 + conversation) wait for `bp.wide` rather than
          // `!mobile`: 640–719 used to paint a three-column chat sideways.
          gridTemplateColumns: wide ? '220px minmax(0, 1fr)' : 'minmax(0, 1fr)',
          gap: mobile ? 16 : 24,
          minHeight: mobile ? 'auto' : 'calc(100vh - 280px)',
        }}
      >
        <aside style={{ minWidth: 0 }}>
          <ScenarioPicker
            scenario={scenario}
            setScenario={setScenario}
            mobile={mobile}
            level={chatLevel}
            scenarios={visibleScenarios}
          />

          {currentTask && (
            <TaskPanel
              currentTask={currentTask}
              taskIdx={taskIdx}
              tasksCompleted={tasksCompleted}
              hintVisible={hintVisible}
              setHintVisible={setHintVisible}
              compact={stacked}
              level={chatLevel}
              onResetTasks={() => {
                setTasksCompleted(false);
                setTaskIdx(0);
              }}
            />
          )}

          {!stacked && (
            <div style={{ marginTop: SPACE[5] }}>
              <div
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: FONT_SIZE.tag,
                  letterSpacing: LETTER_SPACING.caps,
                  textTransform: 'uppercase',
                  color: COLORS.mute,
                  marginBottom: SPACE[3],
                }}
              >
                Modell
              </div>
              {modelPicker}
            </div>
          )}
        </aside>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            borderRadius: RADIUS.lg,
            overflow: 'hidden',
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            minWidth: 0,
          }}
        >
          <MessageList
            messages={messages}
            thinking={thinking}
            endRef={messagesEndRef}
            compact={mobile}
          />

          <ChatInput
            input={input}
            setInput={setInput}
            listening={listening}
            thinking={thinking}
            onSend={sendMessage}
            onStartListening={startListening}
            onStopListening={stopListening}
          />
          <div
            style={{
              padding: `0 ${SPACE[4]}px ${SPACE[3]}px`,
              background: COLORS.paperDeep,
              fontFamily: FONT_BODY,
              fontSize: FONT_SIZE.sm,
              fontStyle: 'italic',
              color: COLORS.mute,
            }}
          >
            {activePack.prompts.persona} corrects as you go.
          </div>
        </div>

        {stacked && (
          <details style={{ minWidth: 0 }}>
            <summary
              style={{
                fontFamily: FONT_MONO,
                fontSize: FONT_SIZE.tag,
                letterSpacing: LETTER_SPACING.caps,
                textTransform: 'uppercase',
                color: COLORS.mute,
                cursor: 'pointer',
              }}
            >
              Modell
            </summary>
            <div style={{ marginTop: SPACE[3] }}>{modelPicker}</div>
          </details>
        )}
      </div>
    </>
  );
}
