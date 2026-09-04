import { PageFrame } from '../ui/Layout';
import { getExerciseComponent } from './exerciseRegistry';

/**
 * Strategy-pattern host for one lesson exercise `{ type, payload }`.
 *
 * Pure presentation: it picks a renderer from the registry and passes the
 * payload through. It does not load lessons or write progress. Wiring a
 * caller is E4 — and must not enable the progress RPC alongside B2 sync
 * (spec §7.3).
 */
export default function ExerciseViewer({ type, payload, id }) {
  const Component = getExerciseComponent(type);
  const safePayload = payload && typeof payload === 'object' ? payload : {};

  return (
    <PageFrame maxWidth={480} gutter={5} bottomGutter={6} data-exercise-type={type || 'unknown'}>
      <Component type={type} payload={safePayload} id={id} />
    </PageFrame>
  );
}
