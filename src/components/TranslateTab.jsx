import { useState, useEffect, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import { COLORS, FONTS, FONT_SIZE, LETTER_SPACING, SPACE, BORDER } from '../lib/theme';
import { activePack } from '../packs';
const {
  A1: TRANSLATE_SENTENCES_A1,
  A2: TRANSLATE_SENTENCES_A2,
  B1: TRANSLATE_SENTENCES_B1,
} = activePack.content.translateSentences;
import { shuffle } from '../lib/utils';
import { Hero } from './UI';
import ExerciseHeader from './translate/ExerciseHeader';
import PromptCard from './translate/PromptCard';
import TileExercise from './translate/TileExercise';
import BlankExercise from './translate/BlankExercise';
import TypingExercise from './translate/TypingExercise';
import { generateMoreSentences } from './translate/generateSentences';

// Module-level constant — avoids stale closure in useCallback/useEffect
const BANK_MAP = {
  a1: TRANSLATE_SENTENCES_A1,
  a2: TRANSLATE_SENTENCES_A2,
  b1: TRANSLATE_SENTENCES_B1,
};

// mobile prop accepted for API consistency; TranslateTab layout is already single-column
export default function TranslateTab({
  level = 'a1',
  mobile: _mobile = false,
  reviewTarget = null,
  onReviewConsumed,
}) {
  const [exercises, setExercises] = useState(() => shuffle(BANK_MAP[level]));
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setExercises(shuffle(BANK_MAP[level]));
    setIdx(0);
    setScore(0);
  }, [level]);

  // Pick up review targets handed in from the Stats Review feed.
  // Level mismatch is handled in App.jsx (it switches level first, which
  // re-runs the effect above; then this effect locates the exercise).
  useEffect(() => {
    if (!reviewTarget) return;
    if (reviewTarget.context !== level) return; // still mid-level-switch
    const targetIdx = exercises.findIndex((e) => e.en === reviewTarget.label);
    if (targetIdx >= 0) setIdx(targetIdx);
    onReviewConsumed?.();
  }, [reviewTarget, level, exercises, onReviewConsumed]);

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
