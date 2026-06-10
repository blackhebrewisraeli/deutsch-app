import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInput from './ChatInput';

const baseProps = {
  input: '',
  setInput: () => {},
  listening: false,
  thinking: false,
  onSend: () => {},
  onStartListening: () => {},
  onStopListening: () => {},
};

describe('ChatInput', () => {
  it('forwards typing to setInput', async () => {
    const setInput = vi.fn();
    render(<ChatInput {...baseProps} setInput={setInput} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Chat message in German' }), 'Ha');
    expect(setInput).toHaveBeenCalledWith('H');
    expect(setInput).toHaveBeenCalledWith('a');
  });

  it('submits on Enter', async () => {
    const onSend = vi.fn();
    render(<ChatInput {...baseProps} input="Hallo" onSend={onSend} />);
    await userEvent.type(screen.getByRole('textbox'), '{Enter}');
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('submits from the send button', async () => {
    const onSend = vi.fn();
    render(<ChatInput {...baseProps} input="Hallo" onSend={onSend} />);
    await userEvent.click(screen.getByRole('button', { name: 'Send chat message' }));
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('disables send while the input is empty', () => {
    render(<ChatInput {...baseProps} input="   " />);
    expect(screen.getByRole('button', { name: 'Send chat message' })).toBeDisabled();
  });

  it('disables send while Anna is thinking', () => {
    render(<ChatInput {...baseProps} input="Hallo" thinking />);
    expect(screen.getByRole('button', { name: 'Send chat message' })).toBeDisabled();
  });

  it('mic button starts listening when idle and stops when listening', async () => {
    const onStartListening = vi.fn();
    const onStopListening = vi.fn();
    const { rerender } = render(
      <ChatInput
        {...baseProps}
        onStartListening={onStartListening}
        onStopListening={onStopListening}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Start voice input' }));
    expect(onStartListening).toHaveBeenCalledTimes(1);

    rerender(
      <ChatInput
        {...baseProps}
        listening
        onStartListening={onStartListening}
        onStopListening={onStopListening}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Stop voice input' }));
    expect(onStopListening).toHaveBeenCalledTimes(1);
  });

  it('switches the placeholder while listening', () => {
    render(<ChatInput {...baseProps} listening />);
    expect(screen.getByPlaceholderText('Sprich auf Deutsch...')).toBeInTheDocument();
  });
});
