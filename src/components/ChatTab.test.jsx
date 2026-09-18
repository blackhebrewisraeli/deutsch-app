import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatTab from './ChatTab';
import { callClaude } from '../lib/claude';
import { speak } from '../lib/speech';
import { setUserLevel } from '../lib/levelPref';
import { activePack } from '../packs';

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

async function sendHallo() {
  await userEvent.type(screen.getByRole('textbox', { name: 'Chat message in German' }), 'Hallo');
  await userEvent.click(screen.getByRole('button', { name: 'Send chat message' }));
}

describe('ChatTab routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    callClaude.mockResolvedValue(reply);
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('sends chat routingContext, defaulting userTier to guest', async () => {
    render(<ChatTab />);
    await sendHallo();

    expect(callClaude).toHaveBeenCalledWith(expect.any(String), 'Hallo', expect.any(Array), {
      routingContext: { taskType: 'chat', userTier: 'guest' },
      level: 'a1',
      vocab: expect.any(Array),
    });
  });
});

describe('ChatTab classified CEFR and vocab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    callClaude.mockResolvedValue(reply);
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('ignores a b1 prop when classification is a1', () => {
    render(<ChatTab level="b1" />);
    expect(screen.getByText('Say hello and tell Anna your name.')).toBeInTheDocument();
    expect(screen.queryByText(/interesting place you visited recently/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Scenario · A1/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('radiogroup', { name: 'Select learning level' })
    ).not.toBeInTheDocument();
  });

  it('uses classified B1 pedagogy even if the prop says a1', async () => {
    setUserLevel('b1');
    render(<ChatTab level="a1" />);
    expect(screen.getByText(/interesting place you visited recently/i)).toBeInTheDocument();
    expect(screen.queryByText('Say hello and tell Anna your name.')).not.toBeInTheDocument();

    await sendHallo();
    const system = callClaude.mock.calls[0][0];
    expect(system).toContain(activePack.prompts.levels.b1);
    expect(system).not.toContain('A1 BEGINNER');
    expect(callClaude.mock.calls[0][3].level).toBe('b1');
  });

  it('puts learned terms in the prompt and still works when the set is empty', async () => {
    const greetings = activePack.content.decks.greetings;
    const learnedWords = Object.fromEntries(greetings.slice(0, 9).map((c) => [c.id, true]));
    const first = render(<ChatTab learnedWords={learnedWords} />);
    await sendHallo();
    const system = callClaude.mock.calls[0][0];
    expect(system).toContain("Stay within the learner's known vocabulary.");
    expect(system).toContain(greetings[0].de);
    expect(system).not.toContain('small starter set');

    first.unmount();
    callClaude.mockClear();
    render(<ChatTab learnedWords={{}} learnedByDeck={{}} />);
    await sendHallo();
    const sparse = callClaude.mock.calls[0][0];
    expect(sparse).toContain('small starter set');
    expect(callClaude.mock.calls[0][3].vocab.length).toBeGreaterThan(0);
  });

  it('includes a learned interest term and biases toward enabled topics', async () => {
    const sport = activePack.content.interestDecks['interest-sport'];
    const card = sport[0];
    render(
      <ChatTab
        learnedByDeck={{ 'interest-sport': { [card.id]: true } }}
        enabledInterests={['sport']}
      />
    );
    await sendHallo();
    const system = callClaude.mock.calls[0][0];
    expect(system).toContain(card.de);
    expect(system).toContain('sports and athletic activities');
  });
});

describe('ChatTab speech', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
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
