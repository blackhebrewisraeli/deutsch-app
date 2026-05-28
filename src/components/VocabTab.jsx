import { useState, useEffect } from 'react';
import { Volume2, Check, X, Sparkles } from 'lucide-react';
import { COLORS, FONT_DISPLAY, FONT_MONO, FONT_BODY } from '../lib/theme';
import { speak } from '../lib/speech';
import { callClaude } from '../lib/claude';
import { PRESET_DECKS } from '../data/content';
import { Hero, SectionLabel, btnSecondary } from './UI';

export default function VocabTab({ learnedWords, markLearned }) {
  const [deckId, setDeckId] = useState('greetings');
  const [customCards, setCustomCards] = useState(null);
  const [customTopic, setCustomTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const activeDeck = deckId === 'custom' && customCards ? customCards : PRESET_DECKS[deckId] || [];
  const card = activeDeck[cardIdx];

  useEffect(() => {
    setCardIdx(0);
    setFlipped(false);
  }, [deckId, customCards]);

  const next = () => {
    setFlipped(false);
    setTimeout(() => setCardIdx((i) => (i + 1) % activeDeck.length), 150);
  };
  const prev = () => {
    setFlipped(false);
    setTimeout(() => setCardIdx((i) => (i - 1 + activeDeck.length) % activeDeck.length), 150);
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
      <Hero kicker="Section 03" title="Wortschatz" sub="Flip, listen, learn. Pick a preset or generate a deck on any topic." />

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 32, marginTop: 32 }}>
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
                    fontFamily: FONT_DISPLAY,
                    fontSize: 16,
                    fontWeight: 600,
                    textAlign: 'left',
                  }}
                >
                  <span>{d.name}</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 11, opacity: 0.6 }}>{d.count} cards</span>
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
                  fontFamily: FONT_DISPLAY,
                  fontSize: 16,
                  fontWeight: 600,
                  textAlign: 'left',
                }}
              >
                <span>✦ Your Deck</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 11, opacity: 0.7 }}>{customCards.length} cards</span>
              </button>
            )}
          </div>

          <SectionLabel num="B" text="Generate Custom" />
          <div style={{ border: `2px solid ${COLORS.ink}`, padding: 16, background: COLORS.paperDeep }}>
            <input
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && generateDeck()}
              placeholder="e.g. weather, animals, sports"
              disabled={generating}
              style={{
                width: '100%',
                padding: 12,
                background: COLORS.paper,
                border: `2px solid ${COLORS.ink}`,
                fontFamily: FONT_BODY,
                fontSize: 15,
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
                color: COLORS.paper,
                border: 'none',
                fontFamily: FONT_MONO,
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: '0.15em',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {generating ? 'GENERATING...' : <><Sparkles size={14} /> GENERATE 10 CARDS</>}
            </button>
          </div>
        </div>

        <div>
          {card && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '0.2em', color: COLORS.mute, textTransform: 'uppercase' }}>
                  Card {cardIdx + 1} / {activeDeck.length}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {activeDeck.map((_, i) => (
                    <div key={i} style={{
                      width: 24, height: 4,
                      background: i === cardIdx ? COLORS.red : (learnedWords[activeDeck[i].de] ? COLORS.ink : COLORS.paperDeep),
                    }} />
                  ))}
                </div>
              </div>

              <div
                onClick={() => setFlipped((f) => !f)}
                style={{
                  border: `2px solid ${COLORS.ink}`,
                  background: flipped ? COLORS.ink : COLORS.paper,
                  color: flipped ? COLORS.paper : COLORS.ink,
                  minHeight: 360,
                  padding: 48,
                  cursor: 'pointer',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: 20, right: 20,
                  fontFamily: FONT_MONO,
                  fontSize: 10,
                  letterSpacing: '0.2em',
                  opacity: 0.5,
                }}>
                  {flipped ? 'ENGLISH' : 'DEUTSCH'} · TAP TO FLIP
                </div>
                {learnedWords[card.de] && (
                  <div style={{
                    position: 'absolute',
                    top: 20, left: 20,
                    background: COLORS.red,
                    color: COLORS.paper,
                    padding: '4px 10px',
                    fontFamily: FONT_MONO,
                    fontSize: 10,
                    letterSpacing: '0.15em',
                  }}>✓ LEARNED</div>
                )}

                {flipped ? (
                  <div className="slide-up">
                    <div style={{ fontFamily: FONT_DISPLAY, fontSize: 64, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                      {card.en}
                    </div>
                  </div>
                ) : (
                  <div className="slide-up">
                    <div style={{ fontFamily: FONT_DISPLAY, fontSize: 64, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 16 }}>
                      {card.de}
                    </div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: 16, opacity: 0.65 }}>
                      {card.ipa}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button onClick={prev} style={btnSecondary}>← PREV</button>
                <button
                  onClick={(e) => { e.stopPropagation(); speak(card.de); }}
                  style={{ ...btnSecondary, flex: 0, padding: '14px 20px' }}
                >
                  <Volume2 size={16} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); markLearned(card.de); }}
                  style={{
                    flex: 1,
                    padding: 14,
                    background: learnedWords[card.de] ? COLORS.red : COLORS.ink,
                    color: COLORS.paper,
                    border: 'none',
                    fontFamily: FONT_MONO,
                    fontWeight: 700,
                    fontSize: 12,
                    letterSpacing: '0.15em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  {learnedWords[card.de] ? <><X size={14} /> UNMARK</> : <><Check size={14} /> MARK LEARNED</>}
                </button>
                <button onClick={next} style={btnSecondary}>NEXT →</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
