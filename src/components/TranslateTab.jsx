import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowRight, Sparkles, SkipForward } from 'lucide-react';
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
import {
  TRANSLATE_SENTENCES_A1,
  TRANSLATE_SENTENCES_A2,
  TRANSLATE_SENTENCES_B1,
} from '../data/content';
import { shuffle } from '../lib/utils';
import { recordEvent } from '../lib/stats';
import { Hero } from './UI';

// Module-level constant — avoids stale closure in useCallback/useEffect
const BANK_MAP = {
  a1: TRANSLATE_SENTENCES_A1,
  a2: TRANSLATE_SENTENCES_A2,
  b1: TRANSLATE_SENTENCES_B1,
};

// ─── Shared sub-components ────────────────────────────────────────────────────

function ExerciseHeader({ level, idx, total }) {
  const labels = { a1: 'A1 — WORD TILES', a2: 'A2 — FILL THE BLANKS', b1: 'B1 — FREE TRANSLATION' };
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACE[4],
      }}
    >
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: FONT_SIZE.tag,
          letterSpacing: LETTER_SPACING.caps,
          color: COLORS.red,
          textTransform: 'uppercase',
        }}
      >
        {labels[level]}
      </span>
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: FONT_SIZE.tag,
          letterSpacing: LETTER_SPACING.wider,
          color: COLORS.mute,
        }}
      >
        Exercise {idx + 1} / {total}
      </span>
    </div>
  );
}

function PromptCard({ text }) {
  return (
    <div
      style={{
        border: BORDER.standard,
        background: COLORS.paper,
        padding: `${SPACE[5]}px ${SPACE[6]}px`,
        marginBottom: SPACE[4],
      }}
    >
      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: FONT_SIZE.tag,
          letterSpacing: LETTER_SPACING.caps,
          color: COLORS.mute,
          marginBottom: SPACE[2],
        }}
      >
        TRANSLATE TO GERMAN
      </div>
      <div
        style={{
          fontFamily: FONTS.display,
          fontSize: FONT_SIZE['2xl'],
          fontWeight: FONT_WEIGHT.semibold,
          lineHeight: 1.3,
        }}
      >
        {text}
      </div>
    </div>
  );
}

function FeedbackPanel({ correct, correctText, note, onNext }) {
  return (
    <div
      style={{
        border: BORDER.standard,
        background: correct ? COLORS.gold : COLORS.red,
        color: correct ? COLORS.ink : COLORS.paper,
        padding: SPACE[5],
        marginTop: SPACE[4],
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
        {correct ? '✓ CORRECT' : '✗ NOT QUITE'}
      </div>
      {!correct && (
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: FONT_SIZE.xl,
            fontWeight: FONT_WEIGHT.semibold,
            marginBottom: SPACE[2],
          }}
        >
          {correctText}
        </div>
      )}
      {note && (
        <div
          style={{
            fontFamily: FONTS.body,
            fontStyle: 'italic',
            fontSize: FONT_SIZE.base,
            opacity: 0.85,
            marginBottom: SPACE[4],
          }}
        >
          {note}
        </div>
      )}
      <button
        onClick={onNext}
        style={{
          ...BUTTON.primary,
          background: correct ? COLORS.ink : COLORS.paper,
          color: correct ? COLORS.paper : COLORS.ink,
        }}
      >
        NEXT EXERCISE <ArrowRight size={14} />
      </button>
    </div>
  );
}

// ─── A1 — Word Tile Exercise ──────────────────────────────────────────────────

function TileExercise({ exercise, level, onCorrect, onSkip }) {
  const [bank, setBank] = useState([]);
  const [placed, setPlaced] = useState([]);
  const [feedback, setFeedback] = useState(null); // null | 'correct' | 'wrong'

  useEffect(() => {
    const tiles = [...exercise.words, ...exercise.distractors].map((w, i) => ({ id: i, word: w }));
    setBank(shuffle(tiles));
    setPlaced([]);
    setFeedback(null);
  }, [exercise]);

  const addTile = (tile) => {
    setBank((b) => b.filter((t) => t.id !== tile.id));
    setPlaced((p) => [...p, tile]);
  };

  const removeTile = (tile) => {
    setPlaced((p) => p.filter((t) => t.id !== tile.id));
    setBank((b) => [...b, tile]);
  };

  const check = () => {
    const answer = placed.map((t) => t.word).join(' ');
    const correct = exercise.words.join(' ');
    const isCorrect = answer === correct;
    setFeedback(isCorrect ? 'correct' : 'wrong');
    recordEvent('translate', level, isCorrect ? 'correct' : 'wrong');
    if (isCorrect) onCorrect();
  };

  const tileStyle = (active) => ({
    padding: `${SPACE[1] + 2}px ${SPACE[3]}px`,
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZE.md,
    border: BORDER.standard,
    background: active ? COLORS.ink : COLORS.paper,
    color: active ? COLORS.paper : COLORS.ink,
    cursor: 'pointer',
    transition: 'all 0.1s',
  });

  return (
    <div>
      {feedback ? (
        <FeedbackPanel
          correct={feedback === 'correct'}
          correctText={exercise.words.join(' ')}
          note={exercise.note}
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
            YOUR ANSWER — click tiles in order
          </div>
          <div
            style={{
              minHeight: 52,
              border: `2px dashed ${COLORS.ink}40`,
              background: COLORS.card,
              padding: SPACE[3],
              display: 'flex',
              gap: SPACE[2],
              flexWrap: 'wrap',
              marginBottom: SPACE[4],
            }}
          >
            {placed.map((tile) => (
              <button key={tile.id} onClick={() => removeTile(tile)} style={tileStyle(true)}>
                {tile.word}
              </button>
            ))}
          </div>

          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.tag,
              letterSpacing: LETTER_SPACING.caps,
              color: COLORS.mute,
              marginBottom: SPACE[2],
            }}
          >
            WORD BANK
          </div>
          <div style={{ display: 'flex', gap: SPACE[2], flexWrap: 'wrap', marginBottom: SPACE[5] }}>
            {bank.map((tile) => (
              <button key={tile.id} onClick={() => addTile(tile)} style={tileStyle(false)}>
                {tile.word}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: SPACE[3] }}>
            <button
              onClick={check}
              disabled={placed.length === 0}
              style={{ ...BUTTON.danger, flex: 1, opacity: placed.length === 0 ? 0.4 : 1 }}
            >
              CHECK →
            </button>
            <button
              onClick={onSkip}
              style={{ ...BUTTON.secondary, flex: 0, padding: `${SPACE[3]}px ${SPACE[4]}px` }}
            >
              <SkipForward size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── A2 — Fill-the-Blanks Exercise ───────────────────────────────────────────

function BlankExercise({ exercise, level, onCorrect, onSkip }) {
  const [tileBank, setTileBank] = useState([]);
  const [filled, setFilled] = useState([]);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    const allTiles = exercise.blanks.flatMap((b) => [b.word, ...b.distractors]);
    setTileBank(shuffle([...new Set(allTiles)].map((w, i) => ({ id: i, word: w }))));
    setFilled(Array(exercise.blanks.length).fill(null));
    setFeedback(null);
  }, [exercise]);

  const fillNext = (tile) => {
    const idx = filled.indexOf(null);
    if (idx === -1) return;
    const next = [...filled];
    next[idx] = tile;
    setFilled(next);
    setTileBank((b) => b.filter((t) => t.id !== tile.id));
  };

  const clearBlank = (idx) => {
    const tile = filled[idx];
    if (!tile) return;
    const next = [...filled];
    next[idx] = null;
    setFilled(next);
    setTileBank((b) => [...b, tile]);
  };

  const check = () => {
    const correct = filled.every((t, i) => t && t.word === exercise.blanks[i].word);
    setFeedback(correct ? 'correct' : 'wrong');
    recordEvent('translate', level, correct ? 'correct' : 'wrong');
    if (correct) onCorrect();
  };

  const parts = exercise.template.split('___');

  return (
    <div>
      {feedback ? (
        <FeedbackPanel
          correct={feedback === 'correct'}
          correctText={exercise.de}
          note={exercise.note}
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
            COMPLETE THE SENTENCE
          </div>
          <div
            style={{
              fontFamily: FONTS.display,
              fontSize: FONT_SIZE['2xl'],
              lineHeight: 2,
              marginBottom: SPACE[4],
              border: BORDER.standard,
              padding: SPACE[4],
              background: COLORS.card,
            }}
          >
            {parts.map((part, i) => (
              <span key={i}>
                {part}
                {i < parts.length - 1 && (
                  <span
                    onClick={() => clearBlank(i)}
                    style={{
                      display: 'inline-block',
                      minWidth: 80,
                      borderBottom: `2px solid ${filled[i] ? COLORS.ink : COLORS.red}`,
                      marginInline: SPACE[1],
                      textAlign: 'center',
                      fontFamily: FONTS.mono,
                      fontSize: FONT_SIZE.md,
                      color: filled[i] ? COLORS.ink : COLORS.red,
                      cursor: filled[i] ? 'pointer' : 'default',
                      paddingInline: SPACE[2],
                    }}
                  >
                    {filled[i] ? filled[i].word : '___'}
                  </span>
                )}
              </span>
            ))}
          </div>

          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.tag,
              letterSpacing: LETTER_SPACING.caps,
              color: COLORS.mute,
              marginBottom: SPACE[2],
            }}
          >
            CHOOSE A WORD
          </div>
          <div style={{ display: 'flex', gap: SPACE[2], flexWrap: 'wrap', marginBottom: SPACE[5] }}>
            {tileBank.map((tile) => (
              <button
                key={tile.id}
                onClick={() => fillNext(tile)}
                style={{
                  padding: `${SPACE[1] + 2}px ${SPACE[3]}px`,
                  fontFamily: FONTS.mono,
                  fontSize: FONT_SIZE.md,
                  border: BORDER.standard,
                  background: COLORS.paper,
                  color: COLORS.ink,
                  cursor: 'pointer',
                }}
              >
                {tile.word}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: SPACE[3] }}>
            <button
              onClick={check}
              disabled={filled.includes(null)}
              style={{ ...BUTTON.danger, flex: 1, opacity: filled.includes(null) ? 0.4 : 1 }}
            >
              CHECK →
            </button>
            <button
              onClick={onSkip}
              style={{ ...BUTTON.secondary, flex: 0, padding: `${SPACE[3]}px ${SPACE[4]}px` }}
            >
              <SkipForward size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── B1 — Free Typing + AI Feedback ──────────────────────────────────────────

function TypingExercise({ exercise, level, onCorrect, onSkip }) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
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
  "correct": true or false,
  "corrected": "the ideal German translation",
  "message": "one sentence of feedback in English explaining the main error or praising them"
}
Set "correct": true only if the translation is grammatically correct and conveys the full meaning, even if phrasing differs from the ideal.`;
      const user = `English sentence: "${exercise.en}"\nIdeal German: "${exercise.de}"\nLearner's answer: "${input}"`;
      const raw = await callClaude(system, user);
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      if (mounted.current) {
        setFeedback(parsed);
        recordEvent('translate', level, parsed.correct ? 'correct' : 'wrong');
        if (parsed.correct) onCorrect();
      }
    } catch {
      if (mounted.current)
        setFeedback({
          correct: false,
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
          correct={feedback.correct}
          correctText={feedback.corrected}
          note={feedback.message}
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
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && check()}
            placeholder="Type your translation here… (Cmd/Ctrl+Enter to submit)"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: 120,
              padding: SPACE[4],
              border: BORDER.standard,
              background: COLORS.card,
              fontFamily: FONTS.display,
              fontSize: FONT_SIZE.xl,
              resize: 'vertical',
              outline: 'none',
              color: COLORS.ink,
              lineHeight: 1.5,
              marginBottom: SPACE[4],
            }}
          />
          <div style={{ display: 'flex', gap: SPACE[3] }}>
            <button
              onClick={check}
              disabled={!input.trim() || loading}
              style={{ ...BUTTON.danger, flex: 1, opacity: !input.trim() || loading ? 0.4 : 1 }}
            >
              {loading ? (
                'GRADING...'
              ) : (
                <>
                  CHECK <ArrowRight size={14} />
                </>
              )}
            </button>
            <button
              onClick={onSkip}
              style={{ ...BUTTON.secondary, flex: 0, padding: `${SPACE[3]}px ${SPACE[4]}px` }}
            >
              <SkipForward size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── AI Sentence Generation ───────────────────────────────────────────────────

async function generateMoreSentences(level) {
  const levelDesc = {
    a1: 'A1 beginner (very simple sentences)',
    a2: 'A2 elementary (focus on articles and prepositions)',
    b1: 'B1 intermediate (complex grammar)',
  }[level];
  const system = `You generate German translation exercises for ${levelDesc} learners. Respond ONLY with valid JSON array, no markdown.`;
  const user =
    level === 'b1'
      ? `Generate 5 English sentences for translation into German at B1 level. Return: [{"en":"...","de":"...","note":"grammar concept"}]`
      : level === 'a2'
        ? `Generate 5 English sentences for fill-in-the-blank German exercises at A2 level. Each must have 1-2 blanks targeting articles or prepositions. Return: [{"en":"...","de":"...","template":"German with ___ for blanks","blanks":[{"word":"correct","distractors":["wrong1","wrong2"]}],"note":"..."}]`
        : `Generate 5 simple English sentences for word-tile German translation at A1 level. Return: [{"en":"...","de":"...","words":["German","tokens","in","order"],"distractors":["wrong1","wrong2"],"note":"..."}]`;
  const raw = await callClaude(system, user);
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

// ─── Main Component ───────────────────────────────────────────────────────────

// mobile prop accepted for API consistency; TranslateTab layout is already single-column
export default function TranslateTab({ level = 'a1', mobile: _mobile = false }) {
  const [exercises, setExercises] = useState(() => shuffle(BANK_MAP[level]));
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setExercises(shuffle(BANK_MAP[level]));
    setIdx(0);
    setScore(0);
  }, [level]);

  const exercise = exercises[idx];

  const handleCorrect = () => setScore((s) => s + 1);

  const handleNext = useCallback(async () => {
    const next = idx + 1;
    if (next >= exercises.length) {
      setGenerating(true);
      try {
        const more = await generateMoreSentences(level);
        setExercises((prev) => [...prev, ...more]);
        setScore(0);
      } catch {
        setExercises(shuffle(BANK_MAP[level]));
        setIdx(0);
        setScore(0);
        setGenerating(false);
        return;
      }
      setGenerating(false);
    }
    setIdx(next);
  }, [idx, exercises.length, level]);

  if (generating) {
    return (
      <div
        style={{
          padding: SPACE[8],
          textAlign: 'center',
          fontFamily: FONTS.mono,
          fontSize: FONT_SIZE.base,
          letterSpacing: LETTER_SPACING.widest,
          color: COLORS.mute,
        }}
      >
        <Sparkles size={24} style={{ marginBottom: SPACE[4], color: COLORS.gold }} />
        <div>GENERATING NEW EXERCISES...</div>
      </div>
    );
  }

  const SET_SIZE = 10;
  const setIdx_ = idx % SET_SIZE;

  return (
    <div>
      <Hero
        kicker="Section 04"
        title="Übersetzen"
        sub="The app gives you a sentence. You translate it. Three modes depending on your level."
      />
      <div style={{ marginTop: SPACE[8], maxWidth: 760 }}>
        <ExerciseHeader level={level} idx={setIdx_} total={SET_SIZE} />

        <div
          style={{
            height: 4,
            background: COLORS.paperDeep,
            border: BORDER.standard,
            marginBottom: SPACE[5],
          }}
        >
          <div
            style={{
              height: '100%',
              background: COLORS.gold,
              width: `${Math.min((score / SET_SIZE) * 100, 100)}%`,
              transition: 'width 0.4s ease',
            }}
          />
        </div>

        <PromptCard text={exercise.en} />

        {level === 'a1' && (
          <TileExercise
            key={idx}
            exercise={exercise}
            level={level}
            onCorrect={handleCorrect}
            onSkip={handleNext}
          />
        )}
        {level === 'a2' && (
          <BlankExercise
            key={idx}
            exercise={exercise}
            level={level}
            onCorrect={handleCorrect}
            onSkip={handleNext}
          />
        )}
        {level === 'b1' && (
          <TypingExercise
            key={idx}
            exercise={exercise}
            level={level}
            onCorrect={handleCorrect}
            onSkip={handleNext}
          />
        )}
      </div>
    </div>
  );
}
