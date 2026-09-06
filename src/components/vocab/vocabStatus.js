import { MASTERED_BOX, srsKey } from '../../lib/srs';

export const BROWSE_PAGE_SIZE = 50;

/**
 * First-match status for one card in one deck. Mastered wins over due so a
 * box-5 card that has come around again still reads as mastered.
 */
export function statusForCard({ card, deckId, srs = {}, now = Date.now() } = {}) {
  if (!card?.id || !deckId) return 'new';
  const entry = srs[srsKey(deckId, card.id)];
  if (!entry) return 'new';
  if (entry.box === MASTERED_BOX) return 'mastered';
  if (entry.nextDue <= now) return 'due';
  return 'learned';
}
