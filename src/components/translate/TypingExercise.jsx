import { useState, useEffect, useRef } from 'react';
import { ArrowRight, SkipForward } from 'lucide-react';
import { COLORS, FONTS, FONT_SIZE, LETTER_SPACING, SPACE, RADIUS, BUTTON } from '../../lib/theme';
import { callClaude } from '../../lib/claude';
import { recordEvent, recordItem } from '../../lib/stats';
import FeedbackPanel from './FeedbackPanel';

// B1 — free-typed translation graded by Claude with a three-way verdict
// (correct / almost / wrong). "almost" still advances the score.
export default function TypingExercise({ exercise, level, onCorrect, onSkip }) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [reward, setReward] = useState({ xp: 0, mult: 1 });
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  useEffect(() => {
    setInput('');
    setFeedback(null);
  }, [exercise]);

  const check = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    try {
      const system = `You are a German language grader. The learner was asked to translate an English sentence into German.
Evaluate their answer strictly but fairly. Respond ONLY with valid JSON, no markdown:
{
  "verdict": "correct" | "almost" | "wrong",
  "corrected": "the ideal German translation",
  "message": "one sentence of feedback in English explaining the main error or praising them"
}
Use "correct" if the translation is grammatically correct and conveys the full meaning, even if phrasing differs from the ideal.
Use "almost" if there's a minor issue (a typo, a small grammar slip, a slightly off article or case) but the meaning is clearly there.
Use "wrong" if there's a significant grammar mistake, wrong word choice, or the meaning is not conveyed.`;
      const user = `English sentence: "${exercise.en}"\nIdeal German: "${exercise.de}"\nLearner's answer: "${input}"`;
      const raw = await callClaude(system, user, [], { endpoint: 'grade' });
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      if (mounted.current) {
        // Validate verdict; fall back to binary if Claude returns the old shape.
        const verdict =
          parsed.verdict === 'correct' || parsed.verdict === 'almost' || parsed.verdict === 'wrong'
            ? parsed.verdict
            : parsed.correct
              ? 'correct'
              : 'wrong';
        setFeedback({
          verdict,
          corrected: parsed.corrected,
          message: parsed.message,
        });
        const r = recordEvent('translate', level, verdict);
        setReward(r);
        recordItem('translate', level, exercise.en, exercise.de, verdict);
        // "almost" still advances the exercise — typos shouldn't gate progress.
        if (verdict === 'correct' || verdict === 'almost') onCorrect();
      }
    } catch {
      if (mounted.current)
        setFeedback({
          verdict: 'wrong',
          corrected: exercise.de,
          message: 'Could not grade — check your connection.',
        });
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  return (
    <div>
      {feedback ? (
        <FeedbackPanel
          verdict={feedback.verdict}
          correctText={feedback.corrected}
          note={feedback.message}
          xp={reward.xp}
          mult={reward.mult}
          onNext={onSkip}
        />
      ) : (
        <>
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.tag,
              letterSpacing: LETTER_SPACING.caps,
              color: COLORS.mute,
              marginBottom: SPACE[2],
            }}
          >
            YOUR GERMAN TRANSLATION
          </div>
          <textarea
            aria-label="Your German translation"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && check()}
            placeholder="Type your translation here… (Cmd/Ctrl+Enter to submit)"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: 120,
              padding: SPACE[4],
              border: 'none',
              borderRadius: RADIUS.md,
              boxShadow: 'inset 0 2px 5px rgba(22,17,11,0.06)',
              background: COLORS.card,
              fontFamily: FONTS.display,
              fontSize: FONT_SIZE.xl,
              resize: 'vertical',
              color: COLORS.ink,
              lineHeight: 1.5,
              marginBottom: SPACE[4],
            }}
          />
          <div style={{ display: 'flex', gap: SPACE[3] }}>
            <button
              type="button"
              onClick={check}
              disabled={!input.trim() || loading}
              style={{ ...BUTTON.go, flex: 1, opacity: !input.trim() || loading ? 0.4 : 1 }}
            >
              {loading ? (
                'GRADING...'
              ) : (
                <>
                  CHECK <ArrowRight size={14} aria-hidden="true" />
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onSkip}
              aria-label="Skip exercise"
              style={{ ...BUTTON.secondary, flex: 0, padding: `${SPACE[3]}px ${SPACE[4]}px` }}
            >
              <SkipForward size={16} aria-hidden="true" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
