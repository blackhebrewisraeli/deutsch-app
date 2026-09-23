import Surface from './ui/Surface';
import Heading from './ui/Heading';
import { Body } from './ui/Text';
import Button from './ui/Button';
import { Stack, Row } from './ui/Layout';
import { PLACEMENT_OFFER_XP } from '../lib/placementOffer';

/**
 * One-shot Home invite to take placement once the learner has earned
 * PLACEMENT_OFFER_XP.
 * Dismissible — never a hard block. Persistence is the parent's job.
 */
export default function PlacementOfferBanner({ onRetake, onDismiss }) {
  return (
    <Surface
      as="section"
      elevation={1}
      padding={4}
      role="region"
      aria-labelledby="placement-offer-heading"
    >
      <Stack gap={4}>
        <Heading id="placement-offer-heading" level={2} size="sm">
          Ready to check your level?
        </Heading>
        <Body size="sm" tone="muted">
          You've earned {PLACEMENT_OFFER_XP} XP. Nine quick questions can move you to the practice
          level that fits — or keep going where you are. It's always in Settings too.
        </Body>
        <Row gap={3}>
          <Button variant="primary" onClick={onRetake}>
            Take the test
          </Button>
          <Button variant="secondary" onClick={onDismiss}>
            Not now
          </Button>
        </Row>
      </Stack>
    </Surface>
  );
}
