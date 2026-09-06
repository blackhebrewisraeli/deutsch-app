import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VocabBrowse from './VocabBrowse';
import * as storage from '../../lib/storage';

const bread = { id: 'das Brot', de: 'das Brot', en: 'bread', ipa: '/bʁoːt/' };

const weatherDeck = {
  name: 'weather',
  cards: [bread],
};

describe('VocabBrowse', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the title and a row for each card', () => {
    render(<VocabBrowse title="Food & Drink" cards={[bread]} deckId="food" srs={{}} now={1} />);
    expect(screen.getByRole('heading', { name: 'Food & Drink' })).toBeInTheDocument();
    expect(screen.getByText('das Brot')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Term' })).toBeInTheDocument();
  });

  it('does not read storage or Date.now during render', () => {
    const loadSpy = vi.spyOn(storage, 'loadState');
    const nowSpy = vi.spyOn(Date, 'now');
    render(<VocabBrowse title="Food & Drink" cards={[bread]} deckId="food" srs={{}} now={1} />);
    expect(loadSpy).not.toHaveBeenCalled();
    expect(nowSpy).not.toHaveBeenCalled();
    loadSpy.mockRestore();
    nowSpy.mockRestore();
  });

  it('pages a 60-card deck so row 51 is reachable', async () => {
    const cards = Array.from({ length: 60 }, (_, i) => ({
      id: `w-${i}`,
      de: `Wort ${i}`,
      en: `word ${i}`,
    }));
    render(<VocabBrowse title="Core 100" cards={cards} deckId="core-100" srs={{}} now={1} />);
    expect(screen.getByText(/showing 1–50 of 60/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Wort 50')).toBeInTheDocument();
    expect(screen.getByText(/showing 51–60 of 60/i)).toBeInTheDocument();
  });

  it('shows the empty copy when there are no cards', () => {
    render(
      <VocabBrowse
        title="Food & Drink"
        cards={[]}
        deckId="food"
        emptyMessage="Select a deck to browse."
      />
    );
    expect(screen.getByText('Select a deck to browse.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows a loading state instead of the table', () => {
    render(<VocabBrowse title="Core 100" cards={[]} deckId="core-100" loading />);
    expect(screen.getByText('Loading deck…')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows an error note with a retry action', async () => {
    const onRetry = vi.fn();
    render(<VocabBrowse title="Core 100" cards={[]} deckId="core-100" error onRetry={onRetry} />);
    expect(screen.getByText('Could not load this deck.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('lists custom decks without a remove control', () => {
    render(
      <VocabBrowse
        title="weather"
        cards={[bread]}
        deckId="custom-1"
        customDecks={{ 'custom-1': weatherDeck }}
        emptyMessage="Generate a deck on Practice to see it here."
      />
    );
    expect(screen.getByRole('button', { name: /weather/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
    expect(screen.getByText('das Brot')).toBeInTheDocument();
  });

  it('shows the custom empty copy when there are no user decks', () => {
    render(
      <VocabBrowse
        title=""
        cards={[]}
        deckId="greetings"
        customDecks={{}}
        emptyMessage="Generate a deck on Practice to see it here."
      />
    );
    expect(screen.getByText('Generate a deck on Practice to see it here.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('asks the learner to pick a custom deck when a preset is selected', () => {
    render(
      <VocabBrowse
        title="Greetings"
        cards={[{ id: 'Hallo', de: 'Hallo', en: 'hello' }]}
        deckId="greetings"
        customDecks={{ 'custom-1': weatherDeck }}
        onSelectDeck={() => {}}
      />
    );
    expect(screen.getByText('Select a custom deck to inspect it.')).toBeInTheDocument();
    expect(screen.queryByText('Hallo')).not.toBeInTheDocument();
  });

  it('selects a custom deck without offering a trash control', async () => {
    const onSelectDeck = vi.fn();
    render(
      <VocabBrowse
        title="weather"
        cards={[]}
        deckId="greetings"
        customDecks={{ 'custom-1': weatherDeck }}
        onSelectDeck={onSelectDeck}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /weather/ }));
    expect(onSelectDeck).toHaveBeenCalledWith('custom-1');
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
  });
});
