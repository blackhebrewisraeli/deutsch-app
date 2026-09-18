import Surface from './ui/Surface';
import Heading from './ui/Heading';
import { Body } from './ui/Text';
import Button from './ui/Button';
import { Stack, Row } from './ui/Layout';
import { PLACEMENT_OFFER_THRESHOLD } from '../lib/placementOffer';

/**
 * One-shot Home invite to retake placement after N completed decks.
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
          Ready to retake placement?
        </Heading>
        <Body size="sm" tone="muted">
          You've finished {PLACEMENT_OFFER_THRESHOLD} vocab decks. A short test can update your
          practice level. You can also retake anytime from Settings.
        </Body>
        <Row gap={3}>
          <Button variant="primary" onClick={onRetake}>
            Retake placement
          </Button>
          <Button variant="secondary" onClick={onDismiss}>
            Not now
          </Button>
        </Row>
      </Stack>
    </Surface>
  );
}
