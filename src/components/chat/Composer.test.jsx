import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Composer from './Composer';
import { INPUT_MODES, parseScaffold } from '../../lib/chatInputModes';

const { WORD_BANK, CHOICE_BLANK, TYPED_BLANK, FREE_TEXT } = INPUT_MODES;

const scaffold = parseScaffold({
  de: 'Ich möchte einen Kaffee, bitte.',
  en: "I'd like a coffee, please.",
  blank: 'Kaffee',
  distractors: ['Tee', 'Wasser'],
});

const freeText = {
  input: '',
  setInput: vi.fn(),
  listening: false,
  onStartListening: vi.fn(),
  onStopListening: vi.fn(),
};

function renderComposer(props) {
  const onChooseStage = vi.fn();
  render(
    <Composer
      stage={WORD_BANK}
      moved={null}
      scaffold={scaffold}
      turnKey={1}
      thinking={false}
      onSend={vi.fn()}
      onChooseStage={onChooseStage}
      freeText={freeText}
      {...props}
    />
  );
  return { onChooseStage };
}

describe('Composer', () => {
  it('word blocks: tiles are the tokens plus the distractors, with the Say line', () => {
    renderComposer();
    const tiles = within(screen.getByRole('group', { name: 'Word bank' }))
      .getAllByRole('button')
      .map((b) => b.textContent)
      .sort();
    expect(tiles).toEqual(['Ich', 'Kaffee,', 'Tee', 'Wasser', 'bitte.', 'einen', 'möchte'].sort());
    expect(screen.getByText("Say: I'd like a coffee, please.")).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 4 · Build the sentence')).toBeInTheDocument();
  });

  it.each([
    [CHOICE_BLANK, 'combobox', 'Step 2 of 4 · Choose the word'],
    [TYPED_BLANK, 'textbox', 'Step 3 of 4 · Type the word'],
  ])('%s renders the gap and its step', (stage, role, label) => {
    renderComposer({ stage });
    expect(screen.getByRole(role, { name: 'Missing word' })).toBeInTheDocument();
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('free writing: the typing composer, no Say line, and a way back to word blocks', async () => {
    const { onChooseStage } = renderComposer({ stage: FREE_TEXT });
    expect(screen.getByRole('textbox', { name: 'Chat message in German' })).toBeInTheDocument();
    expect(screen.queryByText(/^Say:/)).not.toBeInTheDocument();
    expect(screen.getByText('Step 4 of 4 · Free writing')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Use word bank' }));
    expect(onChooseStage).toHaveBeenCalledWith(WORD_BANK);
  });

  it('falls back to free text without a usable scaffold, hiding the step and the hatch', () => {
    renderComposer({ scaffold: null });
    expect(screen.getByRole('textbox', { name: 'Chat message in German' })).toBeInTheDocument();
    expect(screen.queryByText(/^Step /)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use word bank' })).not.toBeInTheDocument();
  });

  it('"Type instead" chooses free writing', async () => {
    const { onChooseStage } = renderComposer({ stage: CHOICE_BLANK });
    await userEvent.click(screen.getByRole('button', { name: 'Type instead' }));
    expect(onChooseStage).toHaveBeenCalledWith(FREE_TEXT);
  });

  it.each([
    ['up', CHOICE_BLANK, 'Nice — next step: Choose the word'],
    ['down', WORD_BANK, "Let's add some help: Build the sentence"],
  ])('announces a move %s', (moved, stage, note) => {
    renderComposer({ stage, moved });
    expect(screen.getByRole('status')).toHaveTextContent(note);
  });

  it('keeps the live region mounted but silent when nothing moved', () => {
    renderComposer();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});
