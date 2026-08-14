import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeckPicker from './DeckPicker';
import { AUTO_DECKS } from '../../packs/de/autoDecks';

const props = {
  deckId: 'greetings',
  onSelect: () => {},
  customCards: null,
  customTopic: '',
  onTopicChange: () => {},
  generating: false,
  onGenerate: () => {},
};

describe('DeckPicker', () => {
  it('renders the four curated decks', () => {
    render(<DeckPicker {...props} />);
    for (const name of ['Greetings', 'Food & Drink', 'Travel', 'Numbers']) {
      expect(screen.getByRole('button', { name: new RegExp(name) })).toBeInTheDocument();
    }
  });

  it('marks only the selected deck as pressed', () => {
    render(<DeckPicker {...props} deckId="travel" />);
    expect(screen.getByRole('button', { name: /Travel/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Greetings/ })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('hides the custom deck entry until one has been generated', () => {
    const { rerender } = render(<DeckPicker {...props} />);
    expect(screen.queryByRole('button', { name: /Your Deck/ })).not.toBeInTheDocument();

    rerender(<DeckPicker {...props} customCards={[{ id: 'a' }, { id: 'b' }]} />);
    const custom = screen.getByRole('button', { name: /Your Deck/ });
    expect(custom).toBeInTheDocument();
    expect(custom).toHaveTextContent('2 cards');
  });

  it('offers the lexicon-derived decks but never the Curated group', () => {
    // Curated is the preset list rendered above; showing it twice would give
    // two controls for the same deck.
    render(<DeckPicker {...props} />);
    const curated = AUTO_DECKS.filter((d) => d.group === 'Curated');
    for (const d of curated) {
      expect(screen.queryByRole('button', { name: new RegExp(d.name) })).not.toBeInTheDocument();
    }
    const other = AUTO_DECKS.find((d) => d.group !== 'Curated');
    if (other) {
      expect(screen.getByRole('button', { name: new RegExp(other.name) })).toBeInTheDocument();
    }
  });

  it('reports the deck the user picked', async () => {
    const onSelect = vi.fn();
    render(<DeckPicker {...props} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: /Numbers/ }));
    expect(onSelect).toHaveBeenCalledWith('numbers');
  });

  it('blocks generation on an empty topic and while a generation is running', () => {
    const { rerender } = render(<DeckPicker {...props} />);
    expect(screen.getByRole('button', { name: /GENERATE 10 CARDS/ })).toBeDisabled();

    rerender(<DeckPicker {...props} customTopic="weather" />);
    expect(screen.getByRole('button', { name: /GENERATE 10 CARDS/ })).toBeEnabled();

    rerender(<DeckPicker {...props} customTopic="weather" generating />);
    expect(screen.getByRole('button', { name: /GENERATING/ })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Custom deck topic' })).toBeDisabled();
  });

  it('generates on Enter from the topic field', async () => {
    const onGenerate = vi.fn();
    render(<DeckPicker {...props} customTopic="weather" onGenerate={onGenerate} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Custom deck topic' }), '{Enter}');
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it('carries the source attribution the content licences require', () => {
    render(<DeckPicker {...props} />);
    expect(
      screen.getByText(/Wiktionary \(CC BY-SA\), Tatoeba & Leipzig \(CC BY\)/)
    ).toBeInTheDocument();
  });
});
