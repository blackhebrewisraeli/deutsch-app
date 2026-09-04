import { useState } from 'react';
import { BORDER, COLORS, FONT_SIZE, FONTS, RADIUS, SHADOW, SPACE } from '../../lib/theme';
import Button from '../ui/Button';
import Heading from '../ui/Heading';
import Surface from '../ui/Surface';
import { Stack } from '../ui/Layout';
import { Body, Meta } from '../ui/Text';
import { fuzzyMatch } from '../../lib/matching';
import { ANSWER } from '../../lib/textRules';

const THUMB = {
  width: '100%',
  minWidth: SPACE[12],
  minHeight: SPACE[12],
  boxSizing: 'border-box',
};

/**
 * Stub translate prompt for `{ type: 'translate', payload }`.
 * Payload guidance (spec §5.3): `{ prompt, accepted[], direction }`.
 * With an `onGraded` listener it takes a typed answer and grades it against
 * `accepted` (E5.5). Without one it stays the presentation-only reveal it was,
 * so the standalone preview page is unchanged.
 */
export default function TranslateExercise({ payload, onGraded }) {
  const [checked, setChecked] = useState(false);
  const [typed, setTyped] = useState('');
  const { prompt, accepted, direction } = payload && typeof payload === 'object' ? payload : {};
  const answers = Array.isArray(accepted) ? accepted.filter(Boolean) : [];
  const grading = Boolean(onGraded);

  // The same distance bands VocabTab's typed drill uses: exact is correct, a
  // typo or two is `almost`, anything further is wrong. Graded against EVERY
  // accepted string, not just the first — "Mein Name ist Anna" is as right as
  // "Ich heiße Anna", and grading only answers[0] is the bug that made the
  // meaning drill mark real answers wrong.
  function grade() {
    if (checked) return;
    setChecked(true);
    if (!grading) return;
    const best = answers.reduce(
      (min, answer) => Math.min(min, fuzzyMatch(answer, typed, ANSWER).distance),
      Infinity
    );
    onGraded(best === 0 ? 'correct' : best <= 2 ? 'almost' : 'wrong');
  }

  return (
    <Stack gap={5} style={{ width: '100%' }}>
      <Surface elevation={1} padding={5}>
        <Stack gap={3}>
          {direction ? <Meta>{direction}</Meta> : null}
          {prompt ? (
            <Heading level={2} size="xl" style={{ overflowWrap: 'anywhere', maxWidth: '100%' }}>
              {prompt}
            </Heading>
          ) : null}
          {checked && answers.length > 0 ? (
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                width: '100%',
                minWidth: 0,
              }}
            >
              {answers.map((answer) => (
                <li key={answer}>
                  <Body style={{ overflowWrap: 'anywhere' }}>{answer}</Body>
                </li>
              ))}
            </ul>
          ) : null}
        </Stack>
      </Surface>
      {grading ? (
        <input
          aria-label="Your answer"
          value={typed}
          disabled={checked}
          onChange={(event) => setTyped(event.target.value)}
          style={{
            ...THUMB,
            width: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
            background: COLORS.surface,
            border: BORDER.panel,
            borderRadius: RADIUS.md,
            boxShadow: SHADOW.inset,
            padding: `0 ${SPACE[4]}px`,
            fontFamily: FONTS.body,
            fontSize: FONT_SIZE.lg,
            color: COLORS.ink,
          }}
        />
      ) : null}
      <Button
        variant="primary"
        aria-expanded={checked}
        onClick={grading ? grade : () => setChecked((open) => !open)}
        style={THUMB}
      >
        Check
      </Button>
    </Stack>
  );
}
