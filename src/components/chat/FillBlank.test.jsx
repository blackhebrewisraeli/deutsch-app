import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FillBlank from './FillBlank';
import { parseScaffold } from '../../lib/chatInputModes';

const scaffold = parseScaffold({
  de: 'Ich möchte einen Kaffee, bitte.',
  en: "I'd like a coffee, please.",
  blank: 'Kaffee',
  distractors: ['Tee', 'Wasser'],
});

function renderGap(props) {
  const handlers = { onSend: vi.fn(), onSwitchToTyping: vi.fn() };
  render(<FillBlank scaffold={scaffold} thinking={false} {...handlers} {...props} />);
  return handlers;
}

describe('FillBlank — choice', () => {
  it('offers the answer and distractors in the gap and sends the whole sentence', async () => {
    const { onSend } = renderGap({ mode: 'choice' });
    const gap = screen.getByRole('combobox', { name: 'Missing word' });
    const offered = within(gap)
      .getAllByRole('option')
      .map((o) => o.textContent)
      .filter((t) => t !== '…')
      .sort();
    expect(offered).toEqual(['Kaffee', 'Tee', 'Wasser']);
    expect(screen.getByRole('group', { name: 'Your sentence' })).toHaveTextContent(
      /^Ich möchte einen .*, bitte\.$/
    );

    const send = screen.getByRole('button', { name: 'Send chat message' });
    expect(send).toBeDisabled();
    await userEvent.selectOptions(gap, 'Tee');
    await userEvent.click(send);
    expect(onSend).toHaveBeenCalledWith('Ich möchte einen Tee, bitte.');
  });
});

describe('FillBlank — typed', () => {
  it('sends the typed word inside the sentence on Enter and clears the gap', async () => {
    const { onSend } = renderGap({ mode: 'typed' });
    const gap = screen.getByRole('textbox', { name: 'Missing word' });
    await userEvent.type(gap, 'Kaffee{Enter}');
    expect(onSend).toHaveBeenCalledWith('Ich möchte einen Kaffee, bitte.');
    expect(gap).toHaveValue('');
  });

  it('keeps send disabled while the tutor is thinking', async () => {
    const { onSend } = renderGap({ mode: 'typed', thinking: true });
    await userEvent.type(screen.getByRole('textbox', { name: 'Missing word' }), 'Kaffee{Enter}');
    expect(screen.getByRole('button', { name: 'Send chat message' })).toBeDisabled();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('offers the escape hatch to free typing', async () => {
    const { onSwitchToTyping } = renderGap({ mode: 'typed' });
    await userEvent.click(screen.getByRole('button', { name: 'Type instead' }));
    expect(onSwitchToTyping).toHaveBeenCalled();
  });

  it('renders the gap at 16px so iOS does not zoom on focus', () => {
    renderGap({ mode: 'typed' });
    expect(screen.getByRole('textbox', { name: 'Missing word' })).toHaveStyle({
      fontSize: '16px',
    });
  });
});
