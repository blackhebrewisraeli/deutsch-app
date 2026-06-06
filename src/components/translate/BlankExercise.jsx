import { useState, useEffect } from 'react';
import { SkipForward } from 'lucide-react';
import { COLORS, FONTS, FONT_SIZE, LETTER_SPACING, SPACE, BORDER, BUTTON } from '../../lib/theme';
import { shuffle } from '../../lib/utils';
import { recordEvent, recordItem } from '../../lib/stats';
import FeedbackPanel from './FeedbackPanel';

// A2 — fill the 1–2 blanks in a German sentence by picking tiles from a bank.
export default function BlankExercise({ exercise, level, onCorrect, onSkip }) {
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
    const verdict = correct ? 'correct' : 'wrong';
    setFeedback(verdict);
    recordEvent('translate', level, verdict);
    recordItem('translate', level, exercise.en, exercise.de, verdict);
    if (correct) onCorrect();
  };

  const parts = exercise.template.split('___');

  return (
    <div>
      {feedback ? (
        <FeedbackPanel
          verdict={feedback}
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
