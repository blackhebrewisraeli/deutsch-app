import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MessageBubble from './MessageBubble';
import { speak } from '../../lib/speech';

vi.mock('../../lib/speech', () => ({
  speak: vi.fn(),
}));

const annaMsg = {
  role: 'assistant',
  de: 'Guten Tag!',
  en: 'Good day!',
  ipa: '[ˈɡuːtn̩ taːk]',
};

const userMsg = { role: 'user', de: 'Hallo Anna' };

describe('MessageBubble', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders an Anna message with name tag, translation, and audio button', () => {
    render(<MessageBubble msg={annaMsg} />);
    expect(screen.getByText('— ANNA')).toBeInTheDocument();
    expect(screen.getByText('Guten Tag!')).toBeInTheDocument();
    expect(screen.getByText('Good day!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play Anna response audio' })).toBeInTheDocument();
  });

  it('renders a user message with the DU tag and no audio button', () => {
    render(<MessageBubble msg={userMsg} />);
    expect(screen.getByText('DU')).toBeInTheDocument();
    expect(screen.getByText('Hallo Anna')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Play Anna response audio' })
    ).not.toBeInTheDocument();
  });

  it('shows the IPA line when present and hides it when absent', () => {
    const { rerender } = render(<MessageBubble msg={annaMsg} />);
    expect(screen.getByText('[ˈɡuːtn̩ taːk]')).toBeInTheDocument();
    rerender(<MessageBubble msg={{ ...annaMsg, ipa: undefined }} />);
    expect(screen.queryByText('[ˈɡuːtn̩ taːk]')).not.toBeInTheDocument();
  });

  it('omits the translation line when en is missing', () => {
    render(<MessageBubble msg={{ role: 'assistant', de: 'Tschüss!' }} />);
    expect(screen.getByText('Tschüss!')).toBeInTheDocument();
    expect(screen.queryByText('Good day!')).not.toBeInTheDocument();
  });

  it('speaks the German text from the audio button', async () => {
    render(<MessageBubble msg={annaMsg} />);
    await userEvent.click(screen.getByRole('button', { name: 'Play Anna response audio' }));
    expect(speak).toHaveBeenCalledWith('Guten Tag!');
  });
});
