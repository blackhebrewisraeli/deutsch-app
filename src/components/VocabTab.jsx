import { useState, useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import {
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  SPACE,
  BUTTON,
  RADIUS,
  SHADOW,
} from '../lib/theme';
import { callClaude } from '../lib/claude';
import { loadState } from '../lib/storage';
import { activePack } from '../packs';
const { decks: PRESET_DECKS } = activePack.content;
import { Hero, SectionLabel } from './UI';
import { shuffle } from '../lib/utils';
import { fuzzyMatch } from '../lib/matching';
import { recordEvent, recordItem } from '../lib/stats';
import { getDueCards, recordVocabAnswer } from '../lib/srs';
import Confetti from './ui/Confetti';

export default function VocabTab({
  level,
  learnedWords,
  markLearned,
  mobile = false,
  reviewTarget = null,
  onReviewConsumed,
}) {
  const [deckId, setDeckId] = useState('greetings');
  const [customCards, setCustomCards] = useState(null);
  const [customTopic, setCustomTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const [deckComplete, setDeckComplete] = useState(false);

  const [answered, setAnswered] = useState(false);
  const [result, setResult] = useState(null); // 'correct' | 'almost' | 'wrong'
  const [typedAnswer, setTypedAnswer] = useState('');
  const [queue, setQueue] = useState([]);
  // A pending review target — when the deck-reset effect runs, it puts this
  // card first in the queue instead of starting fresh.
  const pendingReviewRef = useRef(null);

  const activeDeck = deckId === 'custom' && customCards ? customCards : PRESET_DECKS[deckId] || [];

  useEffect(() => {
    const target = pendingReviewRef.current;
    const srs = (loadState() ?? {}).srs ?? {};
    // SRS-derived queue: due first, then new, then over-review.
    let q = getDueCards(srs, activeDeck, deckId, Date.now());
    if (target) {
      const idx = activeDeck.findIndex((c) => c.id === target);
      if (idx >= 0) {
        q = [idx, ...q.filter((i) => i !== idx)];
      }
      pendingReviewRef.current = null;
    }
    setQueue(q);
    setAnswered(false);
    setResult(null);
    setTypedAnswer('');
    setDeckComplete(false);
    // activeDeck is derived from deckId+customCards which are already in deps — safe to omit
  }, [deckId, customCards, level]); // eslint-disable-line react-hooks/exhaustive-deps

  // Brief lock to swallow the trailing click event that would otherwise pass
  // through to whatever button mounts at the SRS button's screen position on
  // the next card (e.g. clicking GOOD also clicking the new card's MC option
  // at the same coordinates).
  const clickLockRef = useRef(false);

  // SRS verdict + queue advance, shared by all four buttons in the feedback panel.
  const handleSrsVerdict = (srsVerdict) => {
    if (!card || clickLockRef.current) return;
    clickLockRef.current = true;
    recordVocabAnswer(deckId, card.id, srsVerdict);
    advanceQueue(srsVerdict !== 'again');
    setTimeout(() => {
      clickLockRef.current = false;
    }, 200);
  };

  // Pick up review targets handed in from the Stats Review feed.
  useEffect(() => {
    if (!reviewTarget) return;
    pendingReviewRef.current = reviewTarget.label;

    if (deckId === reviewTarget.context) {
      // Already on the right deck — the deck-reset effect won't fire, so
      // manually re-run the same queue-with-target build here.
      const idx = activeDeck.findIndex((c) => c.id === reviewTarget.label);
      if (idx >= 0) {
        const rest = activeDeck.map((_, i) => i).filter((i) => i !== idx);
        setQueue([idx, ...rest]);
        setAnswered(false);
        setResult(null);
        setTypedAnswer('');
        pendingReviewRef.current = null;
      }
    } else {
      // Deck change — pendingReviewRef will be consumed by the deck-reset effect.
      setDeckId(reviewTarget.context);
    }

    onReviewConsumed?.();
  }, [reviewTarget, onReviewConsumed]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!typedAnswer.trim() || !card || clickLockRef.current) return;
    const { distance: dist } = fuzzyMatch(card.en, typedAnswer, activePack.validation.normalize);
    const res = dist === 0 ? 'correct' : dist <= 2 ? 'almost' : 'wrong';
    setAnswered(true);
    setResult(res);
    if (res === 'correct' || res === 'almost') markLearned(card.id);
    recordEvent('vocab', level, res);
    recordItem('vocab', deckId, card.id, card.en, res);
  };

  const generateDeck = async () => {
    if (!customTopic.trim()) return;
    setGenerating(true);
    try {
      const systemPrompt = `You generate German vocabulary flashcards for a beginner. Respond with ONLY a JSON array, no markdown, no extra text.`;
      const userMsg = `Generate exactly 10 German flashcards on the topic: "${customTopic}". Return JSON array of objects with keys: de (German word with article if noun, e.g. "der Hund"), en (English translation), ipa (IPA pronunciation in brackets like "[deːɐ̯ hʊnt]"). No other text.`;
      const raw = await callClaude(systemPrompt, userMsg, [], { endpoint: 'deck' });
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setCustomCards(parsed.map((c) => ({ ...c, id: activePack.cardId(c) })));
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
          <div
            style={{
              borderRadius: RADIUS.lg,
              boxShadow: SHADOW.card,
              overflow: 'hidden',
              marginBottom: 24,
            }}
          >
            {decks.map((d, i) => {
              const active = deckId === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDeckId(d.id)}
                  aria-pressed={active}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    background: active ? COLORS.ink : COLORS.card,
                    color: active ? COLORS.paper : COLORS.ink,
                    border: 'none',
                    borderBottom: i < decks.length - 1 ? `1px solid ${COLORS.ink}12` : 'none',
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
                type="button"
                onClick={() => setDeckId('custom')}
                aria-pressed={deckId === 'custom'}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: deckId === 'custom' ? COLORS.red : COLORS.paperDeep,
                  color: deckId === 'custom' ? COLORS.paper : COLORS.ink,
                  border: 'none',
                  borderTop: `1px solid ${COLORS.ink}12`,
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
            style={{
              borderRadius: RADIUS.lg,
              boxShadow: SHADOW.card,
              padding: 16,
              background: COLORS.paperDeep,
            }}
          >
            <input
              aria-label="Custom deck topic"
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
                border: 'none',
                borderRadius: RADIUS.md,
                boxShadow: 'inset 0 2px 5px rgba(22,17,11,0.06)',
                fontFamily: FONTS.body,
                fontSize: FONT_SIZE.md,
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
                  <Sparkles size={14} aria-hidden="true" /> GENERATE 10 CARDS
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
                <div style={{ display: 'flex', gap: 5 }}>
                  {activeDeck.map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: 26,
                        height: 8,
                        borderRadius: RADIUS.pill,
                        background: learnedWords[activeDeck[i].id] ? COLORS.green : '#e7dcae',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Deck complete banner */}
              {deckComplete && (
                <div
                  className="slide-up pop"
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    background: 'linear-gradient(90deg, #F5C518 0%, #FFE44D 50%, #F5C518 100%)',
                    backgroundSize: '200% auto',
                    animation: 'shimmer 2s linear infinite',
                    borderRadius: RADIUS.lg,
                    boxShadow: SHADOW.card,
                    padding: '16px 20px',
                    marginBottom: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Confetti />
                  <span
                    style={{
                      fontFamily: FONTS.display,
                      fontSize: FONT_SIZE.xl,
                      fontWeight: FONT_WEIGHT.bold,
                      color: COLORS.ink,
                    }}
                  >
                    🎉 Deck complete — {activeDeck.filter((c) => learnedWords[c.id]).length} words
                    learned
                  </span>
                  <button
                    type="button"
                    onClick={() => setDeckComplete(false)}
                    style={{
                      background: 'transparent',
                      border: `1px solid ${COLORS.ink}`,
                      borderRadius: RADIUS.sm,
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
                  borderRadius: RADIUS.xl,
                  boxShadow: SHADOW.cardChunk,
                  background: COLORS.card,
                  minHeight: 200,
                  padding: SPACE[12],
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  marginBottom: SPACE[5],
                  position: 'relative',
                }}
              >
                {learnedWords[card.id] && (
                  <div
                    style={{
                      position: 'absolute',
                      top: SPACE[3],
                      left: SPACE[3],
                      background: COLORS.green,
                      color: COLORS.paper,
                      padding: '4px 10px',
                      borderRadius: RADIUS.pill,
                      fontFamily: FONTS.mono,
                      fontSize: FONT_SIZE.tag,
                      letterSpacing: LETTER_SPACING.widest,
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
                          if (clickLockRef.current) return; // swallow phantom clicks during transition
                          const correct = choice === card.en;
                          const verdict = correct ? 'correct' : 'wrong';
                          setAnswered(true);
                          setResult(verdict);
                          if (correct) markLearned(card.id);
                          recordEvent('vocab', level, verdict);
                          recordItem('vocab', deckId, card.id, card.en, verdict);
                        }}
                        style={{
                          ...BUTTON.tile,
                          padding: SPACE[4],
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
                      aria-label="Type the English meaning"
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
                        border: 'none',
                        borderRadius: RADIUS.md,
                        boxShadow: 'inset 0 2px 5px rgba(22,17,11,0.06)',
                        fontFamily: FONTS.display,
                        fontSize: FONT_SIZE.xl,
                        background: COLORS.card,
                        marginBottom: SPACE[3],
                        color: COLORS.ink,
                      }}
                    />
                    <button
                      type="button"
                      onClick={submitTyped}
                      disabled={!typedAnswer.trim()}
                      style={{
                        ...BUTTON.go,
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
                  className={result === 'wrong' ? 'wiggle' : 'pop'}
                  style={{
                    borderRadius: RADIUS.lg,
                    boxShadow: SHADOW.card,
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
                  {result === 'wrong' ? (
                    <button
                      type="button"
                      onClick={() => handleSrsVerdict('again')}
                      style={{ ...BUTTON.primary, width: '100%' }}
                    >
                      AGAIN — REVIEW SOON →
                    </button>
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr',
                        gap: SPACE[2],
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleSrsVerdict('hard')}
                        style={{ ...BUTTON.tile }}
                      >
                        HARD
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSrsVerdict('good')}
                        style={{ ...BUTTON.primary }}
                      >
                        GOOD
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSrsVerdict('easy')}
                        style={{ ...BUTTON.go }}
                      >
                        EASY
                      </button>
                    </div>
                  )}
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
