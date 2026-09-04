import { COLORS, SPACE } from '../../lib/theme';
import { Stack } from '../ui/Layout';
import { Meta } from '../ui/Text';
import ExerciseViewer from './ExerciseViewer';

const FIXTURES = [
  {
    type: 'flashcard',
    payload: {
      term: 'Hallo',
      glosses: ['hello', 'hi'],
      ipa: '/ˈhalo/',
      example: 'Hallo, wie geht’s?',
    },
  },
  {
    type: 'translate',
    payload: { prompt: 'Good morning', accepted: ['Guten Morgen', 'Morgen'], direction: 'en-de' },
  },
  { type: 'hologram', payload: { term: 'should not render' } },
];

/**
 * Local sandbox for the registry — not imported by the PWA chrome.
 * Mounted only from `src/exercise-preview.jsx`.
 */
export default function ExercisePreview() {
  return (
    <div
      style={{
        background: COLORS.paper,
        color: COLORS.ink,
        minHeight: '100dvh',
        boxSizing: 'border-box',
        paddingBottom: SPACE[8],
      }}
    >
      <Stack gap={8}>
        <Meta as="p" style={{ padding: `${SPACE[5]}px ${SPACE[5]}px 0` }}>
          Exercise engine preview
        </Meta>
        {FIXTURES.map((exercise) => (
          <ExerciseViewer key={exercise.type} type={exercise.type} payload={exercise.payload} />
        ))}
      </Stack>
    </div>
  );
}
