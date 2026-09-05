import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LessonUnits from './LessonUnits';
import { flashcardExercise as flashcard, lessonUnit } from '../lib/lessonsTestHelpers';
import { XP_PER_VERDICT } from '../lib/gameConfig';

const chrome = {
  heading: 'Lektionen',
  unitPrefix: 'Einheit',
  locked: 'Gesperrt',
  inProgress: 'In Arbeit',
  completed: 'Geschafft',
  progressLabel: 'Fortschritt',
  xpSuffix: 'XP',
};

const unit = (id, unitNumber, exercises) => lessonUnit({ id, unitNumber, exercises });

function renderUnits({ units, grades = {}, streak = 0, onGraded = vi.fn() } = {}) {
  return render(
    <LessonUnits
      units={units}
      grades={grades}
      chrome={chrome}
      streak={streak}
      onGraded={onGraded}
    />
  );
}

describe('LessonUnits — visual states', () => {
  it('marks a single open unit in-progress', () => {
    renderUnits({ units: [unit('u1', 1, [flashcard('a', 'Hallo')])] });
    const article = screen.getByRole('article', { name: 'Einheit 1' });
    expect(article).toHaveAttribute('data-unit-state', 'in-progress');
    expect(article).not.toHaveAttribute('aria-disabled');
    expect(within(article).getByText(chrome.inProgress)).toBeInTheDocument();
  });

  it('locks later units and keeps gradeable controls off them', () => {
    renderUnits({
      units: [unit('u1', 1, [flashcard('a', 'Eins')]), unit('u2', 2, [flashcard('b', 'Zwei')])],
    });
    const first = screen.getByRole('article', { name: 'Einheit 1' });
    const second = screen.getByRole('article', { name: 'Einheit 2' });
    expect(first).toHaveAttribute('data-unit-state', 'in-progress');
    expect(second).toHaveAttribute('data-unit-state', 'locked');
    expect(second).toHaveAttribute('aria-disabled', 'true');
    expect(within(second).getByText(chrome.locked)).toBeInTheDocument();
    expect(within(second).queryByRole('button', { name: 'Reveal meaning' })).toBeNull();
    expect(within(first).getByRole('button', { name: 'Reveal meaning' })).toBeInTheDocument();
  });

  it('exposes a progressbar for the active unit', () => {
    renderUnits({
      units: [unit('u1', 1, [flashcard('a', 'Hallo'), flashcard('b', 'Danke')])],
      grades: { a: 'correct' },
    });
    const bar = screen.getByRole('progressbar', { name: chrome.progressLabel });
    expect(bar).toHaveAttribute('aria-valuenow', '1');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '2');
  });

  it('marks a finished unit completed and keeps its exercises mounted', () => {
    renderUnits({
      units: [unit('u1', 1, [flashcard('a', 'Hallo')])],
      grades: { a: 'correct' },
    });
    const article = screen.getByRole('article', { name: 'Einheit 1' });
    expect(article).toHaveAttribute('data-unit-state', 'completed');
    expect(within(article).getByText(chrome.completed)).toBeInTheDocument();
    expect(within(article).getByRole('heading', { name: 'Hallo' })).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('unlocks the next unit once the previous is completed', () => {
    renderUnits({
      units: [unit('u1', 1, [flashcard('a', 'Eins')]), unit('u2', 2, [flashcard('b', 'Zwei')])],
      grades: { a: 'correct' },
    });
    expect(screen.getByRole('article', { name: 'Einheit 1' })).toHaveAttribute(
      'data-unit-state',
      'completed'
    );
    const second = screen.getByRole('article', { name: 'Einheit 2' });
    expect(second).toHaveAttribute('data-unit-state', 'in-progress');
    expect(within(second).getByRole('button', { name: 'Reveal meaning' })).toBeInTheDocument();
  });

  it('shows streak fire and an XP badge on the active unit', () => {
    renderUnits({
      units: [unit('u1', 1, [flashcard('a', 'Hallo')])],
      grades: { a: 'correct' },
      streak: 4,
    });
    // The single unit is completed; chrome still surfaces the session streak and unit XP.
    const article = screen.getByRole('article', { name: 'Einheit 1' });
    expect(within(article).getByText('4')).toBeInTheDocument();
    expect(
      within(article).getByText(`${XP_PER_VERDICT.correct} ${chrome.xpSuffix}`)
    ).toBeInTheDocument();
  });

  it('forwards onGraded from an in-progress exercise', async () => {
    const user = userEvent.setup();
    const onGraded = vi.fn();
    renderUnits({ units: [unit('u1', 1, [flashcard('a', 'Hallo')])], onGraded });
    await user.click(screen.getByRole('button', { name: 'Reveal meaning' }));
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(onGraded).toHaveBeenCalledWith('a', 'correct');
  });
});

describe('LessonUnits — copy lives in the pack', () => {
  it('holds no chrome copy of its own', () => {
    const src = readFileSync('src/components/LessonUnits.jsx', 'utf8');
    for (const word of [
      chrome.heading,
      chrome.unitPrefix,
      chrome.locked,
      chrome.inProgress,
      chrome.completed,
      chrome.progressLabel,
    ]) {
      expect(src).not.toContain(word);
    }
  });
});
