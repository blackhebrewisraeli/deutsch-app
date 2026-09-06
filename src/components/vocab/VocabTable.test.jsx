import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import VocabTable from './VocabTable';
import { BROWSE_PAGE_SIZE, statusForCard } from './vocabStatus';
import { MASTERED_BOX, srsKey } from '../../lib/srs';
import { TEXT } from '../../lib/theme';

const bread = { id: 'das Brot', de: 'das Brot', en: 'bread', ipa: '/bʁoːt/' };
const water = { id: 'das Wasser', de: 'das Wasser', en: 'water' };

const now = 1_000_000;

describe('statusForCard', () => {
  it('is new when the card has no SRS row', () => {
    expect(statusForCard({ card: bread, deckId: 'food', srs: {}, now })).toBe('new');
  });

  it('is mastered when the box is 5, even if the card is also due', () => {
    const srs = {
      [srsKey('food', bread.id)]: { box: MASTERED_BOX, nextDue: now - 1, lastReviewed: 1, reps: 8 },
    };
    expect(statusForCard({ card: bread, deckId: 'food', srs, now })).toBe('mastered');
  });

  it('is due when nextDue has passed and the card is not mastered', () => {
    const srs = {
      [srsKey('food', bread.id)]: { box: 2, nextDue: now - 1, lastReviewed: 1, reps: 2 },
    };
    expect(statusForCard({ card: bread, deckId: 'food', srs, now })).toBe('due');
  });

  it('is learned when the card has an SRS row that is not yet due', () => {
    const srs = {
      [srsKey('food', bread.id)]: { box: 2, nextDue: now + 10, lastReviewed: 1, reps: 2 },
    };
    expect(statusForCard({ card: bread, deckId: 'food', srs, now })).toBe('learned');
  });
});

describe('VocabTable', () => {
  it('renders one row per card with term, meaning, IPA and status', () => {
    render(<VocabTable cards={[bread, water]} deckId="food" srs={{}} now={now} caption="Food" />);
    expect(screen.getByRole('columnheader', { name: 'Term' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Meaning' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'IPA' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
    expect(screen.getByText('das Brot')).toBeInTheDocument();
    expect(screen.getByText('bread')).toBeInTheDocument();
    expect(screen.getByText('/bʁoːt/')).toBeInTheDocument();
    expect(screen.getByText('das Wasser')).toBeInTheDocument();
    expect(screen.getAllByText('New')).toHaveLength(2);
  });

  it('renders IPA through TEXT.ipa so θ and χ stay on the mono face', () => {
    render(<VocabTable cards={[bread]} deckId="food" srs={{}} now={now} />);
    expect(screen.getByText('/bʁoːt/')).toHaveStyle({
      fontFamily: TEXT.ipa.fontFamily,
      fontSize: TEXT.ipa.fontSize,
    });
  });

  it('labels each status from the SRS row', () => {
    const srs = {
      [srsKey('food', bread.id)]: {
        box: MASTERED_BOX,
        nextDue: now + 10,
        lastReviewed: 1,
        reps: 8,
      },
      [srsKey('food', water.id)]: { box: 1, nextDue: now - 1, lastReviewed: 1, reps: 1 },
    };
    render(<VocabTable cards={[bread, water]} deckId="food" srs={srs} now={now} />);
    expect(screen.getByText('Mastered')).toBeInTheDocument();
    expect(screen.getByText('Due')).toBeInTheDocument();
  });

  it(`caps at ${BROWSE_PAGE_SIZE} rows and reports the hidden remainder`, () => {
    const cards = Array.from({ length: BROWSE_PAGE_SIZE + 10 }, (_, i) => ({
      id: `w-${i}`,
      de: `Wort ${i}`,
      en: `word ${i}`,
    }));
    render(<VocabTable cards={cards} deckId="core-100" srs={{}} now={now} />);
    expect(screen.getByText(`Showing ${BROWSE_PAGE_SIZE} of ${cards.length}`)).toBeInTheDocument();
    expect(screen.getByText('Wort 0')).toBeInTheDocument();
    expect(screen.getByText(`Wort ${BROWSE_PAGE_SIZE - 1}`)).toBeInTheDocument();
    expect(screen.queryByText(`Wort ${BROWSE_PAGE_SIZE}`)).not.toBeInTheDocument();
  });

  it('stacks as a list on mobile instead of a wide table', () => {
    render(<VocabTable cards={[bread]} deckId="food" srs={{}} now={now} mobile caption="Food" />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Food' })).toBeInTheDocument();
    expect(screen.getByText('das Brot')).toBeInTheDocument();
    expect(screen.getByText('bread')).toBeInTheDocument();
  });

  it('renders nothing for an empty deck — the parent owns the empty copy', () => {
    const { container } = render(<VocabTable cards={[]} deckId="food" srs={{}} now={now} />);
    expect(container).toBeEmptyDOMElement();
  });
});
