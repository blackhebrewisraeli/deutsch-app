import { useState, useEffect, useRef } from 'react';
import { COLORS, FONT_MONO, FONT_BODY, RADIUS, SHADOW } from '../lib/theme';
import { speak } from '../lib/speech';
import { callClaude } from '../lib/claude';
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

export default function ChatTab({ level = 'a1', mobile = false }) {
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
    const intros = {
      free: {
        de: 'Hallo! Womit möchtest du heute üben?',
        ipa: '[ˈhalo vomɪt ˈmœçtəst duː ˈhɔɪ̯tə ˈyːbn̩]',
        en: 'Hello! What would you like to practice today?',
      },
      coffee: {
        de: 'Willkommen im Café! Was möchten Sie bestellen?',
        ipa: '[vɪlˈkɔmən ɪm kaˈfeː vas ˈmœçtən ziː bəˈʃtɛlən]',
        en: 'Welcome to the café! What would you like to order?',
      },
      meet: {
        de: 'Hallo! Ich bin Anna. Wie heißt du?',
        ipa: '[ˈhalo ɪç bɪn ˈana viː haɪ̯st duː]',
        en: "Hello! I'm Anna. What's your name?",
      },
      airport: {
        de: 'Guten Tag, willkommen am Flughafen. Wohin reisen Sie?',
        ipa: '[ˈɡuːtn̩ taːk vɪlˈkɔmən am ˈfluːkhaːfn̩ voˈhɪn ˈʁaɪ̯zn̩ ziː]',
        en: 'Good day, welcome to the airport. Where are you traveling?',
      },
    };
    setMessages([{ role: 'assistant', ...intros[scenario] }]);
    setCorrection(null);
    setTimeout(() => speak(intros[scenario].de), 400);
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

    const taskLine = currentTask
      ? `The learner's current task is: "${currentTask.task}". Stay in this scenario and guide them toward completing this task. When the task is naturally complete, include "taskComplete": true in your JSON response; otherwise omit it or set it to false.`
      : '';

    const levelInstructions =
      level === 'a1'
        ? `The learner is A1 BEGINNER. Use very simple German, short sentences, common vocabulary only. Always provide English translation. Use lots of encouragement.`
        : level === 'a2'
          ? `The learner is A2 ELEMENTARY. Use natural but simple German. Provide English translation. Gently push them.`
          : `The learner is B1 INTERMEDIATE. Use natural German, moderate complexity. Provide English translation but challenge them.`;

    const systemPrompt = `You are a friendly German tutor named Anna for a language learner. The current scenario is: ${scenarioDesc}. ${taskLine}

${levelInstructions}

You MUST always respond with strict JSON only (no markdown, no extra text):
{
  "de": "your reply in German (1-2 sentences)",
  "ipa": "IPA pronunciation of the German",
  "en": "English translation",
  "correction": null OR { "original": "what they said", "fixed": "corrected German", "explain": "brief friendly explanation in English" },
  "taskComplete": false
}

Stay in the scenario. Only provide 'correction' if the user made a real grammar/vocabulary mistake.`;

    const history = messages.slice(1).map((m) => ({
      role: m.role,
      content: m.role === 'user' ? m.de : JSON.stringify({ de: m.de, ipa: m.ipa, en: m.en }),
    }));

    try {
      const raw = await callClaude(systemPrompt, text, history);
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
          gridTemplateColumns: mobile ? '1fr' : '280px 1fr 320px',
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
              Click the mic and speak German. Anna corrects your mistakes — don&apos;t worry about
              perfection.
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
            background: COLORS.paper,
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
