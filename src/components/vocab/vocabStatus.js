import { MASTERED_BOX, srsKey } from '../../lib/srs';
import { isLearned } from '../../lib/learnedWords';
export { ROWS_PER_PAGE as BROWSE_PAGE_SIZE } from '../../lib/vocabRows';

/**
 * First-match status for one card in one deck. Mastered wins over due so a
 * box-5 card that has come around again still reads as mastered.
 *
 * `learned` is the same predicate the Practice badge uses (`isLearned`), not
 * "has an SRS row that is not yet due". An unseen-in-the-maps card with a
 * future nextDue is `learning`.
 */
export function statusForCard({
  card,
  deckId,
  srs = {},
  now = Date.now(),
  learnedWords = null,
  learnedByDeck = null,
} = {}) {
  if (!card?.id || !deckId) return 'new';
  const entry = srs[srsKey(deckId, card.id)];
  if (!entry) return 'new';
  if (entry.box === MASTERED_BOX) return 'mastered';
  if (entry.nextDue <= now) return 'due';
  if (isLearned({ learnedByDeck, learnedWords, deckId, cardId: card.id })) return 'learned';
  return 'learning';
}
