import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VocabTab from './VocabTab';
import { activePack } from '../packs';
import { callClaude } from '../lib/claude';
import { srsKey } from '../lib/srs';
import indexJson from '../../public/lexicon/index.json';
import chunk0 from '../../public/lexicon/chunk-00.json';
import chunk1 from '../../public/lexicon/chunk-01.json';
import { __resetCache } from '../packs/lexiconStore';

vi.mock('../lib/claude', () => ({
  callClaude: vi.fn(),
}));

const DECKS = activePack.content.decks;
const STORAGE_KEY = 'deutsch-app-state-v1';

// VocabTab starts on the 'greetings' deck; with empty SRS state the queue is
// all-new cards in deck order, so the first card is deterministic.
const firstCard = (deckId = 'greetings') => DECKS[deckId][0];

const readSrs = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').srs ?? {};

const renderTab = (props = {}) =>
  render(
    <VocabTab level="a1" learnedWords={{}} markLearned={() => {}} mobile={false} {...props} />
  );

// Simulates the App parent: markLearned feeds back into learnedWords, so the
// "✓ LEARNED" badge can actually appear after a correct answer.
function StatefulHost({ level = 'a1' }) {
  const [learned, setLearned] = useState({});
  return (
    <VocabTab
      level={level}
      learnedWords={learned}
      markLearned={(id) => setLearned((prev) => ({ ...prev, [id]: true }))}
      mobile={false}
    />
  );
}

// The 4 multiple-choice tiles are the buttons whose label is an `en` value
// from the active deck (deck-picker buttons show deck names instead).
const choiceButtons = (deckId = 'greetings') => {
  const ens = DECKS[deckId].map((c) => c.en);
  return screen.getAllByRole('button').filter((b) => ens.includes(b.textContent));
};

describe('VocabTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('deck picker', () => {
    it('renders the four preset decks and the first greetings card', () => {
      renderTab();
      for (const name of ['Greetings', 'Food & Drink', 'Travel 10', 'Numbers']) {
        expect(screen.getByRole('button', { name: new RegExp(name) })).toBeInTheDocument();
      }
      expect(screen.getByText(firstCard().de)).toBeInTheDocument();
      expect(screen.getByText(`${DECKS.greetings.length} cards remaining`)).toBeInTheDocument();
    });

    it('switching decks resets the queue to the new deck', async () => {
      renderTab();
      await userEvent.click(screen.getByRole('button', { name: /Travel 10/ }));
      expect(screen.getByText(firstCard('travel').de)).toBeInTheDocument();
      expect(screen.getByText(`${DECKS.travel.length} cards remaining`)).toBeInTheDocument();
    });

    it('marks only the selected deck as pressed', async () => {
      renderTab();
      expect(screen.getByRole('button', { name: /Greetings/ })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      await userEvent.click(screen.getByRole('button', { name: /Travel 10/ }));
      expect(screen.getByRole('button', { name: /Travel 10/ })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      expect(screen.getByRole('button', { name: /Greetings/ })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
    });

    it('does not offer a custom deck button before one is generated', () => {
      renderTab();
      expect(screen.queryByRole('button', { name: /Your Deck/ })).not.toBeInTheDocument();
    });
  });

  describe('multiple-choice flow (a1)', () => {
    it('correct choice shows feedback, marks learned, and surfaces the badge', async () => {
      render(<StatefulHost />);
      const card = firstCard();
      const correct = choiceButtons().find((b) => b.textContent === card.en);
      await userEvent.click(correct);
      expect(screen.getByText('✓ CORRECT')).toBeInTheDocument();
      expect(screen.getByText('✓ LEARNED')).toBeInTheDocument();
    });

    it('wrong choice shows NOT QUITE and no learned badge', async () => {
      render(<StatefulHost />);
      const card = firstCard();
      const wrong = choiceButtons().find((b) => b.textContent !== card.en);
      await userEvent.click(wrong);
      expect(screen.getByText('✗ NOT QUITE')).toBeInTheDocument();
      expect(screen.queryByText('✓ LEARNED')).not.toBeInTheDocument();
      // wrong answers offer only the AGAIN verdict
      expect(screen.getByRole('button', { name: /AGAIN/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'GOOD' })).not.toBeInTheDocument();
    });
  });

  describe('SRS verdict buttons', () => {
    it('GOOD after a correct answer writes box 2 to storage and advances the queue', async () => {
      const markLearned = vi.fn();
      renderTab({ markLearned });
      const card = firstCard();
      await userEvent.click(choiceButtons().find((b) => b.textContent === card.en));
      expect(markLearned).toHaveBeenCalledWith(card.id);

      await userEvent.click(screen.getByRole('button', { name: 'GOOD' }));
      const entry = readSrs()[srsKey('greetings', card.id)];
      expect(entry).toMatchObject({ box: 2, reps: 1 });
      expect(entry.nextDue).toBeGreaterThan(entry.lastReviewed);
      // queue advanced: one fewer remaining, next card on screen
      expect(screen.getByText(`${DECKS.greetings.length - 1} cards remaining`)).toBeInTheDocument();
      expect(screen.getByText(DECKS.greetings[1].de)).toBeInTheDocument();
    });

    it('AGAIN after a wrong answer writes box 1 and re-queues the card', async () => {
      renderTab();
      const card = firstCard();
      await userEvent.click(choiceButtons().find((b) => b.textContent !== card.en));
      await userEvent.click(screen.getByRole('button', { name: /AGAIN/ }));

      expect(readSrs()[srsKey('greetings', card.id)]).toMatchObject({ box: 1, reps: 1 });
      // failed card goes to the back of the queue — count unchanged
      expect(screen.getByText(`${DECKS.greetings.length} cards remaining`)).toBeInTheDocument();
      expect(screen.getByText(DECKS.greetings[1].de)).toBeInTheDocument();
    });

    it('HARD and EASY verdicts map to their Leitner boxes', async () => {
      renderTab();
      const card = firstCard();
      await userEvent.click(choiceButtons().find((b) => b.textContent === card.en));
      await userEvent.click(screen.getByRole('button', { name: 'EASY' }));
      // easy from box 1 advances two boxes
      expect(readSrs()[srsKey('greetings', card.id)]).toMatchObject({ box: 3, reps: 1 });
    });
  });

  describe('typed answer flow (b1)', () => {
    it('disables CHECK while empty and grades a correct typed answer', async () => {
      render(<StatefulHost level="b1" />);
      const card = firstCard();
      const input = screen.getByRole('textbox', { name: 'Type the English meaning' });
      const check = screen.getByRole('button', { name: /CHECK/ });
      expect(check).toBeDisabled();

      await userEvent.type(input, card.en);
      await userEvent.click(check);
      expect(screen.getByText('✓ CORRECT')).toBeInTheDocument();
      expect(screen.getByText('✓ LEARNED')).toBeInTheDocument();
    });

    it('a far-off typed answer is wrong and offers only AGAIN', async () => {
      render(<StatefulHost level="b1" />);
      const input = screen.getByRole('textbox', { name: 'Type the English meaning' });
      await userEvent.type(input, 'zzzzzzzzzz');
      await userEvent.click(screen.getByRole('button', { name: /CHECK/ }));
      expect(screen.getByText('✗ NOT QUITE')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /AGAIN/ })).toBeInTheDocument();
    });
  });

  describe('plural and example rendering', () => {
    it('shows plural and example sentence for a noun card', async () => {
      const user = userEvent.setup();
      render(<VocabTab level="a1" learnedWords={{}} markLearned={() => {}} />);
      // Switch to the Food & Drink deck.
      await user.click(screen.getByRole('button', { name: /Food & Drink/i }));
      // The card face shows the plural label and the first example sentence.
      expect(await screen.findByText(/PL: Brote/)).toBeInTheDocument();
      expect(screen.getByText('Ich esse Brot.')).toBeInTheDocument();
    });
  });

  describe('custom deck generation', () => {
    const generated = [
      { de: 'die Sonne', en: 'the sun', ipa: '[ˈzɔnə]' },
      { de: 'der Regen', en: 'the rain', ipa: '[ˈʁeːɡn̩]' },
      { de: 'der Wind', en: 'the wind', ipa: '[vɪnt]' },
      { de: 'die Wolke', en: 'the cloud', ipa: '[ˈvɔlkə]' },
    ];

    it('calls the deck endpoint and renders the generated deck', async () => {
      callClaude.mockResolvedValue(JSON.stringify(generated));
      renderTab();

      await userEvent.type(screen.getByRole('textbox', { name: 'Custom deck topic' }), 'weather');
      await userEvent.click(screen.getByRole('button', { name: /GENERATE 10 CARDS/ }));

      expect(await screen.findByRole('button', { name: /Your Deck/ })).toBeInTheDocument();
      expect(callClaude).toHaveBeenCalledWith(expect.any(String), expect.any(String), [], {
        endpoint: 'deck',
      });
      expect(callClaude.mock.calls[0][1]).toContain('weather');
      // the generated deck becomes active: its first card is on screen
      expect(screen.getByText(generated[0].de)).toBeInTheDocument();
      expect(screen.getByText(`${generated.length} cards remaining`)).toBeInTheDocument();
    });

    it('strips markdown fences from the AI response', async () => {
      callClaude.mockResolvedValue('```json\n' + JSON.stringify(generated) + '\n```');
      renderTab();
      await userEvent.type(screen.getByRole('textbox', { name: 'Custom deck topic' }), 'weather');
      await userEvent.click(screen.getByRole('button', { name: /GENERATE 10 CARDS/ }));
      expect(await screen.findByRole('button', { name: /Your Deck/ })).toBeInTheDocument();
    });

    it('a malformed (non-JSON) AI response fails gracefully without a crash', async () => {
      const alertSpy = vi.fn();
      vi.stubGlobal('alert', alertSpy);
      callClaude.mockResolvedValue('Sorry, here are some words: Sonne, Regen');
      renderTab();

      await userEvent.type(screen.getByRole('textbox', { name: 'Custom deck topic' }), 'weather');
      await userEvent.click(screen.getByRole('button', { name: /GENERATE 10 CARDS/ }));

      await waitFor(() => expect(alertSpy).toHaveBeenCalled());
      expect(alertSpy.mock.calls[0][0]).toMatch(/Could not generate deck/);
      // no custom deck appears, the preset deck is still active and usable
      expect(screen.queryByRole('button', { name: /Your Deck/ })).not.toBeInTheDocument();
      expect(screen.getByText(firstCard().de)).toBeInTheDocument();
      // the generate button has left its loading state
      expect(screen.getByRole('button', { name: /GENERATE 10 CARDS/ })).toBeEnabled();
    });

    it('an API failure also surfaces the alert and keeps the tab alive', async () => {
      const alertSpy = vi.fn();
      vi.stubGlobal('alert', alertSpy);
      callClaude.mockRejectedValue(new Error('API call failed (429): slow down'));
      renderTab();

      await userEvent.type(screen.getByRole('textbox', { name: 'Custom deck topic' }), 'weather');
      await userEvent.click(screen.getByRole('button', { name: /GENERATE 10 CARDS/ }));

      await waitFor(() => expect(alertSpy).toHaveBeenCalled());
      expect(alertSpy.mock.calls[0][0]).toMatch(/429/);
      expect(screen.getByText(firstCard().de)).toBeInTheDocument();
    });
  });

  describe('auto deck loading', () => {
    beforeEach(() => {
      __resetCache();
      const fixtures = {
        '/lexicon/index.json': indexJson,
        '/lexicon/chunk-00.json': chunk0,
        '/lexicon/chunk-01.json': chunk1,
      };
      globalThis.fetch = vi.fn((url) => {
        const key = Object.keys(fixtures).find((k) => String(url).endsWith(k));
        return key
          ? Promise.resolve({ ok: true, json: () => Promise.resolve(fixtures[key]) })
          : Promise.resolve({ ok: false, status: 404 });
      });
    });

    it('loads a Topics deck and shows its cards', async () => {
      const user = userEvent.setup();
      render(<VocabTab level="a1" learnedWords={{}} markLearned={() => {}} />);
      await user.click(screen.getByRole('button', { name: /🍞 Food/i }));
      // food cards sorted by rank: n:wasser (rank 88) → "das Wasser"
      expect(await screen.findByText('das Wasser')).toBeInTheDocument();
    });
  });
});
