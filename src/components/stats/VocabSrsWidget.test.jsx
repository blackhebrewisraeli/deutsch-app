import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import VocabSrsWidget from './VocabSrsWidget';
import { srsKey } from '../../lib/srs';
import { activePack } from '../../packs';

const { decks } = activePack.content;
const CARD_TOTAL = Object.values(decks).reduce((sum, d) => sum + d.length, 0); // 40

describe('VocabSrsWidget', () => {
  it('counts every card as due when there is no SRS history', () => {
    render(<VocabSrsWidget srs={{}} now={Date.now()} />);
    expect(screen.getByText(String(CARD_TOTAL))).toBeInTheDocument(); // DUE NOW = 40
    expect(screen.getByText(new RegExp(`MASTERED · 0 OF ${CARD_TOTAL}`))).toBeInTheDocument();
  });

  it('counts a Box-5 card as mastered and not due', () => {
    const now = Date.now();
    const srs = {
      [srsKey('greetings', 'Hallo')]: {
        box: 5,
        lastReviewed: now,
        nextDue: now + 30 * 86400000,
        reps: 8,
      },
    };
    render(<VocabSrsWidget srs={srs} now={now} />);
    // 1 mastered of 40, and 39 due (the mastered one is scheduled in the future)
    expect(screen.getByText(new RegExp(`MASTERED · 1 OF ${CARD_TOTAL}`))).toBeInTheDocument();
    expect(screen.getByText(String(CARD_TOTAL - 1))).toBeInTheDocument(); // DUE NOW = 39
  });
});
