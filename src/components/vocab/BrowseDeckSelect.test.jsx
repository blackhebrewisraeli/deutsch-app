import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BrowseDeckSelect from './BrowseDeckSelect';

const browseSelect = () => screen.getByRole('combobox', { name: /select a deck to browse/i });

describe('BrowseDeckSelect', () => {
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

  it('can leave an unknown deck id for a preset', async () => {
    const onSelect = vi.fn();
    render(<BrowseDeckSelect deckId="custom-big" onSelect={onSelect} />);
    expect(browseSelect()).toHaveValue('');
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
