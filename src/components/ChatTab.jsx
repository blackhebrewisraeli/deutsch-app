import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, Check, ArrowRight } from 'lucide-react';
import {
  COLORS,
  FONT_DISPLAY,
  FONT_MONO,
  FONT_BODY,
  FONTS,
  FONT_SIZE,
  LETTER_SPACING,
  SPACE,
  BORDER,
} from '../lib/theme';
import { speak } from '../lib/speech';
import { callClaude } from '../lib/claude';
import { SCENARIOS, CHAT_TASKS } from '../data/content';
import { recordEvent } from '../lib/stats';
import { SectionLabel } from './UI';

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
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: mobile ? '1fr' : '280px 1fr 320px',
        gap: mobile ? 16 : 24,
        minHeight: mobile ? 'auto' : 'calc(100vh - 280px)',
      }}
    >
      <aside>
        <SectionLabel num="A" text="Scenario" />
        <div
          style={{
            display: 'flex',
            flexDirection: mobile ? 'row' : 'column',
            gap: 0,
            border: `2px solid ${COLORS.ink}`,
            overflowX: mobile ? 'auto' : 'visible',
          }}
        >
          {SCENARIOS.map((s) => {
            const active = scenario === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setScenario(s.id)}
                style={{
                  padding: mobile ? '10px 14px' : 16,
                  background: active ? COLORS.ink : COLORS.paper,
                  color: active ? COLORS.paper : COLORS.ink,
                  border: 'none',
                  borderBottom: mobile ? 'none' : `2px solid ${COLORS.ink}`,
                  borderRight: mobile ? `2px solid ${COLORS.ink}` : 'none',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: mobile ? 8 : 14,
                  transition: 'all 0.15s',
                  flexShrink: mobile ? 0 : 1,
                  whiteSpace: mobile ? 'nowrap' : 'normal',
                }}
              >
                <span style={{ fontSize: mobile ? 16 : 20 }}>{s.icon}</span>
                <div>
                  <div
                    style={{
                      fontFamily: FONT_DISPLAY,
                      fontWeight: 600,
                      fontSize: mobile ? 14 : 16,
                    }}
                  >
                    {s.name}
                  </div>
                  {!mobile && (
                    <div
                      style={{
                        fontFamily: FONT_MONO,
                        fontSize: 9,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        opacity: 0.7,
                      }}
                    >
                      {s.desc}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {currentTask && (
          <div style={{ marginTop: SPACE[5] }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: SPACE[2],
                marginBottom: SPACE[3],
              }}
            >
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: FONT_SIZE.ipa,
                  letterSpacing: LETTER_SPACING.wider,
                  background: COLORS.red,
                  color: COLORS.paper,
                  padding: `2px ${SPACE[2]}px`,
                }}
              >
                C
              </span>
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: FONT_SIZE.tag,
                  letterSpacing: LETTER_SPACING.ultra,
                  textTransform: 'uppercase',
                  color: COLORS.mute,
                }}
              >
                Your Task
              </span>
            </div>
            {tasksCompleted ? (
              <div
                style={{
                  border: BORDER.standard,
                  background: COLORS.gold,
                  color: COLORS.ink,
                  padding: SPACE[4],
                }}
              >
                <div
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: FONT_SIZE.tag,
                    letterSpacing: LETTER_SPACING.caps,
                    marginBottom: SPACE[2],
                  }}
                >
                  ✓ ALL TASKS DONE
                </div>
                <div
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: FONT_SIZE.base,
                    fontStyle: 'italic',
                    marginBottom: SPACE[3],
                  }}
                >
                  Great work! Tasks are cycling from the start.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTasksCompleted(false);
                    setTaskIdx(0);
                  }}
                  style={{
                    background: 'transparent',
                    border: `1px solid ${COLORS.ink}`,
                    fontFamily: FONTS.mono,
                    fontSize: FONT_SIZE.tag,
                    letterSpacing: LETTER_SPACING.wider,
                    padding: `${SPACE[1]}px ${SPACE[3]}px`,
                    cursor: 'pointer',
                  }}
                >
                  CONTINUE
                </button>
              </div>
            ) : (
              <div
                style={{
                  border: BORDER.standard,
                  background: COLORS.red,
                  color: COLORS.paper,
                  padding: SPACE[4],
                }}
              >
                <div
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: FONT_SIZE.tag,
                    letterSpacing: LETTER_SPACING.caps,
                    opacity: 0.8,
                    marginBottom: SPACE[2],
                  }}
                >
                  TASK {taskIdx + 1}
                </div>
                <div
                  style={{
                    fontFamily: FONT_BODY,
                    fontSize: FONT_SIZE.base,
                    lineHeight: 1.6,
                    fontStyle: 'italic',
                    marginBottom: currentTask.hint ? SPACE[3] : 0,
                  }}
                >
                  {currentTask.task}
                </div>
                {currentTask.hint && (
                  <>
                    <button
                      type="button"
                      onClick={() => setHintVisible((v) => !v)}
                      style={{
                        background: 'transparent',
                        border: `1px solid ${COLORS.paper}60`,
                        color: COLORS.paper,
                        fontFamily: FONTS.mono,
                        fontSize: FONT_SIZE.tag,
                        letterSpacing: LETTER_SPACING.wider,
                        padding: `${SPACE[1]}px ${SPACE[3]}px`,
                        cursor: 'pointer',
                      }}
                    >
                      {hintVisible ? 'HIDE HINT' : 'SHOW HINT'}
                    </button>
                    {hintVisible && (
                      <div
                        style={{
                          marginTop: SPACE[3],
                          borderTop: `1px dashed ${COLORS.paper}50`,
                          paddingTop: SPACE[3],
                          fontFamily: FONTS.mono,
                          fontSize: FONT_SIZE.sm,
                          opacity: 0.9,
                        }}
                      >
                        {currentTask.hint}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <div
          style={{
            marginTop: 24,
            padding: 16,
            background: COLORS.paperDeep,
            border: `2px solid ${COLORS.ink}`,
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
          border: `2px solid ${COLORS.ink}`,
          background: COLORS.paper,
        }}
      >
        <div
          style={{
            flex: 1,
            padding: 24,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            maxHeight: 'calc(100vh - 400px)',
          }}
        >
          {messages.map((m, i) => (
            <MessageBubble key={i} msg={m} />
          ))}
          {thinking && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: COLORS.mute,
                fontFamily: FONT_MONO,
                fontSize: 12,
              }}
            >
              <span>Anna tippt</span>
              <span style={{ animation: 'blink 1.4s infinite' }}>●</span>
              <span style={{ animation: 'blink 1.4s infinite 0.2s' }}>●</span>
              <span style={{ animation: 'blink 1.4s infinite 0.4s' }}>●</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div
          style={{
            borderTop: `2px solid ${COLORS.ink}`,
            padding: 16,
            display: 'flex',
            gap: 12,
            background: COLORS.paperDeep,
          }}
        >
          <button
            onClick={listening ? stopListening : startListening}
            style={{
              width: 56,
              height: 56,
              background: listening ? COLORS.red : COLORS.ink,
              color: COLORS.paper,
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: listening ? 'pulse-red 1.2s infinite' : 'none',
              flexShrink: 0,
            }}
          >
            {listening ? <MicOff size={22} /> : <Mic size={22} />}
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder={listening ? 'Sprich auf Deutsch...' : 'Schreib auf Deutsch...'}
            style={{
              flex: 1,
              background: COLORS.paper,
              border: `2px solid ${COLORS.ink}`,
              padding: '0 16px',
              fontFamily: FONT_BODY,
              fontSize: 16,
              outline: 'none',
              color: COLORS.ink,
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || thinking}
            style={{
              padding: '0 24px',
              background: input.trim() && !thinking ? COLORS.red : COLORS.mute,
              color: COLORS.paper,
              border: 'none',
              fontFamily: FONT_MONO,
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: '0.15em',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            SEND <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Correction panel — hidden on mobile when empty */}
      <aside style={{ display: mobile && !correction ? 'none' : 'block' }}>
        <SectionLabel num="B" text="Correction" />
        <div
          style={{
            border: `2px solid ${COLORS.ink}`,
            background: correction ? COLORS.red : COLORS.paper,
            color: correction ? COLORS.paper : COLORS.ink,
            minHeight: 240,
            padding: 20,
            transition: 'all 0.3s',
          }}
        >
          {correction ? (
            <div className="slide-up">
              <div
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 10,
                  letterSpacing: '0.2em',
                  opacity: 0.8,
                  marginBottom: 16,
                }}
              >
                ⚠ NEEDS A FIX
              </div>
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 9,
                    letterSpacing: '0.15em',
                    opacity: 0.7,
                    marginBottom: 4,
                  }}
                >
                  YOU SAID
                </div>
                <div
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontSize: 18,
                    textDecoration: 'line-through',
                    opacity: 0.85,
                  }}
                >
                  {correction.original}
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 9,
                    letterSpacing: '0.15em',
                    opacity: 0.7,
                    marginBottom: 4,
                  }}
                >
                  CORRECT
                </div>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600 }}>
                  {correction.fixed}
                </div>
                <button
                  onClick={() => speak(correction.fixed)}
                  style={{
                    marginTop: 8,
                    background: 'transparent',
                    border: `1px solid ${COLORS.paper}`,
                    color: COLORS.paper,
                    padding: '4px 10px',
                    fontFamily: FONT_MONO,
                    fontSize: 10,
                    letterSpacing: '0.1em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Volume2 size={12} /> HEAR IT
                </button>
              </div>
              <div
                style={{
                  borderTop: `1px dashed ${COLORS.paper}80`,
                  paddingTop: 12,
                  fontFamily: FONT_BODY,
                  fontSize: 13,
                  lineHeight: 1.5,
                  fontStyle: 'italic',
                }}
              >
                {correction.explain}
              </div>
            </div>
          ) : (
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                minHeight: 200,
              }}
            >
              <Check size={32} style={{ color: COLORS.mute, marginBottom: 12 }} />
              <div
                style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 500, marginBottom: 4 }}
              >
                Alles gut!
              </div>
              <div
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 10,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: COLORS.mute,
                }}
              >
                No mistakes to fix
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div
      className="slide-up"
      style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}
    >
      <div style={{ maxWidth: '78%' }}>
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            letterSpacing: '0.2em',
            color: COLORS.mute,
            marginBottom: 6,
            textAlign: isUser ? 'right' : 'left',
          }}
        >
          {isUser ? 'DU' : '— ANNA'}
        </div>
        <div
          style={{
            padding: '14px 18px',
            background: isUser ? COLORS.ink : COLORS.gold,
            color: COLORS.ink,
            border: `2px solid ${COLORS.ink}`,
          }}
        >
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 20,
              fontWeight: 500,
              lineHeight: 1.3,
              marginBottom: msg.ipa ? 6 : 0,
            }}
          >
            {msg.de}
            {!isUser && (
              <button
                onClick={() => speak(msg.de)}
                style={{
                  marginLeft: 10,
                  background: 'transparent',
                  border: 'none',
                  color: COLORS.red,
                  cursor: 'pointer',
                  verticalAlign: 'middle',
                }}
              >
                <Volume2 size={16} />
              </button>
            )}
          </div>
          {msg.ipa && (
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, opacity: 0.7, marginBottom: 4 }}>
              {msg.ipa}
            </div>
          )}
          {msg.en && (
            <div
              style={{
                fontFamily: FONT_BODY,
                fontStyle: 'italic',
                fontSize: 13,
                opacity: 0.75,
                borderTop: `1px solid ${isUser ? COLORS.paper + '30' : COLORS.ink + '30'}`,
                paddingTop: 6,
              }}
            >
              {msg.en}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
