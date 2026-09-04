import { PageFrame } from '../ui/Layout';
import { getExerciseComponent } from './exerciseRegistry';

/**
 * Strategy-pattern host for one lesson exercise `{ type, payload }`.
 *
 * It picks a renderer from the registry and passes the payload through. It
 * still writes no progress itself: `onGraded` is forwarded to the renderer and
 * fired with a verdict, and the LANE decides what that means (E5.5). Keeping
 * the recording out of here is what lets the standalone preview page mount a
 * viewer with no listener and stay presentation-only.
 */
export default function ExerciseViewer({ type, payload, id, onGraded }) {
  const Component = getExerciseComponent(type);
  const safePayload = payload && typeof payload === 'object' ? payload : {};

  return (
    <PageFrame maxWidth={480} gutter={5} bottomGutter={6} data-exercise-type={type || 'unknown'}>
      <Component type={type} payload={safePayload} id={id} onGraded={onGraded} />
    </PageFrame>
  );
}
