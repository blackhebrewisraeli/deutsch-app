import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VocabBrowse, { BROWSE_SCOPE_LABEL, CUSTOM_PICK_COPY } from './VocabBrowse';
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
    expect(screen.getByText(BROWSE_SCOPE_LABEL)).toBeInTheDocument();
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

  it('hides the deck selector when showSelector is false', () => {
    render(
      <VocabBrowse
        showSelector={false}
        title="weather"
        cards={[bread]}
        deckId="custom-1"
        srs={{}}
        now={1}
      />
    );
    expect(screen.queryByRole('combobox', { name: BROWSE_SCOPE_LABEL })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'weather' })).toBeInTheDocument();
    expect(screen.getByText('das Brot')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /GENERATE/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
  });

  it('shows the pick-a-custom-deck copy when that is the empty message', () => {
    render(
      <VocabBrowse
        showSelector={false}
        title=""
        cards={[]}
        deckId="greetings"
        emptyMessage={CUSTOM_PICK_COPY}
      />
    );
    expect(screen.getByText(CUSTOM_PICK_COPY)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('skips the empty paragraph when emptyMessage is blank', () => {
    const { container } = render(
      <VocabBrowse showSelector={false} title="" cards={[]} deckId="greetings" emptyMessage="" />
    );
    expect(container.querySelector('p')).toBeNull();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('selects a preset or auto deck through the shared onSelectDeck path', async () => {
    const onSelectDeck = vi.fn();
    render(
      <VocabBrowse
        title="Greetings"
        cards={[bread]}
        deckId="greetings"
        srs={{}}
        now={1}
        onSelectDeck={onSelectDeck}
      />
    );
    const select = screen.getByRole('combobox', { name: BROWSE_SCOPE_LABEL });
    expect(select).toHaveValue('greetings');
    await userEvent.selectOptions(select, 'travel');
    expect(onSelectDeck).toHaveBeenCalledWith('travel');
    await userEvent.selectOptions(select, 'core-100');
    expect(onSelectDeck).toHaveBeenCalledWith('core-100');
    expect(screen.queryByRole('button', { name: /GENERATE/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
  });

  it('names the selector from the visible Choose a deck label', () => {
    render(<VocabBrowse title="Greetings" cards={[bread]} deckId="greetings" srs={{}} now={1} />);
    expect(screen.getByRole('combobox', { name: BROWSE_SCOPE_LABEL })).toHaveAccessibleName(
      BROWSE_SCOPE_LABEL
    );
  });

  it('shows the current custom deck in the selector while listing its rows', () => {
    render(
      <VocabBrowse
        title="weather"
        cards={[bread]}
        deckId="custom-1"
        selectableCustomDecks={{ 'custom-1': weatherDeck }}
        srs={{}}
        now={1}
      />
    );
    const select = screen.getByRole('combobox', { name: BROWSE_SCOPE_LABEL });
    expect(select).toHaveValue('custom-1');
    expect(select).toHaveDisplayValue('weather');
    expect(screen.getByText('das Brot')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /GENERATE/ })).not.toBeInTheDocument();
  });
});
