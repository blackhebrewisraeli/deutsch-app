import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlacementTest from './PlacementTest';
import { buildPlacementItems } from '../lib/placement';
import { activePack } from '../packs';
import { getUserLevel, hasStoredLevel } from '../lib/levelPref';
import { readPlacement } from '../lib/placement';
import * as stats from '../lib/stats';

vi.mock('../lib/auth.js', () => ({
  isAuthConfigured: () => true,
  isGoogleAuthConfigured: () => false,
}));

const items = buildPlacementItems(activePack);

async function answerCurrent(user, item, { correctly = true } = {}) {
  if (item.kind === 'tiles') {
    const words = correctly ? item.words : [item.distractors[0]];
    for (const word of words) {
      await user.click(screen.getByRole('button', { name: `Add ${word} to answer` }));
    }
    await user.click(screen.getByRole('button', { name: /check/i }));
  } else if (item.kind === 'blanks') {
    const words = correctly
      ? item.blanks.map((b) => b.word)
      : item.blanks.map((b) => b.distractors[0]);
    for (const word of words) {
      await user.click(screen.getByRole('button', { name: `Add ${word}` }));
    }
    await user.click(screen.getByRole('button', { name: /check/i }));
  } else {
    const pick = correctly ? item.answer : item.options.find((o) => o !== item.answer);
    await user.click(screen.getByRole('button', { name: pick }));
  }
  const next = screen.getByRole('button', { name: /next|see my level/i });
  await user.click(next);
}

async function runPlacement(user, { correctly = true } = {}) {
  await user.click(screen.getByRole('button', { name: /^start$/i }));
  for (const item of items) {
    await answerCurrent(user, item, { correctly });
  }
}

describe('PlacementTest', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('opts into the entry-screen viewport class and offers a theme toggle', async () => {
    const { container } = render(<PlacementTest onComplete={() => {}} />);
    expect(container.firstChild).toHaveClass('entry-screen');
    expect(container.firstChild).toHaveAttribute('data-entry', 'placement');
    expect(screen.getByRole('button', { name: /^appearance$/i })).toBeInTheDocument();
  });

  it('takes its background from the ground token, not the foreground one', () => {
    const { container } = render(<PlacementTest onComplete={() => {}} />);
    expect(container.firstChild.style.background).toBe('var(--c-ground)');
    expect(container.firstChild.style.background).not.toBe('var(--c-fg)');
  });

  it('does not offer a cancel path on the first-time run', () => {
    render(<PlacementTest onComplete={() => {}} />);
    expect(screen.queryByRole('button', { name: /keep my current level/i })).toBeNull();
  });

  it('lets a retake cancel without writing a level', async () => {
    const onCancel = vi.fn();
    render(<PlacementTest onComplete={() => {}} onCancel={onCancel} allowCancel />);
    await userEvent.click(screen.getByRole('button', { name: /keep my current level/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(hasStoredLevel()).toBe(false);
  });

  it('starts on an A1 tile item from the pack, not a free picker', async () => {
    render(<PlacementTest onComplete={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /^start$/i }));
    expect(screen.getByText(items[0].prompt)).toBeInTheDocument();
    expect(screen.getByText(/question 1 of 9/i)).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: /level/i })).toBeNull();
  });

  it('places B1 when every band is answered correctly and writes through setUserLevel', async () => {
    const onComplete = vi.fn();
    const recordSpy = vi.spyOn(stats, 'recordEvent');
    render(<PlacementTest onComplete={onComplete} />);
    await runPlacement(userEvent.setup(), { correctly: true });

    expect(screen.getByRole('heading', { name: 'B1' })).toBeInTheDocument();
    expect(screen.getByText(/free typing/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(onComplete).toHaveBeenCalledWith('b1');
    expect(getUserLevel()).toBe('b1');
    expect(readPlacement()?.level).toBe('b1');
    expect(readPlacement()?.correct).toBe(9);
    expect(recordSpy).not.toHaveBeenCalled();
    recordSpy.mockRestore();
  });

  it('places A1 when the learner misses the A1 band', async () => {
    const onComplete = vi.fn();
    render(<PlacementTest onComplete={onComplete} />);
    await runPlacement(userEvent.setup(), { correctly: false });
    expect(screen.getByRole('heading', { name: 'A1' })).toBeInTheDocument();
    expect(screen.getByText(/word tiles/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete).toHaveBeenCalledWith('a1');
    expect(getUserLevel()).toBe('a1');
  });
});
