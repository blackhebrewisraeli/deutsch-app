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
});
