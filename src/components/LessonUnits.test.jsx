import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, screen, waitFor } from '@testing-library/react';

// useLessons and lessons.js both run FOR REAL — only fetch is stubbed. The
// whole point of this component is "stay invisible unless there are units",
// and mocking the hook would make that assertion about a stub.
import LessonUnits from './LessonUnits';
import { LESSONS_CACHE_KEY, cacheKeyFor } from '../lib/lessons';
import { activePack } from '../packs';

const props = { level: 'a1', tab: 'vocab' };

const unit = (id, unitNumber, exercises) => ({
  id,
  packId: 'de',
  courseCode: 'de',
  level: 'a1',
  tab: 'vocab',
  unitNumber,
  exercises,
});

const flashcard = (id, term) => ({ id, type: 'flashcard', payload: { term, glosses: ['x'] } });

function respondWith(status, body) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

function warmCache(lessons) {
  localStorage.setItem(
    LESSONS_CACHE_KEY,
    JSON.stringify({ [cacheKeyFor({ ...props, courseCode: 'de', packId: 'de' })]: { lessons } })
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('LessonUnits — the overlay stays invisible unless there is content', () => {
  it('renders nothing while loading', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {}))
    );
    const { container } = render(<LessonUnits {...props} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for an empty track — today’s state for all twelve combinations', async () => {
    vi.stubGlobal('fetch', respondWith(200, { lessons: [] }));
    const { container } = render(<LessonUnits {...props} />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('renders nothing when the lane is broken, so the bundled tab is untouched', async () => {
    vi.stubGlobal('fetch', respondWith(500, { error: { code: 'server_error' } }));
    const { container } = render(<LessonUnits {...props} />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('renders nothing when every exercise in the only unit was dropped as invalid', async () => {
    vi.stubGlobal('fetch', respondWith(200, { lessons: [unit('u1', 1, [{ type: 'sudoku' }])] }));
    const { container } = render(<LessonUnits {...props} />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});

describe('LessonUnits — rendering units', () => {
  it('renders one exercise viewer per exercise, from the pack’s renderers', async () => {
    warmCache([unit('u1', 1, [flashcard('a', 'Hallo'), flashcard('b', 'Danke')])]);
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {}))
    );
    render(<LessonUnits {...props} />);
    expect(await screen.findByRole('heading', { name: 'Hallo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Danke' })).toBeInTheDocument();
  });

  it('orders units by unitNumber, not by array position', async () => {
    warmCache([unit('u2', 2, [flashcard('b', 'Zwei')]), unit('u1', 1, [flashcard('a', 'Eins')])]);
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {}))
    );
    render(<LessonUnits {...props} />);
    const units = await screen.findAllByRole('article');
    expect(units).toHaveLength(2);
    expect(units[0]).toHaveTextContent('Eins');
    expect(units[1]).toHaveTextContent('Zwei');
  });

  it('skips a unit with no renderable exercises but keeps its siblings', async () => {
    warmCache([unit('u1', 1, []), unit('u2', 2, [flashcard('b', 'Zwei')])]);
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {}))
    );
    render(<LessonUnits {...props} />);
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1));
    expect(screen.getByRole('article')).toHaveTextContent('Zwei');
  });
});

describe('LessonUnits — copy lives in the pack', () => {
  it('labels each unit with the pack’s prefix and the unit number', async () => {
    const { unitPrefix } = activePack.content.lessonChrome;
    warmCache([unit('u1', 3, [flashcard('a', 'Hallo')])]);
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {}))
    );
    render(<LessonUnits {...props} />);
    expect(await screen.findByRole('heading', { name: `${unitPrefix} 3` })).toBeInTheDocument();
  });

  it('holds no chrome copy of its own — the pack owns the words', () => {
    const src = readFileSync('src/components/LessonUnits.jsx', 'utf8');
    const { unitPrefix, heading } = activePack.content.lessonChrome;
    // A heading authored in src/components is exactly the coupling the pack
    // extraction exists to prevent (see packs/de/home.js).
    expect(src).not.toContain(unitPrefix);
    expect(src).not.toContain(heading);
  });
});
