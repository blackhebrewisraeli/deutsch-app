import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AlphabetTab from './AlphabetTab';
import { speak } from '../lib/speech';
import { activePack } from '../packs';

vi.mock('../lib/speech', () => ({ speak: vi.fn() }));

const { alphabet: ALPHABET, alphabetQuiz: QUIZ_GROUPS } = activePack.content;
const firstGroup = QUIZ_GROUPS[0];

describe('AlphabetTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('quiz mode (default)', () => {
    it('starts in quiz mode with a replay button and the first group options', () => {
      render(<AlphabetTab level="a1" />);
      expect(screen.getByRole('button', { name: '🎧 Quiz' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      expect(screen.getByRole('button', { name: 'Play letter audio again' })).toBeInTheDocument();
      for (const letter of firstGroup.letters) {
        expect(screen.getByRole('button', { name: `Select letter ${letter}` })).toBeInTheDocument();
      }
    });

    it('replays the target letter on demand', async () => {
      render(<AlphabetTab level="a1" />);
      await userEvent.click(screen.getByRole('button', { name: 'Play letter audio again' }));
      expect(speak).toHaveBeenCalled();
      const [spoken] = speak.mock.calls.at(-1);
      expect(firstGroup.letters).toContain(spoken);
    });

    it('grades a guess and offers the next round', async () => {
      render(<AlphabetTab level="a1" />);
      // The target is random within the group; answering with every letter of
      // the group one at a time is blocked after the first answer, so grab the
      // verdict from whichever letter we pick.
      await userEvent.click(
        screen.getByRole('button', { name: `Select letter ${firstGroup.letters[0]}` })
      );
      expect(screen.getByText(/✓|✗/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'NEXT ROUND →' })).toBeInTheDocument();
      // Options are hidden once answered
      expect(
        screen.queryByRole('button', { name: `Select letter ${firstGroup.letters[1]}` })
      ).not.toBeInTheDocument();
    });
  });

  describe('browse mode', () => {
    it('shows the full letter grid when toggled', async () => {
      render(<AlphabetTab level="a1" />);
      await userEvent.click(screen.getByRole('button', { name: '📋 Browse' }));
      expect(screen.getByRole('button', { name: '📋 Browse' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      for (const letter of ALPHABET.slice(0, 3)) {
        expect(
          screen.getByRole('button', { name: `Select letter ${letter.l} for details` })
        ).toBeInTheDocument();
      }
    });

    it('speaks and shows the detail card when a letter is tapped', async () => {
      render(<AlphabetTab level="a1" />);
      await userEvent.click(screen.getByRole('button', { name: '📋 Browse' }));
      const first = ALPHABET[0];
      await userEvent.click(
        screen.getByRole('button', { name: `Select letter ${first.l} for details` })
      );
      expect(speak).toHaveBeenCalledWith(`${first.l}. ${first.w}`);
      expect(screen.getByText('EXAMPLE WORD')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: `Play pronunciation for ${first.w}` })
      ).toBeInTheDocument();
    });
  });
});
