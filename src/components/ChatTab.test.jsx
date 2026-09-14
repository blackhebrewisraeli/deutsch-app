import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatTab from './ChatTab';
import { callClaude } from '../lib/claude';
import { speak } from '../lib/speech';

vi.mock('../lib/claude', () => ({
  callClaude: vi.fn(),
}));

vi.mock('../lib/speech', () => ({ speak: vi.fn() }));

const reply = JSON.stringify({ de: 'Hallo!', ipa: '[haˈloː]', en: 'Hello!' });

// The old autoplay used 400ms (greeting) and 200ms (reply). Wait past both
// with a real timer so a setTimeout speak cannot sneak through.
const AUTOPLAY_WINDOW_MS = 500;

async function expectNoAutoSpeech() {
  await new Promise((resolve) => setTimeout(resolve, AUTOPLAY_WINDOW_MS));
  expect(speak).not.toHaveBeenCalled();
}

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

describe('ChatTab speech', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callClaude.mockResolvedValue(reply);
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('does not speak when the tab mounts with the greeting', async () => {
    render(<ChatTab />);
    expect(screen.getByText('Hallo! Womit möchtest du heute üben?')).toBeInTheDocument();
    await expectNoAutoSpeech();
  });

  it('does not speak when Chat remounts (tab switch)', async () => {
    const { unmount } = render(<ChatTab />);
    await expectNoAutoSpeech();
    unmount();
    vi.clearAllMocks();
    render(<ChatTab />);
    expect(screen.getByText('Hallo! Womit möchtest du heute üben?')).toBeInTheDocument();
    await expectNoAutoSpeech();
  });

  it('does not speak when the user picks a different scenario', async () => {
    render(<ChatTab />);
    await userEvent.click(screen.getByRole('radio', { name: 'Order Coffee scenario' }));
    expect(screen.getByText('Willkommen im Café! Was möchten Sie bestellen?')).toBeInTheDocument();
    await expectNoAutoSpeech();
  });

  it('does not speak when an assistant reply arrives', async () => {
    render(<ChatTab />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Chat message in German' }), 'Hallo');
    await userEvent.click(screen.getByRole('button', { name: 'Send chat message' }));
    await waitFor(() => {
      expect(screen.getByText('Hallo!')).toBeInTheDocument();
    });
    await expectNoAutoSpeech();
  });

  it('speaks when the user clicks play on an Anna message', async () => {
    render(<ChatTab />);
    await userEvent.click(screen.getByRole('button', { name: 'Play Anna response audio' }));
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith('Hallo! Womit möchtest du heute üben?');
  });
});
