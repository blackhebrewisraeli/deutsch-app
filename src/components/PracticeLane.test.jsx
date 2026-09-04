import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const recordEvent = vi.hoisted(() => vi.fn());
vi.mock('../lib/stats', async (importOriginal) => ({
  ...(await importOriginal()),
  recordEvent: (...a) => recordEvent(...a),
}));

// useLessons and lessons.js run FOR REAL — only fetch and recordEvent are
// stubbed. "Stay invisible unless there are units" is the whole contract, and
// mocking the hook would make it an assertion about a stub.
import PracticeLane from './PracticeLane';
import {
  flashcardExercise as flashcard,
  lessonUnit,
  pendingFetch,
  respondWith,
  warmLessonCache,
} from '../lib/lessonsTestHelpers';
import { activePack } from '../packs';

const props = { level: 'a1', tab: 'vocab' };
const BUNDLED = 'BUNDLED-TAB-CONTENT';
const bundled = <div>{BUNDLED}</div>;

const unit = (id, unitNumber, exercises) => lessonUnit({ id, unitNumber, exercises });
const warmCache = (lessons, over = {}) => warmLessonCache(lessons, over);
const pending = pendingFetch;

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  recordEvent.mockClear();
});

describe('PracticeLane — no units means nothing changes', () => {
  it('renders the bundled tab untouched while loading', () => {
    vi.stubGlobal('fetch', pending());
    render(<PracticeLane {...props}>{bundled}</PracticeLane>);
    expect(screen.getByText(BUNDLED)).toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('renders the bundled tab untouched for an empty track', async () => {
    vi.stubGlobal('fetch', respondWith(200, { lessons: [] }));
    render(<PracticeLane {...props}>{bundled}</PracticeLane>);
    await waitFor(() => expect(screen.getByText(BUNDLED)).toBeInTheDocument());
    expect(document.querySelector('details')).toBeNull();
  });

  it('renders the bundled tab untouched when the lane is broken', async () => {
    vi.stubGlobal('fetch', respondWith(500, { error: { code: 'server_error' } }));
    render(<PracticeLane {...props}>{bundled}</PracticeLane>);
    await waitFor(() => expect(screen.getByText(BUNDLED)).toBeInTheDocument());
    expect(document.querySelector('details')).toBeNull();
  });

  it('does NOT collapse the bundled tab when every exercise was dropped as invalid', async () => {
    vi.stubGlobal('fetch', respondWith(200, { lessons: [unit('u1', 1, [{ type: 'sudoku' }])] }));
    render(<PracticeLane {...props}>{bundled}</PracticeLane>);
    await waitFor(() => expect(screen.getByText(BUNDLED)).toBeInTheDocument());
    expect(document.querySelector('details')).toBeNull();
  });
});

describe('PracticeLane — with units', () => {
  it('renders units above the bundled content, which moves into a collapsible', async () => {
    warmCache([unit('u1', 1, [flashcard('a', 'Hallo')])]);
    vi.stubGlobal('fetch', pending());
    render(<PracticeLane {...props}>{bundled}</PracticeLane>);

    expect(await screen.findByRole('heading', { name: 'Hallo' })).toBeInTheDocument();
    const details = document.querySelector('details');
    expect(details).not.toBeNull();
    expect(details).toHaveTextContent(BUNDLED);
    // Primary journey first: the units must precede the collapsible in the DOM.
    const lane = details.parentElement;
    const kids = [...lane.children];
    expect(kids.indexOf(lane.querySelector('section'))).toBeLessThan(kids.indexOf(details));
  });

  it('collapses the bundled content by default, and opens on demand', async () => {
    const user = userEvent.setup();
    warmCache([unit('u1', 1, [flashcard('a', 'Hallo')])]);
    vi.stubGlobal('fetch', pending());
    render(<PracticeLane {...props}>{bundled}</PracticeLane>);
    await screen.findByRole('heading', { name: 'Hallo' });

    const details = document.querySelector('details');
    expect(details.open).toBe(false);
    await user.click(screen.getByText(activePack.content.lessonChrome.bundledHeading));
    expect(details.open).toBe(true);
  });

  it('keeps the bundled content MOUNTED while collapsed, so tab state survives', async () => {
    warmCache([unit('u1', 1, [flashcard('a', 'Hallo')])]);
    vi.stubGlobal('fetch', pending());
    render(<PracticeLane {...props}>{bundled}</PracticeLane>);
    await screen.findByRole('heading', { name: 'Hallo' });
    // <details> hides its children; it must not unmount them, or every tab
    // would reset its drill the moment a lesson appears.
    expect(screen.getByText(BUNDLED)).toBeInTheDocument();
  });

  it('orders units by unitNumber, not array position', async () => {
    warmCache([unit('u2', 2, [flashcard('b', 'Zwei')]), unit('u1', 1, [flashcard('a', 'Eins')])]);
    vi.stubGlobal('fetch', pending());
    render(<PracticeLane {...props}>{bundled}</PracticeLane>);
    const units = await screen.findAllByRole('article');
    expect(units.map((u) => u.getAttribute('aria-label'))).toEqual(['Einheit 1', 'Einheit 2']);
  });

  it('skips a unit with no renderable exercises but keeps its siblings', async () => {
    warmCache([unit('u1', 1, []), unit('u2', 2, [flashcard('b', 'Zwei')])]);
    vi.stubGlobal('fetch', pending());
    render(<PracticeLane {...props}>{bundled}</PracticeLane>);
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1));
  });
});

describe('PracticeLane — progress wiring (E5.5)', () => {
  const oneCard = () => warmCache([unit('u1', 1, [flashcard('a', 'Hallo')])]);

  it('records a graded answer against the lane’s own tab and level', async () => {
    const user = userEvent.setup();
    oneCard();
    vi.stubGlobal('fetch', pending());
    render(<PracticeLane {...props}>{bundled}</PracticeLane>);
    await user.click(await screen.findByRole('button', { name: 'Reveal meaning' }));
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(recordEvent).toHaveBeenCalledWith('vocab', 'a1', 'correct');
  });

  it('records exactly ONE event per exercise — no double count', async () => {
    const user = userEvent.setup();
    oneCard();
    vi.stubGlobal('fetch', pending());
    render(<PracticeLane {...props}>{bundled}</PracticeLane>);
    await user.click(await screen.findByRole('button', { name: 'Reveal meaning' }));
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    await user.click(screen.getByRole('button', { name: 'Not yet' }));
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(recordEvent).toHaveBeenCalledTimes(1);
  });

  it('counts two different exercises separately', async () => {
    const user = userEvent.setup();
    warmCache([unit('u1', 1, [flashcard('a', 'Hallo'), flashcard('b', 'Danke')])]);
    vi.stubGlobal('fetch', pending());
    render(<PracticeLane {...props}>{bundled}</PracticeLane>);
    await screen.findByRole('heading', { name: 'Hallo' });
    for (const reveal of screen.getAllByRole('button', { name: 'Reveal meaning' })) {
      await user.click(reveal);
    }
    for (const got of screen.getAllByRole('button', { name: 'Got it' })) {
      await user.click(got);
    }
    expect(recordEvent).toHaveBeenCalledTimes(2);
  });

  it('records nothing at all until an answer is graded', async () => {
    const user = userEvent.setup();
    oneCard();
    vi.stubGlobal('fetch', pending());
    render(<PracticeLane {...props}>{bundled}</PracticeLane>);
    await user.click(await screen.findByRole('button', { name: 'Reveal meaning' }));
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it('reports the tab it is mounted on, not a hardcoded one', async () => {
    const user = userEvent.setup();
    warmCache([unit('u9', 1, [flashcard('a', 'Hallo')])], { level: 'b1', tab: 'translate' });
    vi.stubGlobal('fetch', pending());
    render(
      <PracticeLane level="b1" tab="translate">
        {bundled}
      </PracticeLane>
    );
    await user.click(await screen.findByRole('button', { name: 'Reveal meaning' }));
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(recordEvent).toHaveBeenCalledWith('translate', 'b1', 'correct');
  });
});

describe('PracticeLane — copy lives in the pack', () => {
  it('holds no chrome copy of its own', () => {
    const src = readFileSync('src/components/PracticeLane.jsx', 'utf8');
    const { unitPrefix, heading, bundledHeading } = activePack.content.lessonChrome;
    for (const word of [unitPrefix, heading, bundledHeading]) {
      expect(src).not.toContain(word);
    }
  });
});
