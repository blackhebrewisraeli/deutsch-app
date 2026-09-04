import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// The lane's own dedupe cannot be proven through a real renderer: every one of
// them locks itself after grading, so removing the lane guard changes nothing
// and the test passes on broken code (verified — it did). This file replaces
// the registry with a renderer that deliberately fires onGraded TWICE, which is
// the only thing the lane's Set is actually there to stop.
vi.mock('./exercises/exerciseRegistry', () => ({
  EXERCISE_TYPES: ['flashcard'],
  getExerciseComponent: () =>
    function DoubleFiring({ onGraded }) {
      return (
        <button
          onClick={() => {
            onGraded('correct');
            onGraded('correct');
          }}
        >
          Answer twice
        </button>
      );
    },
}));

import PracticeLane from './PracticeLane';
import { LESSONS_CACHE_KEY, cacheKeyFor } from '../lib/lessons';
import { QUEUE_KEY } from '../lib/progressQueue';
import { loadState } from '../lib/storage';
import { todayKey } from '../lib/stats';

const props = { level: 'a1', tab: 'vocab' };
const queue = () => JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
const todayTotal = () => loadState()?.daily?.[todayKey()]?.total ?? 0;

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {}))
  );
  localStorage.setItem(
    LESSONS_CACHE_KEY,
    JSON.stringify({
      [cacheKeyFor({ courseCode: 'de', packId: 'de', ...props })]: {
        lessons: [
          {
            id: 'u1',
            packId: 'de',
            courseCode: 'de',
            level: 'a1',
            tab: 'vocab',
            unitNumber: 1,
            exercises: [{ id: 'a', type: 'flashcard', payload: {} }],
          },
        ],
      },
    })
  );
});

describe('PracticeLane dedupe — a renderer that fires twice still counts once', () => {
  it('swallows the second verdict for the same exercise', async () => {
    const user = userEvent.setup();
    render(
      <PracticeLane {...props}>
        <div>bundled</div>
      </PracticeLane>
    );
    await user.click(await screen.findByRole('button', { name: 'Answer twice' }));
    expect(todayTotal()).toBe(1);
    expect(queue()).toHaveLength(1);
  });
});
