import { Body, Meta } from '../ui/Text';
import Surface from '../ui/Surface';
import { Stack } from '../ui/Layout';

/**
 * Fallback renderer for a lesson exercise whose `type` has no component yet.
 * Presentation only — never throws, never fetches.
 */
export default function UnknownExercise({ type }) {
  return (
    <Surface elevation={1} padding={5} role="status">
      <Stack gap={3}>
        <Meta>This exercise type is not available yet</Meta>
        {type ? <Body>{type}</Body> : null}
      </Stack>
    </Surface>
  );
}
