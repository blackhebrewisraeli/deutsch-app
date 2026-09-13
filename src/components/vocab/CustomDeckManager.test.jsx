import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CustomDeckManager, { CUSTOM_EMPTY_COPY, CUSTOM_SCOPE_LABEL } from './CustomDeckManager';
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

describe('CustomDeckManager', () => {
  it('does not render preset or auto decks — those stay on Practice', () => {
    render(<CustomDeckManager {...props} />);
    expect(screen.queryByRole('button', { name: /Greetings/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Food & Drink/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Frequency')).not.toBeInTheDocument();
  });

  it('shows generate and the rewritten empty copy when there are no decks', () => {
    render(<CustomDeckManager {...props} />);
    expect(screen.getByText(CUSTOM_SCOPE_LABEL)).toBeInTheDocument();
    expect(screen.getByText(CUSTOM_EMPTY_COPY)).toBeInTheDocument();
    expect(CUSTOM_EMPTY_COPY).not.toMatch(/view-only/i);
    expect(CUSTOM_EMPTY_COPY).not.toMatch(/Practice/);
    expect(screen.getByRole('textbox', { name: 'Custom deck topic' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /GENERATE 10 CARDS/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
  });

  it('blocks generation on an empty topic and while a generation is running', () => {
    const { rerender } = render(<CustomDeckManager {...props} />);
    expect(screen.getByRole('button', { name: /GENERATE 10 CARDS/ })).toBeDisabled();

    rerender(<CustomDeckManager {...props} customTopic="weather" />);
    expect(screen.getByRole('button', { name: /GENERATE 10 CARDS/ })).toBeEnabled();

    rerender(<CustomDeckManager {...props} customTopic="weather" generating />);
    expect(screen.getByRole('button', { name: /GENERATING/ })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Custom deck topic' })).toBeDisabled();
  });

  it('generates on Enter from the topic field', async () => {
    const onGenerate = vi.fn();
    render(<CustomDeckManager {...props} customTopic="weather" onGenerate={onGenerate} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Custom deck topic' }), '{Enter}');
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });
});

describe('CustomDeckManager with a collection', () => {
  const two = {
    'custom-a': { name: 'weather', cards: [{ id: 'a' }, { id: 'b' }] },
    'custom-b': { name: 'food', cards: [{ id: 'c' }] },
  };

  it('renders one selectable row per custom deck', () => {
    render(<CustomDeckManager {...props} customDecks={two} />);
    expect(screen.getAllByRole('button', { name: /Your Deck/ })).toHaveLength(2);
  });

  it('reports the deck id that was picked, not a literal', () => {
    const onSelect = vi.fn();
    render(<CustomDeckManager {...props} customDecks={two} onSelect={onSelect} />);
    screen.getAllByRole('button', { name: /Your Deck/ })[1].click();
    expect(onSelect).toHaveBeenCalledWith('custom-b');
  });

  it('asks before deleting — first trash click does not call onDelete', async () => {
    const onDelete = vi.fn();
    render(<CustomDeckManager {...props} customDecks={two} onDelete={onDelete} />);
    const removes = screen.getAllByRole('button', { name: /^Remove / });
    expect(removes).toHaveLength(2);
    await userEvent.click(removes[0]);
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText("Remove weather? Cards can't be recovered.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove weather permanently' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('dismisses the confirmation on Cancel and still does not delete', async () => {
    const onDelete = vi.fn();
    render(<CustomDeckManager {...props} customDecks={two} onDelete={onDelete} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove weather' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByText(/Cards can't be recovered/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove weather' })).toBeInTheDocument();
  });

  it('deletes only after confirm, once, with that deck id', async () => {
    const onDelete = vi.fn();
    render(<CustomDeckManager {...props} customDecks={two} onDelete={onDelete} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove weather' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove weather permanently' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith('custom-a');
  });

  it('arms only one deck at a time', async () => {
    const onDelete = vi.fn();
    render(<CustomDeckManager {...props} customDecks={two} onDelete={onDelete} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove weather' }));
    expect(screen.getByText("Remove weather? Cards can't be recovered.")).toBeInTheDocument();
    expect(screen.queryByText("Remove food? Cards can't be recovered.")).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove food' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Remove food' }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText("Remove food? Cards can't be recovered.")).toBeInTheDocument();
    expect(screen.queryByText("Remove weather? Cards can't be recovered.")).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove weather' })).toBeInTheDocument();
  });

  it('keeps remove a SIBLING of select for every row', () => {
    render(<CustomDeckManager {...props} customDecks={two} onDelete={() => {}} />);
    const selects = screen.getAllByRole('button', { name: /Your Deck/ });
    const removes = screen.getAllByRole('button', { name: /^Remove / });
    selects.forEach((sel, i) => expect(sel.contains(removes[i])).toBe(false));
  });

  it('shows each deck its own card count, singular where it should be', () => {
    render(<CustomDeckManager {...props} customDecks={two} />);
    expect(screen.getByText('2 cards')).toBeInTheDocument();
    expect(screen.getByText('1 card')).toBeInTheDocument();
    expect(screen.queryByText('1 cards')).toBeNull();
  });
});

describe('CustomDeckManager names and the cap', () => {
  const two = {
    'custom-a': { name: 'weather', cards: [{ id: 'a' }, { id: 'b' }] },
    'custom-b': { name: 'food', cards: [{ id: 'c' }] },
  };

  it('shows each deck by the topic it was made from', () => {
    render(<CustomDeckManager {...props} customDecks={two} />);
    expect(screen.getByText(/weather/)).toBeInTheDocument();
    expect(screen.getByText(/food/)).toBeInTheDocument();
  });

  it('names the deck for a screen reader, since a sparkle says nothing', () => {
    render(<CustomDeckManager {...props} customDecks={two} />);
    expect(
      screen.getByRole('button', { name: 'Your Deck: weather — 2 cards' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Your Deck: food — 1 card' })).toBeInTheDocument();
  });

  it('names the deck on its remove control too', () => {
    render(<CustomDeckManager {...props} customDecks={two} onDelete={() => {}} />);
    expect(screen.getByRole('button', { name: 'Remove weather' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove food' })).toBeInTheDocument();
  });

  it('falls back to a label when a deck somehow has no name', () => {
    render(
      <CustomDeckManager {...props} customDecks={{ x: { name: '', cards: [{ id: 'a' }] } }} />
    );
    expect(screen.getByText(/unnamed|Your Deck/)).toBeInTheDocument();
  });

  it('lets a learner generate while below the cap', () => {
    render(<CustomDeckManager {...props} customTopic="weather" atCap={false} />);
    expect(screen.getByRole('button', { name: /GENERATE 10 CARDS/ })).toBeEnabled();
    expect(screen.getByRole('textbox', { name: 'Custom deck topic' })).toBeEnabled();
  });

  it('disables generation at the cap — control AND field', () => {
    render(
      <CustomDeckManager {...props} customTopic="weather" atCap maxDecks={MAX_CUSTOM_DECKS} />
    );
    expect(screen.getByRole('button', { name: /GENERATE 10 CARDS/ })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Custom deck topic' })).toBeDisabled();
  });

  it('says WHY it is disabled — a dead control with no reason is a dead end', () => {
    render(<CustomDeckManager {...props} atCap maxDecks={MAX_CUSTOM_DECKS} />);
    const note = screen.getByRole('status');
    expect(note).toHaveTextContent(String(MAX_CUSTOM_DECKS));
    expect(note).toHaveTextContent(/remove one/i);
  });

  it('shows no cap note below the cap', () => {
    render(<CustomDeckManager {...props} atCap={false} />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('does not generate on Enter once at the cap', async () => {
    const onGenerate = vi.fn();
    render(<CustomDeckManager {...props} customTopic="weather" atCap onGenerate={onGenerate} />);
    const field = screen.getByRole('textbox', { name: 'Custom deck topic' });
    await userEvent.type(field, '{Enter}');
    expect(onGenerate).not.toHaveBeenCalled();
  });
});

describe('CustomDeckManager delete confirmation — accessibility', () => {
  const two = {
    'custom-a': { name: 'weather', cards: [{ id: 'a' }, { id: 'b' }] },
    'custom-b': { name: 'food', cards: [{ id: 'c' }] },
  };

  function Collection({ initial }) {
    const [decks, setDecks] = useState(initial);
    return (
      <CustomDeckManager
        {...props}
        customDecks={decks}
        onDelete={(id) =>
          setDecks((current) =>
            Object.fromEntries(Object.entries(current).filter(([k]) => k !== id))
          )
        }
      />
    );
  }

  const armedStrip = (deckName) =>
    screen.getByText(`Remove ${deckName}? Cards can't be recovered.`).closest('div');

  const confirmButton = (deckName) =>
    within(armedStrip(deckName)).getByRole('button', { name: /remove/i });

  it('names the deck on the destructive button, not only on the trash it replaced', async () => {
    render(<CustomDeckManager {...props} customDecks={two} onDelete={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove weather' }));

    expect(confirmButton('weather')).toHaveAccessibleName('Remove weather permanently');
  });

  it('announces the confirmation — the copy sits in a live region', async () => {
    render(<CustomDeckManager {...props} customDecks={two} onDelete={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove weather' }));

    expect(screen.getByRole('status')).toHaveTextContent(
      "Remove weather? Cards can't be recovered."
    );
  });

  it('moves focus to the confirm rather than dropping it on <body>', async () => {
    render(<CustomDeckManager {...props} customDecks={two} onDelete={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove weather' }));

    expect(confirmButton('weather')).toHaveFocus();
  });

  it('returns focus to the trash it came from on Cancel', async () => {
    render(<CustomDeckManager {...props} customDecks={two} onDelete={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove weather' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('button', { name: 'Remove weather' })).toHaveFocus();
  });

  it('hands focus to a surviving row after the deck is deleted', async () => {
    render(<Collection initial={two} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove weather' }));
    await userEvent.click(confirmButton('weather'));

    expect(screen.getByRole('button', { name: 'Remove food' })).toHaveFocus();
  });

  it('cancels on Escape, like every other dismissible affordance', async () => {
    const onDelete = vi.fn();
    render(<CustomDeckManager {...props} customDecks={two} onDelete={onDelete} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove weather' }));
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByText(/Cards can't be recovered/)).not.toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Remove weather' })).toHaveFocus();
  });
});
