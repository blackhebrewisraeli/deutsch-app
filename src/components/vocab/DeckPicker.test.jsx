import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeckPicker from './DeckPicker';
import { AUTO_DECKS } from '../../packs/de/autoDecks';
import { MAX_CUSTOM_DECKS } from '../../lib/customDecks';

const props = {
  deckId: 'greetings',
  onSelect: () => {},
  customDecks: {},
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

    rerender(
      <DeckPicker
        {...props}
        customDecks={{ custom: { name: 'weather', cards: [{ id: 'a' }, { id: 'b' }] } }}
      />
    );
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

  it('names filter chips by the deck only — no emoji in the accessible name', () => {
    render(<DeckPicker {...props} />);
    const topics = AUTO_DECKS.filter((d) => d.group === 'Topics');
    for (const d of topics) {
      const chip = screen.getByRole('button', { name: d.name });
      expect(chip).toHaveTextContent(d.name);
      expect(chip.textContent).not.toContain(d.icon);
    }
  });

  it('titles groups as clean labels, without a letter box', () => {
    render(<DeckPicker {...props} />);
    expect(screen.getByText('Frequency')).toBeInTheDocument();
    expect(screen.getByText('Topics')).toBeInTheDocument();
    // The old SectionLabel painted a standalone letter (F, C, T, …) in a
    // black square. Those letters must not remain as their own nodes.
    for (const letter of ['F', 'C', 'T', 'A', 'P', 'G', 'B']) {
      expect(screen.queryByText(letter, { exact: true })).not.toBeInTheDocument();
    }
  });

  it('constrains the column so chips cannot scatter across a wide viewport', () => {
    const { container } = render(<DeckPicker {...props} />);
    const root = container.firstChild;
    expect(root).toHaveStyle({
      maxWidth: '448px',
      marginLeft: 'auto',
      marginRight: 'auto',
    });
  });

  it('keeps filter chips flat — a border, no drop shadow', () => {
    render(<DeckPicker {...props} />);
    const chip = screen.getByRole('button', { name: 'Lifestyle' });
    expect(chip).toHaveStyle({ boxShadow: 'none' });
    expect(chip.style.border).not.toBe('none');
    expect(chip.style.border).not.toBe('');
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

describe('DeckPicker with a collection', () => {
  const two = {
    'custom-a': { name: 'weather', cards: [{ id: 'a' }, { id: 'b' }] },
    'custom-b': { name: 'food', cards: [{ id: 'c' }] },
  };

  it('renders one row per custom deck, not a single slot', () => {
    render(<DeckPicker {...props} customDecks={two} />);
    expect(screen.getAllByRole('button', { name: /Your Deck/ })).toHaveLength(2);
  });

  it('reports the deck id that was picked, not a literal', () => {
    const onSelect = vi.fn();
    render(<DeckPicker {...props} customDecks={two} onSelect={onSelect} />);
    screen.getAllByRole('button', { name: /Your Deck/ })[1].click();
    expect(onSelect).toHaveBeenCalledWith('custom-b');
  });

  it('gives each deck its OWN remove control, carrying that deck id', async () => {
    const onDelete = vi.fn();
    render(<DeckPicker {...props} customDecks={two} onDelete={onDelete} />);
    const removes = screen.getAllByRole('button', { name: /^Remove / });
    expect(removes).toHaveLength(2);
    await userEvent.click(removes[0]);
    expect(onDelete).toHaveBeenCalledWith('custom-a');
  });

  it('keeps remove a SIBLING of select for every row', () => {
    // A <button> inside a <button> is invalid HTML and browsers un-nest it.
    render(<DeckPicker {...props} customDecks={two} onDelete={() => {}} />);
    const selects = screen.getAllByRole('button', { name: /Your Deck/ });
    const removes = screen.getAllByRole('button', { name: /^Remove / });
    selects.forEach((sel, i) => expect(sel.contains(removes[i])).toBe(false));
  });

  it('shows each deck its own card count, singular where it should be', () => {
    render(<DeckPicker {...props} customDecks={two} />);
    expect(screen.getByText('2 cards')).toBeInTheDocument();
    expect(screen.getByText('1 card')).toBeInTheDocument();
    expect(screen.queryByText('1 cards')).toBeNull();
  });

  it('renders exactly what the single-slot version did for ONE deck', () => {
    // The pure-refactor guarantee.
    render(<DeckPicker {...props} customDecks={{ custom: { name: 'x', cards: [{ id: 'a' }] } }} />);
    expect(screen.getAllByRole('button', { name: /Your Deck/ })).toHaveLength(1);
    expect(screen.getByText('1 card')).toBeInTheDocument();
  });
});

describe('DeckPicker names and the cap', () => {
  const two = {
    'custom-a': { name: 'weather', cards: [{ id: 'a' }, { id: 'b' }] },
    'custom-b': { name: 'food', cards: [{ id: 'c' }] },
  };

  it('shows each deck by the topic it was made from', () => {
    render(<DeckPicker {...props} customDecks={two} />);
    expect(screen.getByText(/weather/)).toBeInTheDocument();
    expect(screen.getByText(/food/)).toBeInTheDocument();
  });

  it('names the deck for a screen reader, since a sparkle says nothing', () => {
    render(<DeckPicker {...props} customDecks={two} />);
    expect(
      screen.getByRole('button', { name: 'Your Deck: weather — 2 cards' })
    ).toBeInTheDocument();
    // …and the singular reaches a screen reader too, not just the visible row.
    expect(screen.getByRole('button', { name: 'Your Deck: food — 1 card' })).toBeInTheDocument();
  });

  it('names the deck on its remove control too', () => {
    render(<DeckPicker {...props} customDecks={two} onDelete={() => {}} />);
    expect(screen.getByRole('button', { name: 'Remove weather' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove food' })).toBeInTheDocument();
  });

  it('falls back to a label when a deck somehow has no name', () => {
    render(<DeckPicker {...props} customDecks={{ x: { name: '', cards: [{ id: 'a' }] } }} />);
    expect(screen.getByText(/unnamed|Your Deck/)).toBeInTheDocument();
  });

  it('lets a learner generate while below the cap', () => {
    render(<DeckPicker {...props} customTopic="weather" atCap={false} />);
    expect(screen.getByRole('button', { name: /GENERATE 10 CARDS/ })).toBeEnabled();
    expect(screen.getByRole('textbox', { name: 'Custom deck topic' })).toBeEnabled();
  });

  it('disables generation at the cap — control AND field', () => {
    render(<DeckPicker {...props} customTopic="weather" atCap maxDecks={MAX_CUSTOM_DECKS} />);
    expect(screen.getByRole('button', { name: /GENERATE 10 CARDS/ })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Custom deck topic' })).toBeDisabled();
  });

  it('says WHY it is disabled — a dead control with no reason is a dead end', () => {
    render(<DeckPicker {...props} atCap maxDecks={MAX_CUSTOM_DECKS} />);
    const note = screen.getByRole('status');
    expect(note).toHaveTextContent(String(MAX_CUSTOM_DECKS));
    expect(note).toHaveTextContent(/remove one/i);
  });

  it('shows no cap note below the cap', () => {
    render(<DeckPicker {...props} atCap={false} />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('does not generate on Enter once at the cap', async () => {
    const onGenerate = vi.fn();
    render(<DeckPicker {...props} customTopic="weather" atCap onGenerate={onGenerate} />);
    const field = screen.getByRole('textbox', { name: 'Custom deck topic' });
    await userEvent.type(field, '{Enter}');
    expect(onGenerate).not.toHaveBeenCalled();
  });
});

describe('DeckPicker pluralisation', () => {
  it.each([
    [1, '1 card'],
    [2, '2 cards'],
    [10, '10 cards'],
    [0, '0 cards'],
  ])('renders %i as "%s"', (n, expected) => {
    const cards = Array.from({ length: n }, (_, i) => ({ id: `c${i}` }));
    render(<DeckPicker {...props} customDecks={{ x: { name: 'deck', cards } }} />);
    // getAllBy, not getBy: the four curated rows also read "10 cards", so the
    // n=10 case would collide with them.
    expect(screen.getAllByText(expected).length).toBeGreaterThan(0);
  });

  it('pluralises the preset rows on the same rule', () => {
    render(<DeckPicker {...props} />);
    // The curated decks are ten cards each — the rule still has to be applied,
    // or the next authored deck of one card reintroduces the bug.
    expect(screen.getAllByText('10 cards').length).toBeGreaterThan(0);
  });
});
