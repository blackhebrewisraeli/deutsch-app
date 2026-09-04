import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatTab from './ChatTab';
import { callClaude } from '../lib/claude';

vi.mock('../lib/claude', () => ({
  callClaude: vi.fn(),
}));

vi.mock('../lib/speech', () => ({ speak: vi.fn() }));

const reply = JSON.stringify({ de: 'Hallo!', ipa: '[haˈloː]', en: 'Hello!' });

describe('ChatTab routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callClaude.mockResolvedValue(reply);
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('sends chat routingContext, defaulting userTier to guest', async () => {
    render(<ChatTab />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Chat message in German' }), 'Hallo');
    await userEvent.click(screen.getByRole('button', { name: 'Send chat message' }));

    expect(callClaude).toHaveBeenCalledWith(expect.any(String), 'Hallo', expect.any(Array), {
      routingContext: { taskType: 'chat', userTier: 'guest' },
    });
  });
});
