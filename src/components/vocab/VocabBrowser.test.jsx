import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VocabBrowser from './VocabBrowser';
import { toVocabRows, ROWS_PER_PAGE } from '../../lib/vocabRows';
import { srsKey } from '../../lib/srs';

const NOW = 1_000_000;

const card = (i, over = {}) => ({
  id: `w-${i}`,
  de: `Wort ${i}`,
  en: `word ${i}`,
  ...over,
});

const bread = {
  id: 'n:brot',
  de: 'das Brot',
  lemma: 'Brot',
  en: 'bread',
  glosses: ['bread', 'loaf'],
  article: 'das',
  cefr: 'A1',
  tags: ['food'],
};

describe('VocabBrowser', () => {
  it('pages past the first 50 rows of a large deck', async () => {
    const rows = toVocabRows({
      cards: Array.from({ length: 60 }, (_, i) => card(i)),
      deckId: 'core-100',
      now: NOW,
    });
    render(<VocabBrowser rows={rows} deckId="core-100" deckName="Core 100" />);
    expect(screen.getByText(/showing 1–50 of 60 in this deck/i)).toBeInTheDocument();
    expect(screen.getByText('Wort 0')).toBeInTheDocument();
    expect(screen.queryByText('Wort 50')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/showing 51–60 of 60/i)).toBeInTheDocument();
    expect(screen.getByText('Wort 50')).toBeInTheDocument();
    expect(screen.queryByText('Wort 0')).not.toBeInTheDocument();
    expect(screen.getByText(`Page 2 of ${Math.ceil(60 / ROWS_PER_PAGE)}`)).toBeInTheDocument();
  });

  it('finds a row by umlaut-folded search', async () => {
    const rows = toVocabRows({
      cards: [
        bread,
        { id: 'n:kaese', de: 'der Käse', lemma: 'Käse', en: 'cheese', glosses: ['cheese'] },
      ],
      deckId: 'food',
      now: NOW,
    });
    render(<VocabBrowser rows={rows} deckId="food" deckName="Food" />);
    await userEvent.type(screen.getByRole('searchbox'), 'kase');
    expect(screen.getByText('Käse')).toBeInTheDocument();
    expect(screen.queryByText('Brot')).not.toBeInTheDocument();
  });

  it('narrows to the learned filter using the learned maps, not SRS-not-due', async () => {
    const srs = {
      [srsKey('food', bread.id)]: { box: 2, nextDue: NOW + 10, lastReviewed: 1, reps: 2 },
      [srsKey('food', 'n:kaese')]: { box: 2, nextDue: NOW + 10, lastReviewed: 1, reps: 2 },
    };
    const rows = toVocabRows({
      cards: [
        bread,
        { id: 'n:kaese', de: 'der Käse', lemma: 'Käse', en: 'cheese', glosses: ['cheese'] },
      ],
      deckId: 'food',
      srs,
      learnedByDeck: { food: { [bread.id]: true } },
      now: NOW,
    });
    render(<VocabBrowser rows={rows} deckId="food" deckName="Food" />);
    await userEvent.click(screen.getByRole('button', { name: /Learned/ }));
    expect(screen.getByText('Brot')).toBeInTheDocument();
    expect(screen.queryByText('Käse')).not.toBeInTheDocument();
  });

  it('resets the page when the deck changes', async () => {
    const first = toVocabRows({
      cards: Array.from({ length: 60 }, (_, i) => card(i)),
      deckId: 'a',
      now: NOW,
    });
    const second = toVocabRows({
      cards: [card(0, { de: 'Neu', en: 'new' })],
      deckId: 'b',
      now: NOW,
    });
    const { rerender } = render(<VocabBrowser rows={first} deckId="a" deckName="A" />);
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Wort 50')).toBeInTheDocument();
    rerender(<VocabBrowser rows={second} deckId="b" deckName="B" />);
    expect(screen.getByText('Neu')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  });

  it('keeps status chips on one scrolling row on mobile', () => {
    const rows = toVocabRows({ cards: [bread], deckId: 'food', now: NOW });
    render(<VocabBrowser rows={rows} deckId="food" deckName="Food" mobile />);
    const group = screen.getByRole('group', { name: 'Filter by status' });
    expect(group).toHaveStyle({ flexWrap: 'nowrap', overflowX: 'auto' });
    expect(screen.getByRole('searchbox')).toHaveAttribute('placeholder', 'Search this deck');
  });

  it('offers Practise on a row', async () => {
    const onPractice = vi.fn();
    const rows = toVocabRows({ cards: [bread], deckId: 'food', now: NOW });
    render(<VocabBrowser rows={rows} deckId="food" deckName="Food" onPractice={onPractice} />);
    await userEvent.click(screen.getByRole('button', { name: 'Practise das Brot' }));
    expect(onPractice).toHaveBeenCalledWith(rows[0]);
  });
});
