import { useState, useEffect } from 'react';
import { SkipForward } from 'lucide-react';
import {
  COLORS,
  FONTS,
  FONT_SIZE,
  LETTER_SPACING,
  SPACE,
  RADIUS,
  SHADOW,
  BUTTON,
} from '../../lib/theme';
import { shuffle } from '../../lib/utils';
import { recordEvent, recordItem } from '../../lib/stats';
import { activePack } from '../../packs';
import { exactMatch } from '../../lib/matching';
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
    const correct = filled.every(
      (t, i) => t && exactMatch(exercise.blanks[i].word, t.word, activePack.validation.normalize)
    );
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
              borderRadius: RADIUS.lg,
              boxShadow: SHADOW.card,
              padding: SPACE[5],
              background: COLORS.card,
            }}
          >
            {parts.map((part, i) => (
              <span key={i}>
                {part}
                {i < parts.length - 1 && (
                  <button
                    type="button"
                    onClick={() => clearBlank(i)}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && filled[i]) {
                        e.preventDefault();
                        clearBlank(i);
                      }
                    }}
                    aria-label={filled[i] ? `Clear blank ${i + 1}` : `Blank ${i + 1} is empty`}
                    disabled={!filled[i]}
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
                      background: 'transparent',
                      borderTop: 'none',
                      borderLeft: 'none',
                      borderRight: 'none',
                    }}
                  >
                    {filled[i] ? filled[i].word : '___'}
                  </button>
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
                type="button"
                onClick={() => fillNext(tile)}
                aria-label={`Use ${tile.word} for next blank`}
                style={{
                  padding: `${SPACE[2]}px ${SPACE[4]}px`,
                  fontFamily: FONTS.mono,
                  fontSize: FONT_SIZE.md,
                  border: 'none',
                  borderRadius: RADIUS.sm,
                  boxShadow: SHADOW.press(COLORS.lip),
                  background: COLORS.card,
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
              type="button"
              onClick={check}
              disabled={filled.includes(null)}
              style={{ ...BUTTON.go, flex: 1, opacity: filled.includes(null) ? 0.4 : 1 }}
            >
              CHECK →
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
