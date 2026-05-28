import { useState } from 'react';
import { Volume2, ArrowRight } from 'lucide-react';
import { COLORS, FONT_DISPLAY, FONT_MONO, FONT_BODY } from '../lib/theme';
import { speak } from '../lib/speech';
import { callClaude } from '../lib/claude';
import { Hero, SectionLabel } from './UI';

export default function TranslateTab() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const translate = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setResult(null);
    try {
      const systemPrompt = `You are a German-English translator. Respond ONLY with valid JSON, no markdown, no extra text.`;
      const userMsg = `Translate this text and provide a detailed breakdown. Auto-detect whether it's English or German.

Text: "${input}"

Return JSON in this exact shape:
{
  "sourceLang": "en" or "de",
  "german": "the German version",
  "english": "the English version",
  "ipa": "IPA pronunciation of the German",
  "words": [
    { "de": "German word", "en": "English meaning", "note": "brief grammar note like 'noun, masculine' or 'verb, 1st person singular' or 'preposition + dative'" }
  ]
}

Break down EVERY meaningful word in the German version. Keep notes brief and beginner-friendly.`;
      const raw = await callClaude(systemPrompt, userMsg);
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      setResult(parsed);
    } catch (err) {
      setResult({ error: 'Could not translate — ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Hero kicker="Section 04" title="Übersetzer" sub="Type in either language. Get the translation, pronunciation, and a word-by-word breakdown with grammar notes." />

      <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <SectionLabel num="IN" text="Your text" />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type English or German. Press Cmd/Ctrl+Enter to translate."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) translate();
            }}
            style={{
              width: '100%',
              minHeight: 200,
              padding: 20,
              background: COLORS.paper,
              border: `2px solid ${COLORS.ink}`,
              fontFamily: FONT_BODY,
              fontSize: 18,
              outline: 'none',
              resize: 'vertical',
              color: COLORS.ink,
              lineHeight: 1.5,
            }}
          />
          <button
            onClick={translate}
            disabled={loading || !input.trim()}
            style={{
              width: '100%',
              marginTop: 12,
              padding: 18,
              background: loading ? COLORS.mute : COLORS.red,
              color: COLORS.paper,
              border: 'none',
              fontFamily: FONT_MONO,
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: '0.2em',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            {loading ? 'TRANSLATING...' : <>TRANSLATE <ArrowRight size={16} /></>}
          </button>
        </div>

        <div>
          <SectionLabel num="OUT" text="Translation" />
          <div style={{
            border: `2px solid ${COLORS.ink}`,
            background: COLORS.ink,
            color: COLORS.paper,
            padding: 24,
            minHeight: 200,
          }}>
            {result?.error && (
              <div style={{ color: COLORS.red, fontFamily: FONT_MONO, fontSize: 13 }}>{result.error}</div>
            )}
            {!result && !loading && (
              <div style={{ opacity: 0.5, fontStyle: 'italic', fontSize: 16 }}>
                Translation appears here.
              </div>
            )}
            {loading && (
              <div style={{ fontFamily: FONT_MONO, fontSize: 13, letterSpacing: '0.15em' }}>
                ANALYZING<span style={{ animation: 'blink 1.4s infinite' }}>...</span>
              </div>
            )}
            {result && !result.error && (
              <div className="slide-up">
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
                    <span style={{
                      fontFamily: FONT_MONO,
                      fontSize: 10,
                      letterSpacing: '0.2em',
                      color: COLORS.red,
                    }}>DEUTSCH</span>
                    <button
                      onClick={() => speak(result.german)}
                      style={{
                        background: 'transparent',
                        border: `1px solid ${COLORS.paper}50`,
                        color: COLORS.paper,
                        padding: '2px 8px',
                        fontFamily: FONT_MONO,
                        fontSize: 9,
                        letterSpacing: '0.1em',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Volume2 size={11} /> HEAR
                    </button>
                  </div>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 600, lineHeight: 1.3 }}>
                    {result.german}
                  </div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                    {result.ipa}
                  </div>
                </div>
                <div style={{ borderTop: `1px dashed ${COLORS.paper}40`, paddingTop: 16 }}>
                  <div style={{
                    fontFamily: FONT_MONO,
                    fontSize: 10,
                    letterSpacing: '0.2em',
                    opacity: 0.6,
                    marginBottom: 6,
                  }}>ENGLISH</div>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 500, fontStyle: 'italic', opacity: 0.95 }}>
                    {result.english}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {result?.words && (
        <div className="slide-up" style={{ marginTop: 32 }}>
          <SectionLabel num="▼" text="Word by word" />
          <div style={{ border: `2px solid ${COLORS.ink}` }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 2fr auto',
              background: COLORS.ink,
              color: COLORS.paper,
              padding: '10px 16px',
              fontFamily: FONT_MONO,
              fontSize: 10,
              letterSpacing: '0.2em',
              gap: 16,
            }}>
              <div>GERMAN</div>
              <div>ENGLISH</div>
              <div>GRAMMAR NOTE</div>
              <div style={{ width: 32 }}></div>
            </div>
            {result.words.map((w, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 2fr auto',
                  padding: '14px 16px',
                  borderTop: i > 0 ? `1px solid ${COLORS.ink}20` : 'none',
                  background: i % 2 === 0 ? COLORS.paper : COLORS.paperDeep,
                  gap: 16,
                  alignItems: 'center',
                }}
              >
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18 }}>{w.de}</div>
                <div style={{ fontFamily: FONT_BODY, fontStyle: 'italic', fontSize: 15 }}>{w.en}</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.mute, letterSpacing: '0.05em' }}>{w.note}</div>
                <button
                  onClick={() => speak(w.de)}
                  style={{
                    width: 32, height: 32,
                    background: 'transparent',
                    border: `1px solid ${COLORS.ink}`,
                    color: COLORS.ink,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Volume2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
