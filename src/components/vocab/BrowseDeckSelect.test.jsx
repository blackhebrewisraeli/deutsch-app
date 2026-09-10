import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BrowseDeckSelect, { CUSTOM_GROUP_LABEL, PRESET_GROUP_LABEL } from './BrowseDeckSelect';
import { AUTO_DECKS, DECK_GROUPS } from '../../packs/de/autoDecks';

describe('BrowseDeckSelect', () => {
  it('is a compact grouped select, not a chip wall', () => {
    const { container } = render(<BrowseDeckSelect deckId="greetings" onSelect={() => {}} />);
    const select = screen.getByRole('combobox', { name: 'Deck' });
    expect(select.tagName).toBe('SELECT');
    expect(select).toHaveValue('greetings');
    expect(select).toHaveStyle({ width: '100%', minWidth: '0', maxWidth: '100%' });
    const groups = [...container.querySelectorAll('optgroup')].map((g) => g.label);
    expect(groups[0]).toBe(PRESET_GROUP_LABEL);
    expect(groups).not.toContain('Curated');
    expect(groups.slice(1)).toEqual(DECK_GROUPS.filter((g) => g !== 'Curated'));
    expect(screen.getByRole('option', { name: 'Travel' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Core 100' })).toBeInTheDocument();
    for (const deck of AUTO_DECKS) {
      expect(screen.getByRole('option', { name: deck.name })).toBeInTheDocument();
    }
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /GENERATE/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
  });

  it('calls onSelect with the chosen deck id', async () => {
    const onSelect = vi.fn();
    render(<BrowseDeckSelect deckId="greetings" onSelect={onSelect} />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Deck' }), 'travel');
    expect(onSelect).toHaveBeenCalledWith('travel');
  });

  it('includes a custom deck among the options', () => {
    const { container } = render(
      <BrowseDeckSelect
        deckId="custom-1"
        onSelect={() => {}}
        customDecks={{ 'custom-1': { name: 'weather', cards: [{ id: 'a' }] } }}
      />
    );
    expect(screen.getByRole('combobox', { name: 'Deck' })).toHaveValue('custom-1');
    expect(screen.getByRole('option', { name: 'weather' })).toBeInTheDocument();
    expect([...container.querySelectorAll('optgroup')].map((g) => g.label)).toContain(
      CUSTOM_GROUP_LABEL
    );
  });
});
