import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VocabTable from './VocabTable';
import { BROWSE_PAGE_SIZE, statusForCard } from './vocabStatus';
import { MASTERED_BOX, srsKey } from '../../lib/srs';
import { TEXT } from '../../lib/theme';
import { toVocabRows } from '../../lib/vocabRows';

const breadCard = {
  id: 'n:brot',
  de: 'das Brot',
  lemma: 'Brot',
  en: 'bread',
  glosses: ['bread', 'loaf'],
  ipa: '/bʁoːt/',
  article: 'das',
  cefr: 'A1',
  tags: ['food'],
};
const waterCard = { id: 'das Wasser', de: 'das Wasser', en: 'water' };

const now = 1_000_000;

const rowsOf = (cards, over = {}) => toVocabRows({ cards, deckId: 'food', now, ...over });

describe('statusForCard', () => {
  const bread = { id: 'das Brot', de: 'das Brot', en: 'bread', ipa: '/bʁoːt/' };

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

  it('is learning when an SRS row is not due and the card is not in a learned map', () => {
    const srs = {
      [srsKey('food', bread.id)]: { box: 2, nextDue: now + 10, lastReviewed: 1, reps: 2 },
    };
    expect(statusForCard({ card: bread, deckId: 'food', srs, now })).toBe('learning');
  });

  it('is learned only when a learned map says so, not merely because SRS is not due', () => {
    const srs = {
      [srsKey('food', bread.id)]: { box: 2, nextDue: now + 10, lastReviewed: 1, reps: 2 },
    };
    expect(
      statusForCard({
        card: bread,
        deckId: 'food',
        srs,
        now,
        learnedByDeck: { food: { [bread.id]: true } },
      })
    ).toBe('learned');
    expect(
      statusForCard({
        card: bread,
        deckId: 'food',
        srs,
        now,
        learnedWords: { [bread.id]: true },
      })
    ).toBe('learned');
    expect(
      statusForCard({
        card: bread,
        deckId: 'food',
        srs,
        now,
        learnedByDeck: { travel: { [bread.id]: true } },
      })
    ).toBe('learning');
  });
});

describe('VocabTable', () => {
  it('renders term, article, meaning, IPA, level, category and status', () => {
    render(<VocabTable rows={rowsOf([breadCard, waterCard])} caption="Food" />);
    expect(screen.getByRole('columnheader', { name: 'Term' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Article' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Meaning' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'IPA' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Level' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Category' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
    expect(screen.getByText('Brot')).toBeInTheDocument();
    expect(screen.getByText('das')).toBeInTheDocument();
    expect(screen.getByText('bread · loaf')).toBeInTheDocument();
    expect(screen.getByText('/bʁoːt/')).toBeInTheDocument();
    expect(screen.getByText('A1')).toBeInTheDocument();
    expect(screen.getByText('food')).toBeInTheDocument();
    expect(screen.getByText('das Wasser')).toBeInTheDocument();
    expect(screen.getAllByText('New')).toHaveLength(2);
  });

  it('renders IPA through TEXT.ipa so θ and χ stay on the mono face', () => {
    render(<VocabTable rows={rowsOf([breadCard])} />);
    expect(screen.getByText('/bʁoːt/')).toHaveStyle({
      fontFamily: TEXT.ipa.fontFamily,
      fontSize: TEXT.ipa.fontSize,
    });
  });

  it('prints Learned only when the learned maps say so', () => {
    const srs = {
      [srsKey('food', breadCard.id)]: { box: 2, nextDue: now + 10, lastReviewed: 1, reps: 2 },
      [srsKey('food', waterCard.id)]: { box: 1, nextDue: now - 1, lastReviewed: 1, reps: 1 },
    };
    render(
      <VocabTable
        rows={rowsOf([breadCard, waterCard], {
          srs,
          learnedByDeck: { food: { [breadCard.id]: true } },
        })}
      />
    );
    expect(screen.getByText('Learned')).toBeInTheDocument();
    // Both rows are below mastered, so both print Learning; Learned is additive.
    expect(screen.getAllByText('Learning')).toHaveLength(2);
    expect(screen.getByText('Due')).toBeInTheDocument();
    expect(screen.queryByText('Mastered')).not.toBeInTheDocument();
  });

  it('labels mastered and due from the SRS row without calling an SRS-not-due card Learned', () => {
    const srs = {
      [srsKey('food', breadCard.id)]: {
        box: MASTERED_BOX,
        nextDue: now + 10,
        lastReviewed: 1,
        reps: 8,
      },
      [srsKey('food', waterCard.id)]: { box: 1, nextDue: now - 1, lastReviewed: 1, reps: 1 },
    };
    render(<VocabTable rows={rowsOf([breadCard, waterCard], { srs })} />);
    expect(screen.getByText('Mastered')).toBeInTheDocument();
    expect(screen.getByText('Due')).toBeInTheDocument();
    expect(screen.queryByText('Learned')).not.toBeInTheDocument();
  });

  it('renders the rows it is given — paging belongs to the caller', () => {
    const cards = Array.from({ length: BROWSE_PAGE_SIZE + 10 }, (_, i) => ({
      id: `w-${i}`,
      de: `Wort ${i}`,
      en: `word ${i}`,
    }));
    render(<VocabTable rows={rowsOf(cards)} />);
    expect(
      screen.queryByText(`Showing ${BROWSE_PAGE_SIZE} of ${cards.length}`)
    ).not.toBeInTheDocument();
    expect(screen.getByText('Wort 0')).toBeInTheDocument();
    expect(screen.getByText(`Wort ${BROWSE_PAGE_SIZE}`)).toBeInTheDocument();
  });

  it('stacks as a list on mobile instead of a wide table', () => {
    render(<VocabTable rows={rowsOf([breadCard])} mobile caption="Food" />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Food' })).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.textContent === 'das Brot')).toBeInTheDocument();
    expect(screen.getByText('bread · loaf')).toBeInTheDocument();
  });

  it('renders nothing for an empty deck — the parent owns the empty copy', () => {
    const { container } = render(<VocabTable rows={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows emptyMessage instead of silently rendering nothing when the caller asks', () => {
    render(<VocabTable rows={[]} emptyMessage="No words match this search." />);
    expect(screen.getByRole('status')).toHaveTextContent('No words match this search.');
  });

  it('expands a row and fires Practise', async () => {
    const onToggleExpand = vi.fn();
    const onPractice = vi.fn();
    const rows = rowsOf([breadCard]);
    render(
      <VocabTable
        rows={rows}
        expandedId={null}
        onToggleExpand={onToggleExpand}
        onPractice={onPractice}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Show details for das Brot' }));
    expect(onToggleExpand).toHaveBeenCalledWith('n:brot');
    await userEvent.click(screen.getByRole('button', { name: 'Practise das Brot' }));
    expect(onPractice).toHaveBeenCalledWith(rows[0]);
  });
});
