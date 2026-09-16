import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeckPicker from './DeckPicker';
import { AUTO_DECKS, DECK_GROUPS } from '../../packs/de/autoDecks';

const AUTO_GROUPS = DECK_GROUPS.filter((g) => g !== 'Curated');

const props = {
  deckId: 'greetings',
  onSelect: () => {},
  customDecks: {},
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
    expect(screen.queryByRole('tab', { name: 'Curated' })).not.toBeInTheDocument();
    const other = AUTO_DECKS.find((d) => d.group !== 'Curated');
    if (other) {
      expect(screen.getByRole('button', { name: new RegExp(other.name) })).toBeInTheDocument();
    }
  });

  it('names auto-deck rows by the deck only — no emoji in the accessible name', async () => {
    render(<DeckPicker {...props} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Topics' }));
    const topics = AUTO_DECKS.filter((d) => d.group === 'Topics');
    for (const d of topics) {
      const row = screen.getByRole('button', { name: d.name });
      expect(row).toHaveTextContent(d.name);
      expect(row.textContent).not.toContain(d.icon);
    }
  });

  it('titles groups as clean labels, without a letter box', () => {
    render(<DeckPicker {...props} />);
    expect(screen.getByRole('tab', { name: 'Frequency' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Topics' })).toBeInTheDocument();
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

  it('keeps group tabs flat — a border, no drop shadow', () => {
    render(<DeckPicker {...props} />);
    const tab = screen.getByRole('tab', { name: 'Topics' });
    expect(tab).toHaveStyle({ boxShadow: 'none' });
    expect(tab.style.border).not.toBe('none');
    expect(tab.style.border).not.toBe('');
  });

  it('reports the deck the user picked', async () => {
    const onSelect = vi.fn();
    render(<DeckPicker {...props} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: /Numbers/ }));
    expect(onSelect).toHaveBeenCalledWith('numbers');
  });

  it('does not render generate or custom-deck trash — those live on Custom', () => {
    render(
      <DeckPicker {...props} customDecks={{ custom: { name: 'weather', cards: [{ id: 'a' }] } }} />
    );
    expect(screen.queryByRole('button', { name: /GENERATE/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Custom deck topic' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Generate Custom/i)).not.toBeInTheDocument();
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

  it('shows each deck its own card count, singular where it should be', () => {
    render(<DeckPicker {...props} customDecks={two} />);
    expect(screen.getByText('2 cards')).toBeInTheDocument();
    expect(screen.getByText('1 card')).toBeInTheDocument();
    expect(screen.queryByText('1 cards')).toBeNull();
  });

  it('renders exactly what the single-slot version did for ONE deck', () => {
    render(<DeckPicker {...props} customDecks={{ custom: { name: 'x', cards: [{ id: 'a' }] } }} />);
    expect(screen.getAllByRole('button', { name: /Your Deck/ })).toHaveLength(1);
    expect(screen.getByText('1 card')).toBeInTheDocument();
  });
});

describe('DeckPicker names', () => {
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
    expect(screen.getByRole('button', { name: 'Your Deck: food — 1 card' })).toBeInTheDocument();
  });

  it('falls back to a label when a deck somehow has no name', () => {
    render(<DeckPicker {...props} customDecks={{ x: { name: '', cards: [{ id: 'a' }] } }} />);
    expect(screen.getByText(/unnamed|Your Deck/)).toBeInTheDocument();
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
    expect(screen.getAllByText('10 cards').length).toBeGreaterThan(0);
  });
});

describe('DeckPicker auto-deck tabs', () => {
  it('exposes a labelled tablist for every non-Curated group', () => {
    render(<DeckPicker {...props} />);
    expect(screen.getByRole('tablist', { name: 'Auto decks' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(AUTO_GROUPS.length);
    for (const group of AUTO_GROUPS) {
      expect(screen.getByRole('tab', { name: group })).toBeInTheDocument();
    }
  });

  it('defaults to the first auto group and hides the rest of the decks', () => {
    render(<DeckPicker {...props} />);
    expect(screen.getByRole('tab', { name: AUTO_GROUPS[0] })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    for (const d of AUTO_DECKS.filter((deck) => deck.group === AUTO_GROUPS[0])) {
      expect(screen.getByRole('button', { name: new RegExp(d.name) })).toBeInTheDocument();
    }
    const hidden = AUTO_DECKS.find((d) => d.group !== AUTO_GROUPS[0] && d.group !== 'Curated');
    expect(screen.queryByRole('button', { name: hidden.name })).not.toBeInTheDocument();
  });

  it('points the selected tab at a stable panel id', () => {
    render(<DeckPicker {...props} />);
    const frequency = screen.getByRole('tab', { name: 'Frequency' });
    expect(frequency).toHaveAttribute('id', 'deck-group-tab-frequency');
    expect(frequency).toHaveAttribute('aria-controls', 'deck-group-panel-frequency');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'deck-group-panel-frequency');
    expect(screen.getByRole('tabpanel')).toHaveAttribute(
      'aria-labelledby',
      'deck-group-tab-frequency'
    );
  });

  it('lists the active group as full-width rows, not a chip wrap', () => {
    render(<DeckPicker {...props} />);
    const row = screen.getByRole('button', { name: /Core 100/ });
    expect(row).toHaveStyle({ width: '100%', display: 'flex' });
    expect(row).toHaveTextContent('100 cards');
  });

  it('lets the tab strip scroll inside the picker instead of wrapping', () => {
    render(<DeckPicker {...props} />);
    expect(screen.getByRole('tablist', { name: 'Auto decks' })).toHaveStyle({
      overflowX: 'auto',
      minWidth: '0',
      flexWrap: 'nowrap',
    });
  });

  it('switching tabs reveals that group and hides the previous one', async () => {
    render(<DeckPicker {...props} />);
    expect(screen.getByRole('button', { name: /Core 100/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Topics' }));
    expect(screen.getByRole('tab', { name: 'Topics' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('button', { name: /Core 100/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lifestyle' })).toBeInTheDocument();
  });

  it('reports the auto deck the user picked', async () => {
    const onSelect = vi.fn();
    render(<DeckPicker {...props} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Topics' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lifestyle' }));
    expect(onSelect).toHaveBeenCalledWith('tag-lifestyle');
  });

  it('opens the group that contains the current auto deck', () => {
    render(<DeckPicker {...props} deckId="tag-lifestyle" />);
    expect(screen.getByRole('tab', { name: 'Topics' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Lifestyle' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.queryByRole('button', { name: /Core 100/ })).not.toBeInTheDocument();
  });

  it('follows deckId onto a new auto group, but not back onto a preset', () => {
    const { rerender } = render(<DeckPicker {...props} />);
    expect(screen.getByRole('tab', { name: 'Frequency' })).toHaveAttribute('aria-selected', 'true');
    rerender(<DeckPicker {...props} deckId="artikel-a1" />);
    expect(screen.getByRole('tab', { name: 'Artikel' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: /A1 Nouns/ })).toBeInTheDocument();

    rerender(<DeckPicker {...props} deckId="greetings" />);
    expect(screen.getByRole('tab', { name: 'Artikel' })).toHaveAttribute('aria-selected', 'true');
  });

  it('is one tab stop in the strip, with arrow keys moving focus within it', async () => {
    render(<DeckPicker {...props} />);
    expect(screen.getByRole('tab', { name: 'Frequency' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'CEFR' })).toHaveAttribute('tabindex', '-1');

    screen.getByRole('tab', { name: 'Frequency' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'CEFR' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'CEFR' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Frequency' })).toHaveAttribute('tabindex', '-1');
  });

  it('moves focus across groups without committing the panel', async () => {
    render(<DeckPicker {...props} />);
    screen.getByRole('tab', { name: 'Frequency' }).focus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{Home}{End}{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Gegenteil' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Frequency' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: /Core 100/ })).toBeInTheDocument();
  });

  it.each([
    ['{ }', 'Space'],
    ['{Enter}', 'Enter'],
  ])('commits the focused group on %s', async (key) => {
    render(<DeckPicker {...props} />);
    screen.getByRole('tab', { name: 'Frequency' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: /Core 100/ })).toBeInTheDocument();
    await userEvent.keyboard(key);
    expect(screen.getByRole('tab', { name: 'CEFR' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('button', { name: /Core 100/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'A1' })).toBeInTheDocument();
  });

  it('wraps at the ends and supports Home/End', async () => {
    render(<DeckPicker {...props} />);
    const at = (name) => screen.getByRole('tab', { name });
    screen.getByRole('tab', { name: 'Frequency' }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(at(AUTO_GROUPS[AUTO_GROUPS.length - 1])).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(at('Frequency')).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(at(AUTO_GROUPS[AUTO_GROUPS.length - 1])).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(at('Frequency')).toHaveFocus();
  });

  it('hands the tab stop back to the selected tab when focus leaves', async () => {
    render(<DeckPicker {...props} />);
    screen.getByRole('tab', { name: 'Frequency' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'CEFR' })).toHaveAttribute('tabindex', '0');
    await userEvent.tab();
    expect(screen.getByRole('button', { name: /Core 100/ })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Frequency' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'CEFR' })).toHaveAttribute('tabindex', '-1');
  });
});
