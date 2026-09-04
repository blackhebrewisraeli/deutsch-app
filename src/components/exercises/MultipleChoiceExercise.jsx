import { useState } from 'react';
import { FONTS, FONT_WEIGHT, LETTER_SPACING, SPACE } from '../../lib/theme';
import Button from '../ui/Button';
import Heading from '../ui/Heading';
import Surface from '../ui/Surface';
import { Stack } from '../ui/Layout';

const THUMB = {
  width: '100%',
  minWidth: SPACE[12],
  minHeight: SPACE[12],
  maxWidth: '100%',
  boxSizing: 'border-box',
  overflowWrap: 'anywhere',
};

/**
 * Stub quiz prompt for `{ type: 'multiple-choice', payload }`.
 * Payload guidance: `{ question, options[] }`.
 * Spec §5.3 also lists `{ prompt, choices[], correctId }` — accept those
 * aliases so a seed fixture still renders. Local selection only — no grade,
 * no fetch, no progress write.
 */
export default function MultipleChoiceExercise({ payload, onGraded }) {
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const data = payload && typeof payload === 'object' ? payload : {};
  const question = firstString(data.question, data.prompt);
  const options = readOptions(data.options ?? data.choices);
  // Optional: a seed written before grading existed carries no `answer`, and
  // must keep behaving exactly as it did — selectable, submittable, unscored.
  // Silently grading everything `wrong` against a missing key would bury a
  // learner's XP under a content bug.
  const answer = firstString(data.answer);

  function submit() {
    if (submitted) return;
    setSubmitted(true);
    if (onGraded && answer) onGraded(selected === answer ? 'correct' : 'wrong');
  }

  return (
    <Stack gap={5} style={{ width: '100%', overflowX: 'hidden' }}>
      <Surface elevation={1} padding={5}>
        {question ? (
          <Heading level={2} size="xl" style={{ overflowWrap: 'anywhere', maxWidth: '100%' }}>
            {question}
          </Heading>
        ) : null}
      </Surface>
      <Stack
        as="ul"
        gap={3}
        role="group"
        aria-label="Options"
        style={{ listStyle: 'none', margin: 0, padding: 0 }}
      >
        {options.map((option) => {
          const pressed = selected === option;
          return (
            <li key={option} style={{ width: '100%', minWidth: 0 }}>
              <Button
                variant={pressed ? 'primary' : 'tile'}
                aria-pressed={pressed}
                disabled={submitted}
                onClick={() => setSelected(option)}
                style={{
                  ...THUMB,
                  textTransform: 'none',
                  fontFamily: FONTS.body,
                  fontWeight: FONT_WEIGHT.medium,
                  letterSpacing: LETTER_SPACING.normal,
                }}
              >
                {option}
              </Button>
            </li>
          );
        })}
      </Stack>
      <Button
        variant="go"
        disabled={!selected || submitted}
        onClick={submit}
        style={{
          ...THUMB,
          marginBottom: `calc(${SPACE[3]}px + env(safe-area-inset-bottom, 0px))`,
        }}
      >
        Submit
      </Button>
      {submitted && selected ? <div role="status">Selected: {selected}</div> : null}
    </Stack>
  );
}

function firstString(...values) {
  return values.find((value) => typeof value === 'string' && value) ?? '';
}

function readOptions(raw) {
  return Array.isArray(raw) ? raw.filter((option) => typeof option === 'string' && option) : [];
}
