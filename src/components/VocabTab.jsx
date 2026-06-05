import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import {
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  SPACE,
  BORDER,
  BUTTON,
} from '../lib/theme';
import { callClaude } from '../lib/claude';
import { PRESET_DECKS } from '../data/content';
import { Hero, SectionLabel } from './UI';
import { shuffle, levenshtein } from '../lib/utils';
import { recordEvent } from '../lib/stats';

export default function VocabTab({ level, learnedWords, markLearned, mobile = false }) {
  const [deckId, setDeckId] = useState('greetings');
  const [customCards, setCustomCards] = useState(null);
  const [customTopic, setCustomTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const [deckComplete, setDeckComplete] = useState(false);

  const [answered, setAnswered] = useState(false);
  const [result, setResult] = useState(null); // 'correct' | 'almost' | 'wrong'
  const [typedAnswer, setTypedAnswer] = useState('');
  const [queue, setQueue] = useState([]);

  const activeDeck = deckId === 'custom' && customCards ? customCards : PRESET_DECKS[deckId] || [];

  useEffect(() => {
    setQueue(activeDeck.map((_, i) => i));
    setAnswered(false);
    setResult(null);
    setTypedAnswer('');
    setDeckComplete(false);
    // activeDeck is derived from deckId+customCards which are already in deps — safe to omit
  }, [deckId, customCards, level]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentIdx = queue[0] ?? null;
  const card = currentIdx !== null ? activeDeck[currentIdx] : null;

  const getChoices = (deck, cardIdx) => {
    const correct = deck[cardIdx].en;
    const others = shuffle(deck.filter((_, i) => i !== cardIdx).map((c) => c.en));
    return shuffle([correct, ...others.slice(0, 3)]);
  };

  const advanceQueue = (wasCorrect) => {
    setAnswered(false);
    setResult(null);
    setTypedAnswer('');
    setQueue((prev) => {
      const [, ...rest] = prev;
      const next = wasCorrect ? rest : [...rest, prev[0]];
      if (wasCorrect && rest.length === 0) setDeckComplete(true);
      return next;
    });
  };

  const submitTyped = () => {
    if (!typedAnswer.trim() || !card) return;
    const dist = levenshtein(typedAnswer.trim(), card.en);
    const res = dist === 0 ? 'correct' : dist <= 2 ? 'almost' : 'wrong';
    setAnswered(true);
    setResult(res);
    if (res === 'correct' || res === 'almost') markLearned(card.de);
    recordEvent('vocab', level, res);
  };

  const generateDeck = async () => {
    if (!customTopic.trim()) return;
    setGenerating(true);
    try {
      const systemPrompt = `You generate German vocabulary flashcards for a beginner. Respond with ONLY a JSON array, no markdown, no extra text.`;
      const userMsg = `Generate exactly 10 German flashcards on the topic: "${customTopic}". Return JSON array of objects with keys: de (German word with article if noun, e.g. "der Hund"), en (English translation), ipa (IPA pronunciation in brackets like "[deːɐ̯ hʊnt]"). No other text.`;
      const raw = await callClaude(systemPrompt, userMsg);
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setCustomCards(parsed);
        setDeckId('custom');
      }
    } catch (err) {
      alert('Could not generate deck — ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const decks = [
    { id: 'greetings', name: 'Greetings', count: 10 },
    { id: 'food', name: 'Food & Drink', count: 10 },
    { id: 'travel', name: 'Travel', count: 10 },
    { id: 'numbers', name: 'Numbers', count: 10 },
  ];

  return (
    <div>
      <Hero
        kicker="Section 03"
        title="Wortschatz"
        sub="Flip, listen, learn. Pick a preset or generate a deck on any topic."
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: mobile ? '1fr' : '320px 1fr',
          gap: mobile ? 16 : 32,
          marginTop: 32,
        }}
      >
        {/* ── Left column: deck selector + generate ── */}
        <div>
          <SectionLabel num="A" text="Preset Decks" />
          <div style={{ border: `2px solid ${COLORS.ink}`, marginBottom: 24 }}>
            {decks.map((d, i) => {
              const active = deckId === d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => setDeckId(d.id)}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    background: active ? COLORS.ink : COLORS.paper,
                    color: active ? COLORS.paper : COLORS.ink,
                    border: 'none',
                    borderBottom: i < decks.length - 1 ? `2px solid ${COLORS.ink}` : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontFamily: FONTS.display,
                    fontSize: FONT_SIZE.lg,
                    fontWeight: FONT_WEIGHT.semibold,
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span>{d.name}</span>
                  <span style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.ipa, opacity: 0.6 }}>
                    {d.count} cards
                  </span>
                </button>
              );
            })}
            {customCards && (
              <button
                onClick={() => setDeckId('custom')}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: deckId === 'custom' ? COLORS.red : COLORS.paperDeep,
                  color: deckId === 'custom' ? COLORS.paper : COLORS.ink,
                  border: 'none',
                  borderTop: `2px solid ${COLORS.ink}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontFamily: FONTS.display,
                  fontSize: FONT_SIZE.lg,
                  fontWeight: FONT_WEIGHT.semibold,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span>✦ Your Deck</span>
                <span style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.ipa, opacity: 0.7 }}>
                  {customCards.length} cards
                </span>
              </button>
            )}
          </div>

          <SectionLabel num="B" text="Generate Custom" />
          <div
            style={{ border: `2px solid ${COLORS.ink}`, padding: 16, background: COLORS.paperDeep }}
          >
            <input
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && generateDeck()}
              placeholder="e.g. weather, animals, sports"
              disabled={generating}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: 12,
                background: COLORS.card,
                border: `2px solid ${COLORS.ink}`,
                fontFamily: FONTS.body,
                fontSize: FONT_SIZE.md,
                outline: 'none',
                marginBottom: 12,
                color: COLORS.ink,
              }}
            />
            <button
              onClick={generateDeck}
              disabled={generating || !customTopic.trim()}
              style={{
                width: '100%',
                padding: 14,
                background: generating ? COLORS.mute : COLORS.red,
                color: COLORS.card,
                border: 'none',
                fontFamily: FONTS.mono,
                fontWeight: FONT_WEIGHT.bold,
                fontSize: FONT_SIZE.sm,
                letterSpacing: LETTER_SPACING.widest,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: generating ? 'not-allowed' : 'pointer',
              }}
            >
              {generating ? (
                'GENERATING...'
              ) : (
                <>
                  <Sparkles size={14} /> GENERATE 10 CARDS
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Right column: active recall UI ── */}
        <div>
          {card && (
            <>
              {/* Progress bar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: SPACE[4],
                }}
              >
                <div
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: FONT_SIZE.tag,
                    letterSpacing: LETTER_SPACING.caps,
                    color: COLORS.mute,
                  }}
                >
                  {queue.length} card{queue.length !== 1 ? 's' : ''} remaining
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {activeDeck.map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: 24,
                        height: 4,
                        background: learnedWords[activeDeck[i].de] ? COLORS.ink : COLORS.paperDeep,
                        border: `1px solid ${COLORS.ink}20`,
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Deck complete banner */}
              {deckComplete && (
                <div
                  className="slide-up"
                  style={{
                    background: 'linear-gradient(90deg, #F5C518 0%, #FFE44D 50%, #F5C518 100%)',
                    backgroundSize: '200% auto',
                    animation: 'shimmer 2s linear infinite',
                    border: `2px solid ${COLORS.ink}`,
                    padding: '14px 20px',
                    marginBottom: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span
                    style={{
                      fontFamily: FONTS.display,
                      fontSize: FONT_SIZE.xl,
                      fontWeight: FONT_WEIGHT.bold,
                      color: COLORS.ink,
                    }}
                  >
                    ✓ Deck complete — {activeDeck.filter((c) => learnedWords[c.de]).length} words
                    learned
                  </span>
                  <button
                    type="button"
                    onClick={() => setDeckComplete(false)}
                    style={{
                      background: 'transparent',
                      border: `1px solid ${COLORS.ink}`,
                      fontFamily: FONTS.mono,
                      fontSize: FONT_SIZE.tag,
                      letterSpacing: LETTER_SPACING.widest,
                      padding: '4px 10px',
                      cursor: 'pointer',
                      color: COLORS.ink,
                    }}
                  >
                    DISMISS
                  </button>
                </div>
              )}

              {/* Card face — always shows German */}
              <div
                style={{
                  border: BORDER.standard,
                  background: COLORS.card,
                  minHeight: 200,
                  padding: SPACE[12],
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  marginBottom: SPACE[4],
                  position: 'relative',
                }}
              >
                {learnedWords[card.de] && (
                  <div
                    style={{
                      position: 'absolute',
                      background: COLORS.red,
                      color: COLORS.card,
                      padding: '4px 10px',
                      fontFamily: FONTS.mono,
                      fontSize: FONT_SIZE.tag,
                      letterSpacing: LETTER_SPACING.widest,
                      alignSelf: 'flex-start',
                      marginBottom: 'auto',
                    }}
                  >
                    ✓ LEARNED
                  </div>
                )}
                <div
                  style={{
                    fontFamily: FONTS.display,
                    fontSize: FONT_SIZE['6xl'],
                    fontWeight: FONT_WEIGHT.bold,
                    letterSpacing: LETTER_SPACING.tight,
                    marginBottom: SPACE[4],
                  }}
                >
                  {card.de}
                </div>
                {card.ipa && (
                  <div style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.ipa, opacity: 0.6 }}>
                    {card.ipa}
                  </div>
                )}
              </div>

              {/* A1/A2 — multiple choice */}
              {(level === 'a1' || level === 'a2') &&
                !answered &&
                currentIdx !== null &&
                activeDeck.length >= 4 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACE[3] }}>
                    {getChoices(activeDeck, currentIdx).map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => {
                          const correct = choice === card.en;
                          setAnswered(true);
                          setResult(correct ? 'correct' : 'wrong');
                          if (correct) markLearned(card.de);
                          recordEvent('vocab', level, correct ? 'correct' : 'wrong');
                        }}
                        style={{
                          padding: SPACE[4],
                          border: BORDER.standard,
                          background: COLORS.paper,
                          color: COLORS.ink,
                          fontFamily: FONTS.body,
                          fontSize: FONT_SIZE.lg,
                          fontStyle: 'italic',
                          cursor: 'pointer',
                        }}
                      >
                        {choice}
                      </button>
                    ))}
                  </div>
                )}

              {/* B1 — type the meaning */}
              {(level === 'b1' || ((level === 'a1' || level === 'a2') && activeDeck.length < 4)) &&
                !answered && (
                  <div>
                    <input
                      type="text"
                      value={typedAnswer}
                      onChange={(e) => setTypedAnswer(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitTyped();
                      }}
                      placeholder="Type the English meaning…"
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: SPACE[4],
                        border: BORDER.standard,
                        fontFamily: FONTS.display,
                        fontSize: FONT_SIZE.xl,
                        background: COLORS.card,
                        outline: 'none',
                        marginBottom: SPACE[3],
                        color: COLORS.ink,
                      }}
                    />
                    <button
                      type="button"
                      onClick={submitTyped}
                      disabled={!typedAnswer.trim()}
                      style={{
                        ...BUTTON.danger,
                        width: '100%',
                        opacity: typedAnswer.trim() ? 1 : 0.4,
                      }}
                    >
                      CHECK →
                    </button>
                  </div>
                )}

              {/* Feedback after answering */}
              {answered && (
                <div
                  style={{
                    border: BORDER.standard,
                    background:
                      result === 'correct'
                        ? COLORS.gold
                        : result === 'almost'
                          ? COLORS.paperDeep
                          : COLORS.red,
                    color:
                      result === 'correct'
                        ? COLORS.ink
                        : result === 'almost'
                          ? COLORS.ink
                          : COLORS.paper,
                    padding: SPACE[4],
                    marginTop: SPACE[3],
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
                    {result === 'correct'
                      ? '✓ CORRECT'
                      : result === 'almost'
                        ? '≈ ALMOST — CHECK SPELLING'
                        : '✗ NOT QUITE'}
                  </div>
                  <div
                    style={{
                      fontFamily: FONTS.display,
                      fontSize: FONT_SIZE.xl,
                      fontWeight: FONT_WEIGHT.semibold,
                      marginBottom: SPACE[3],
                    }}
                  >
                    {card.en}
                  </div>
                  <button
                    type="button"
                    onClick={() => advanceQueue(result === 'correct' || result === 'almost')}
                    style={{ ...BUTTON.primary }}
                  >
                    {result === 'wrong' ? 'TRY AGAIN LATER →' : 'NEXT CARD →'}
                  </button>
                </div>
              )}
            </>
          )}
          {!card && !deckComplete && (
            <div
              style={{
                padding: SPACE[8],
                textAlign: 'center',
                fontFamily: FONTS.mono,
                fontSize: FONT_SIZE.base,
                color: COLORS.mute,
              }}
            >
              Select a deck to start.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
