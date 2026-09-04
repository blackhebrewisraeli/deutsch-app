import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
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

import { renderLane } from './practiceLaneTestKit';
import {
  lessonUnit,
  pendingFetch,
  progressQueueSnapshot as queue,
  todayRoundTotal as todayTotal,
  warmLessonCache,
} from '../lib/lessonsTestHelpers';

const props = { level: 'a1', tab: 'vocab' };

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.stubGlobal('fetch', pendingFetch());
  warmLessonCache([lessonUnit({ exercises: [{ id: 'a', type: 'flashcard', payload: {} }] })]);
});

describe('PracticeLane dedupe — a renderer that fires twice still counts once', () => {
  it('swallows the second verdict for the same exercise', async () => {
    const user = userEvent.setup();
    renderLane(props);
    await user.click(await screen.findByRole('button', { name: 'Answer twice' }));
    expect(todayTotal()).toBe(1);
    expect(queue()).toHaveLength(1);
  });
});
