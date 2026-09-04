import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// NOTHING is mocked here except fetch. stats.recordEvent, applyEvent, the
// localStorage state blob and the progress queue all run for real, because the
// invariant under test spans all four: one graded answer must produce exactly
// ONE local increment AND exactly ONE queued event. A mocked recordEvent can
// prove it was called once; only the real one can prove it did not write twice.
import PracticeLane from './PracticeLane';
import {
  flashcardExercise as card,
  lessonUnit,
  pendingFetch,
  progressQueueSnapshot as queue,
  todayRoundTotal as todayTotal,
  warmLessonCache,
} from '../lib/lessonsTestHelpers';

const props = { level: 'a1', tab: 'vocab' };
const warmCache = (exercises) => warmLessonCache([lessonUnit({ exercises })]);

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.stubGlobal('fetch', pendingFetch());
});

describe('PracticeLane progress — one answer, one increment, one event', () => {
  it('banks exactly one local round and one queued event', async () => {
    const user = userEvent.setup();
    warmCache([card('a', 'Hallo')]);
    render(
      <PracticeLane {...props}>
        <div>bundled</div>
      </PracticeLane>
    );
    expect(todayTotal()).toBe(0);
    expect(queue()).toHaveLength(0);

    await user.click(await screen.findByRole('button', { name: 'Reveal meaning' }));
    await user.click(screen.getByRole('button', { name: 'Got it' }));

    expect(todayTotal()).toBe(1);
    expect(queue()).toHaveLength(1);
    expect(queue()[0]).toMatchObject({ tab: 'vocab', level: 'a1', verdict: 'correct' });
  });

  it('a re-tapped answer adds neither a second increment nor a second event', async () => {
    const user = userEvent.setup();
    warmCache([card('a', 'Hallo')]);
    render(
      <PracticeLane {...props}>
        <div>bundled</div>
      </PracticeLane>
    );
    await user.click(await screen.findByRole('button', { name: 'Reveal meaning' }));
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    await user.click(screen.getByRole('button', { name: 'Not yet' }));
    await user.click(screen.getByRole('button', { name: 'Got it' }));

    expect(todayTotal()).toBe(1);
    expect(queue()).toHaveLength(1);
  });

  it('gives each queued event its own id, so the RPC can dedupe them', async () => {
    const user = userEvent.setup();
    warmCache([card('a', 'Hallo'), card('b', 'Danke')]);
    render(
      <PracticeLane {...props}>
        <div>bundled</div>
      </PracticeLane>
    );
    await screen.findByRole('heading', { name: 'Hallo' });
    for (const b of screen.getAllByRole('button', { name: 'Reveal meaning' })) await user.click(b);
    for (const b of screen.getAllByRole('button', { name: 'Got it' })) await user.click(b);

    const events = queue();
    expect(events).toHaveLength(2);
    expect(new Set(events.map((e) => e.id)).size).toBe(2);
    expect(todayTotal()).toBe(2);
  });

  it('records nothing for an ungraded exercise type', async () => {
    const user = userEvent.setup();
    warmCache([{ id: 'c1', type: 'chat', payload: { persona: 'X', initialMessage: 'Hallo!' } }]);
    render(
      <PracticeLane {...props}>
        <div>bundled</div>
      </PracticeLane>
    );
    const input = await screen.findByLabelText('Message');
    await user.type(input, 'Guten Tag');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(todayTotal()).toBe(0);
    expect(queue()).toHaveLength(0);
  });
});
