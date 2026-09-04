import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FlashcardExercise from './FlashcardExercise';
import { SPACE } from '../../lib/theme';

const PAYLOAD = {
  term: 'Hallo',
  glosses: ['hello', 'hi'],
  ipa: '/ˈhalo/',
  example: 'Hallo, wie geht’s?',
};

describe('FlashcardExercise', () => {
  it('shows the term and IPA, and keeps the meaning hidden until reveal', () => {
    render(<FlashcardExercise type="flashcard" payload={PAYLOAD} />);
    expect(screen.getByRole('heading', { name: 'Hallo' })).toBeInTheDocument();
    expect(screen.getByText('/ˈhalo/')).toBeInTheDocument();
    expect(screen.queryByText('hello')).not.toBeInTheDocument();
    expect(screen.queryByText('Hallo, wie geht’s?')).not.toBeInTheDocument();
  });

  it('reveals every gloss and the example on tap', async () => {
    render(<FlashcardExercise type="flashcard" payload={PAYLOAD} />);
    await userEvent.click(screen.getByRole('button', { name: /reveal meaning/i }));
    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(screen.getByText('hi')).toBeInTheDocument();
    expect(screen.getByText('Hallo, wie geht’s?')).toBeInTheDocument();
  });

  it('uses a full-width thumb-sized reveal control', () => {
    render(<FlashcardExercise type="flashcard" payload={PAYLOAD} />);
    const reveal = screen.getByRole('button', { name: /reveal meaning/i });
    expect(reveal).toHaveStyle({ width: '100%', minHeight: `${SPACE[12]}px` });
  });

  it('lets a long compound break instead of widening the page', () => {
    render(
      <FlashcardExercise
        type="flashcard"
        payload={{ term: 'Donaudampfschifffahrtsgesellschaft', glosses: ['company'] }}
      />
    );
    expect(screen.getByRole('heading', { name: 'Donaudampfschifffahrtsgesellschaft' })).toHaveStyle(
      {
        overflowWrap: 'anywhere',
        maxWidth: '100%',
      }
    );
  });

  it('tolerates a missing or empty payload without throwing', () => {
    render(<FlashcardExercise type="flashcard" />);
    expect(screen.getByRole('button', { name: /reveal meaning/i })).toBeInTheDocument();
  });
});

describe('FlashcardExercise — self-rating (E5.5)', () => {
  it('offers no rating until the meaning is revealed — you cannot grade what you have not seen', () => {
    render(
      <FlashcardExercise payload={{ term: 'Hallo', glosses: ['hello'] }} onGraded={() => {}} />
    );
    expect(screen.queryByRole('button', { name: 'Got it' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Not yet' })).not.toBeInTheDocument();
  });

  it('reports correct for "Got it" and wrong for "Not yet"', async () => {
    const user = userEvent.setup();
    const onGraded = vi.fn();
    const { unmount } = render(
      <FlashcardExercise payload={{ term: 'Hallo', glosses: ['hello'] }} onGraded={onGraded} />
    );
    await user.click(screen.getByRole('button', { name: 'Reveal meaning' }));
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(onGraded).toHaveBeenCalledWith('correct');
    unmount();

    const second = vi.fn();
    render(<FlashcardExercise payload={{ term: 'Hallo', glosses: ['hello'] }} onGraded={second} />);
    await user.click(screen.getByRole('button', { name: 'Reveal meaning' }));
    await user.click(screen.getByRole('button', { name: 'Not yet' }));
    expect(second).toHaveBeenCalledWith('wrong');
  });

  it('grades once — a second tap cannot bank a second answer', async () => {
    const user = userEvent.setup();
    const onGraded = vi.fn();
    render(
      <FlashcardExercise payload={{ term: 'Hallo', glosses: ['hello'] }} onGraded={onGraded} />
    );
    await user.click(screen.getByRole('button', { name: 'Reveal meaning' }));
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    const notYet = screen.getByRole('button', { name: 'Not yet' });
    await user.click(notYet);
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(onGraded).toHaveBeenCalledTimes(1);
  });

  it('shows no rating controls at all when nobody is listening', async () => {
    const user = userEvent.setup();
    render(<FlashcardExercise payload={{ term: 'Hallo', glosses: ['hello'] }} />);
    await user.click(screen.getByRole('button', { name: 'Reveal meaning' }));
    expect(screen.queryByRole('button', { name: 'Got it' })).not.toBeInTheDocument();
  });
});
