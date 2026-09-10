import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BrowseDeckSelect from './BrowseDeckSelect';

describe('BrowseDeckSelect', () => {
  it('marks the current deck and offers Greetings, Travel, and Core 100', () => {
    render(<BrowseDeckSelect deckId="greetings" onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: 'Greetings' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Travel' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Core 100' })).toBeInTheDocument();
  });

  it('calls onSelect with the shared deck id', async () => {
    const onSelect = vi.fn();
    render(<BrowseDeckSelect deckId="greetings" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: 'Travel' }));
    expect(onSelect).toHaveBeenCalledWith('travel');
    await userEvent.click(screen.getByRole('button', { name: 'Core 100' }));
    expect(onSelect).toHaveBeenCalledWith('core-100');
  });

  it('does not offer generate or trash', () => {
    render(<BrowseDeckSelect deckId="greetings" onSelect={() => {}} />);
    expect(screen.queryByRole('button', { name: /GENERATE/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
