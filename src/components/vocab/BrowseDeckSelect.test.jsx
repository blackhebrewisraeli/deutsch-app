import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BrowseDeckSelect, { BROWSE_SCOPE_LABEL } from './BrowseDeckSelect';

const browseSelect = () => screen.getByRole('combobox', { name: BROWSE_SCOPE_LABEL });

describe('BrowseDeckSelect', () => {
  it('is named by the visible Choose a deck label', () => {
    render(<BrowseDeckSelect deckId="greetings" onSelect={() => {}} />);
    const label = screen.getByText(BROWSE_SCOPE_LABEL);
    expect(label).toBeInTheDocument();
    expect(label).toHaveStyle({ display: 'block' });
    expect(browseSelect()).toHaveAccessibleName(BROWSE_SCOPE_LABEL);
  });

  it('marks the current deck and offers Greetings, Travel, and Core 100', () => {
    render(<BrowseDeckSelect deckId="greetings" onSelect={() => {}} />);
    expect(browseSelect()).toHaveValue('greetings');
    expect(screen.getByRole('option', { name: 'Travel' })).toHaveValue('travel');
    expect(screen.getByRole('option', { name: 'Core 100' })).toHaveValue('core-100');
  });

  it('calls onSelect with the shared deck id', async () => {
    const onSelect = vi.fn();
    render(<BrowseDeckSelect deckId="greetings" onSelect={onSelect} />);
    await userEvent.selectOptions(browseSelect(), 'travel');
    expect(onSelect).toHaveBeenCalledWith('travel');
    await userEvent.selectOptions(browseSelect(), 'core-100');
    expect(onSelect).toHaveBeenCalledWith('core-100');
  });

  it('falls back to the disabled placeholder for an unknown deck id', async () => {
    const onSelect = vi.fn();
    render(
      <BrowseDeckSelect
        deckId="stale-deleted"
        onSelect={onSelect}
        customDecks={{ 'custom-big': { name: 'Big Deck' } }}
      />
    );
    expect(browseSelect()).toHaveValue('');
    expect(browseSelect()).toHaveDisplayValue('Select a deck');
    expect(screen.getByRole('option', { name: 'Select a deck' })).toBeDisabled();
    await userEvent.selectOptions(browseSelect(), 'greetings');
    expect(onSelect).toHaveBeenCalledWith('greetings');
  });

  it('shows the current custom deck instead of the placeholder', () => {
    render(
      <BrowseDeckSelect
        deckId="custom-big"
        onSelect={() => {}}
        customDecks={{ 'custom-big': { name: 'Big Deck' } }}
      />
    );
    expect(browseSelect()).toHaveValue('custom-big');
    expect(browseSelect()).toHaveDisplayValue('Big Deck');
    expect(screen.getByRole('option', { name: 'Big Deck' })).toHaveValue('custom-big');
  });

  it('can leave a custom deck for a preset', async () => {
    const onSelect = vi.fn();
    render(
      <BrowseDeckSelect
        deckId="custom-big"
        onSelect={onSelect}
        customDecks={{ 'custom-big': { name: 'Big Deck' } }}
      />
    );
    await userEvent.selectOptions(browseSelect(), 'greetings');
    expect(onSelect).toHaveBeenCalledWith('greetings');
  });

  it('does not offer generate or trash', () => {
    render(<BrowseDeckSelect deckId="greetings" onSelect={() => {}} />);
    expect(screen.queryByRole('button', { name: /GENERATE/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('hides B1 CEFR decks from an A1 learner', () => {
    render(<BrowseDeckSelect deckId="greetings" onSelect={() => {}} level="a1" />);
    const values = screen.getAllByRole('option').map((o) => o.value);
    expect(values).toContain('cefr-a1');
    expect(values).not.toContain('cefr-b1');
    expect(values).not.toContain('artikel-b1');
  });

  it('offers the B1 CEFR deck once classified B1', () => {
    render(<BrowseDeckSelect deckId="greetings" onSelect={() => {}} level="b1" />);
    const values = screen.getAllByRole('option').map((o) => o.value);
    expect(values).toContain('cefr-b1');
  });

  it('hides Interests until a topic deck is passed', () => {
    render(<BrowseDeckSelect deckId="greetings" onSelect={() => {}} />);
    expect(screen.queryByRole('option', { name: 'Sport' })).not.toBeInTheDocument();
  });

  it('lists enabled interest decks under Interests', async () => {
    const onSelect = vi.fn();
    render(
      <BrowseDeckSelect
        deckId="greetings"
        onSelect={onSelect}
        interestDecks={[{ id: 'interest-sport', name: 'Sport' }]}
      />
    );
    expect(screen.getByRole('option', { name: 'Sport' })).toHaveValue('interest-sport');
    await userEvent.selectOptions(browseSelect(), 'interest-sport');
    expect(onSelect).toHaveBeenCalledWith('interest-sport');
  });
});
