import { useState } from 'react';
import { SPACE } from '../../lib/theme';
import Button from '../ui/Button';
import Heading from '../ui/Heading';
import Surface from '../ui/Surface';
import { Stack } from '../ui/Layout';
import { Body, Meta } from '../ui/Text';

const THUMB = {
  width: '100%',
  minWidth: SPACE[12],
  minHeight: SPACE[12],
  boxSizing: 'border-box',
};

/**
 * Stub translate prompt for `{ type: 'translate', payload }`.
 * Payload guidance (spec §5.3): `{ prompt, accepted[], direction }`.
 * Local check state only — no grading engine, no fetch, no progress write.
 */
export default function TranslateExercise({ payload }) {
  const [checked, setChecked] = useState(false);
  const { prompt, accepted, direction } = payload && typeof payload === 'object' ? payload : {};
  const answers = Array.isArray(accepted) ? accepted.filter(Boolean) : [];

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
      <Button
        variant="primary"
        aria-expanded={checked}
        onClick={() => setChecked((open) => !open)}
        style={THUMB}
      >
        Check
      </Button>
    </Stack>
  );
}
