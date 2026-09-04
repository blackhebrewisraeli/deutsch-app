import { useState } from 'react';
import { FONT_SIZE, SPACE, TEXT } from '../../lib/theme';
import Button from '../ui/Button';
import Heading from '../ui/Heading';
import Surface from '../ui/Surface';
import { Row, Stack } from '../ui/Layout';
import { Body } from '../ui/Text';

const THUMB = {
  width: '100%',
  minWidth: SPACE[12],
  minHeight: SPACE[12],
  boxSizing: 'border-box',
};

/**
 * Stub flashcard for `{ type: 'flashcard', payload }`.
 * Payload guidance (spec §5.3): `{ term, glosses[], ipa?, example? }`.
 * Local reveal state, plus an optional self-rating (E5.5). With no `onGraded`
 * listener it is exactly the presentation-only stub it was: no rating controls
 * render at all, so the standalone preview page is unchanged.
 */
export default function FlashcardExercise({ payload, onGraded }) {
  const [revealed, setRevealed] = useState(false);
  const [graded, setGraded] = useState(false);
  const { term, glosses, ipa, example } = payload && typeof payload === 'object' ? payload : {};
  const meanings = Array.isArray(glosses) ? glosses.filter(Boolean) : [];

  return (
    <Stack gap={5} style={{ width: '100%' }}>
      <Surface
        elevation={1}
        padding={5}
        style={{
          minHeight: 200,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        <Stack gap={3} align="center" style={{ width: '100%' }}>
          {term ? (
            <Heading
              level={2}
              size="display"
              style={{ overflowWrap: 'anywhere', maxWidth: '100%' }}
            >
              {term}
            </Heading>
          ) : null}
          {ipa ? <div style={TEXT.ipa}>{ipa}</div> : null}
          {revealed && meanings.length > 0 ? (
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                width: '100%',
                minWidth: 0,
              }}
            >
              {meanings.map((gloss) => (
                <li key={gloss}>
                  <Body
                    as="span"
                    style={{
                      display: 'block',
                      fontSize: FONT_SIZE.xl,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {gloss}
                  </Body>
                </li>
              ))}
            </ul>
          ) : null}
          {revealed && example ? (
            <Body style={{ ...TEXT.translation, overflowWrap: 'anywhere' }}>{example}</Body>
          ) : null}
        </Stack>
      </Surface>
      <Button
        variant="go"
        aria-expanded={revealed}
        onClick={() => setRevealed((open) => !open)}
        style={THUMB}
      >
        {revealed ? 'Hide meaning' : 'Reveal meaning'}
      </Button>
      {/* A rating is only offered AFTER the meaning is on screen: grading a
        card you have not seen is not a self-assessment. The pair stays mounted
        once graded so the answer does not vanish under the thumb that gave it,
        but both are disabled — one card, one verdict. */}
      {onGraded && revealed ? (
        <Row gap={3} wrap={false} style={{ width: '100%' }}>
          <Button
            variant="go"
            disabled={graded}
            onClick={() => grade('correct')}
            style={{ ...THUMB, flex: 1, minWidth: 0 }}
          >
            Got it
          </Button>
          <Button
            variant="tile"
            disabled={graded}
            onClick={() => grade('wrong')}
            style={{ ...THUMB, flex: 1, minWidth: 0 }}
          >
            Not yet
          </Button>
        </Row>
      ) : null}
    </Stack>
  );

  function grade(verdict) {
    if (graded) return;
    setGraded(true);
    onGraded(verdict);
  }
}
