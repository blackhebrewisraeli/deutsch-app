import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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

function chatLayoutGrid(container) {
  const grid = [...container.querySelectorAll('div')].find((el) =>
    (el.getAttribute('style') ?? '').includes('calc(100vh - 280px)')
  );
  expect(grid, 'Chat layout grid').toBeTruthy();
  return grid;
}

describe('ChatTab routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    callClaude.mockResolvedValue(reply);
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('sends chat routingContext, defaulting userTier to guest and Auto', async () => {
    render(<ChatTab />);
    await sendHallo();

    expect(callClaude).toHaveBeenCalledWith(expect.any(String), 'Hallo', expect.any(Array), {
      routingContext: { taskType: 'chat', userTier: 'guest', preferredModel: 'auto' },
      level: 'a1',
      vocab: expect.any(Array),
    });
  });

  it('passes a signed-in tier and the saved preferredModel', async () => {
    render(<ChatTab user={{ id: 'u1' }} preferredModel="balanced" />);
    await sendHallo();
    expect(callClaude.mock.calls[0][3].routingContext).toEqual({
      taskType: 'chat',
      userTier: 'free',
      preferredModel: 'balanced',
    });
  });

  it('lets the learner change the model from Chat, through the popover', async () => {
    const onPreferredModelChange = vi.fn();
    render(<ChatTab onPreferredModelChange={onPreferredModelChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Modell: Auto' }));
    const sheet = screen.getByRole('dialog', { name: 'Modell' });
    await userEvent.click(within(sheet).getByRole('button', { name: /balanced/i }));

    expect(onPreferredModelChange).toHaveBeenCalledWith('balanced');
    // Picking dismisses and hands focus back, the way the header sheets do.
    expect(screen.queryByRole('dialog', { name: 'Modell' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Modell: Auto' })).toHaveFocus();
  });

  it('names the saved preference on the closed trigger', () => {
    render(<ChatTab preferredModel="capable" />);
    expect(screen.getByRole('button', { name: 'Modell: Capable' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
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

describe('ChatTab conversation-first layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    callClaude.mockResolvedValue(reply);
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('does not claim there are no mistakes before a graded turn', () => {
    render(<ChatTab />);
    expect(screen.queryByText('Alles gut!')).not.toBeInTheDocument();
    expect(screen.queryByText(/no mistakes/i)).not.toBeInTheDocument();
    expect(screen.queryByText('No fix this time')).not.toBeInTheDocument();
  });

  it('does not paint A/B/C section markers or the Tip card', () => {
    render(<ChatTab />);
    expect(screen.queryByText(/^A$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^B$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^C$/)).not.toBeInTheDocument();
    expect(screen.queryByText('Tip')).not.toBeInTheDocument();
  });

  it('attaches a correction cue to the learner turn that was graded', async () => {
    callClaude.mockResolvedValue(
      JSON.stringify({
        de: 'Einen Kaffee, bitte.',
        ipa: '[ˈaɪ̯nən]',
        en: 'A coffee, please.',
        correction: {
          original: 'Hallo',
          fixed: 'Hallo!',
          explain: 'Add the punctuation.',
        },
      })
    );
    render(<ChatTab />);
    await sendHallo();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Needs a fix/i })).toBeInTheDocument();
    });
    expect(screen.queryByText('Alles gut!')).not.toBeInTheDocument();
  });

  it('marks a clean turn quietly instead of an empty panel', async () => {
    render(<ChatTab />);
    await sendHallo();
    await waitFor(() => {
      expect(screen.getByText('Hallo!')).toBeInTheDocument();
    });
    expect(screen.getByText('No fix this time')).toBeInTheDocument();
    expect(screen.queryByText('Alles gut!')).not.toBeInTheDocument();
  });

  it('keeps EN and IPA of the greeting behind disclosure', () => {
    render(<ChatTab />);
    expect(screen.getByText('Hallo! Womit möchtest du heute üben?')).toBeInTheDocument();
    expect(
      screen.queryByText('Hello! What would you like to practice today?')
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'EN' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'IPA' })).toBeInTheDocument();
  });

  it('collapses EN/IPA again when the scenario greeting is replaced', async () => {
    render(<ChatTab />);
    await userEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(screen.getByRole('radio', { name: 'Order Coffee scenario' }));
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByText('Hello! What would you like to practice today?')
    ).not.toBeInTheDocument();
  });

  it('keeps the model control below the thread when not wide', () => {
    const { container } = render(<ChatTab wide={false} />);
    const trigger = screen.getByRole('button', { name: 'Modell: Auto' });
    expect(trigger.closest('summary')).toBeNull();
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');

    // Ordered after the conversation panel, not stacked above it.
    const grid = chatLayoutGrid(container);
    const slots = [...grid.children];
    const composer = screen.getByRole('textbox', { name: 'Chat message in German' });
    const thread = slots.find((el) => el.contains(composer));
    const control = slots.find((el) => el.contains(trigger));
    expect(slots.indexOf(control)).toBeGreaterThan(slots.indexOf(thread));
  });

  // The whole point of the popover: Chat is the conversation, so four
  // preference buttons must not sit permanently in its tab order. They used to
  // — always visible in the wide aside, and one `<summary>` away when stacked.
  it.each([true, false])('mounts no preference buttons until opened (wide=%s)', (wide) => {
    render(<ChatTab wide={wide} />);
    for (const band of [/^Auto/i, /^Fast/i, /^Balanced/i, /^Capable/i]) {
      expect(screen.queryByRole('button', { name: band })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('group', { name: 'Chat model' })).not.toBeInTheDocument();
    // The control itself IS mounted — a zero-button assertion passes just as
    // well when the whole feature is gone.
    expect(screen.getByRole('button', { name: 'Modell: Auto' })).toBeInTheDocument();
  });

  it('uses a 220px rail plus a shrinking conversation track when wide', () => {
    const { container } = render(<ChatTab wide />);
    const grid = chatLayoutGrid(container);
    expect(grid.style.gridTemplateColumns).toBe('220px minmax(0, 1fr)');
  });

  it('uses a single shrinking track when not wide', () => {
    const { container } = render(<ChatTab wide={false} />);
    const grid = chatLayoutGrid(container);
    expect(grid.style.gridTemplateColumns).toBe('minmax(0, 1fr)');
  });
});
