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

// A1 — assemble the German sentence from word tiles (correct words +
// distractors), in order.
export default function TileExercise({ exercise, level, onCorrect, onSkip }) {
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
    const isCorrect = exactMatch(correct, answer, activePack.validation.normalize);
    const verdict = isCorrect ? 'correct' : 'wrong';
    setFeedback(verdict);
    recordEvent('translate', level, verdict);
    recordItem('translate', level, exercise.en, exercise.de, verdict);
    if (isCorrect) onCorrect();
  };

  const tileStyle = (active) => ({
    padding: `${SPACE[2]}px ${SPACE[4]}px`,
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZE.md,
    border: 'none',
    borderRadius: RADIUS.sm,
    boxShadow: SHADOW.press(active ? '#000000' : COLORS.lip),
    background: active ? COLORS.ink : COLORS.card,
    color: active ? COLORS.paper : COLORS.ink,
    cursor: 'pointer',
    transition: 'transform .08s ease, box-shadow .08s ease',
  });

  return (
    <div>
      {feedback ? (
        <FeedbackPanel
          verdict={feedback}
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
              border: `2px dashed ${COLORS.ink}30`,
              borderRadius: RADIUS.md,
              background: COLORS.card,
              padding: SPACE[3],
              display: 'flex',
              gap: SPACE[2],
              flexWrap: 'wrap',
              marginBottom: SPACE[4],
            }}
          >
            {placed.map((tile) => (
              <button
                key={tile.id}
                type="button"
                onClick={() => removeTile(tile)}
                aria-label={`Remove ${tile.word} from answer`}
                style={tileStyle(true)}
              >
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
              <button
                key={tile.id}
                type="button"
                onClick={() => addTile(tile)}
                aria-label={`Add ${tile.word} to answer`}
                style={tileStyle(false)}
              >
                {tile.word}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: SPACE[3] }}>
            <button
              type="button"
              onClick={check}
              disabled={placed.length === 0}
              style={{ ...BUTTON.go, flex: 1, opacity: placed.length === 0 ? 0.4 : 1 }}
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
