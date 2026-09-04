import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExerciseViewer from './ExerciseViewer';

// Relative to the repo root — vitest runs from there, and `process` is not a
// declared global for this eslint config (see src/safeArea.test.js).
const DIR = 'src/components/exercises';

function walkJsx(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (/\.(js|jsx)$/.test(full) && !/\.test\.(js|jsx)$/.test(full)) out.push(full);
  }
  return out;
}

describe('ExerciseViewer', () => {
  it('renders a flashcard from a { type, payload } exercise', () => {
    render(
      <ExerciseViewer
        type="flashcard"
        payload={{ term: 'Danke', glosses: ['thank you'], ipa: '/ˈdaŋkə/' }}
      />
    );
    expect(screen.getByRole('heading', { name: 'Danke' })).toBeInTheDocument();
    expect(screen.getByText('/ˈdaŋkə/')).toBeInTheDocument();
  });

  it('renders a translate stub from a { type, payload } exercise', () => {
    render(
      <ExerciseViewer
        type="translate"
        payload={{ prompt: 'See you later', accepted: ['Bis später'], direction: 'en-de' }}
      />
    );
    expect(screen.getByText('See you later')).toBeInTheDocument();
  });

  it('falls back gracefully when the type is unknown', () => {
    render(<ExerciseViewer type="hologram" payload={{ term: 'should not render' }} />);
    expect(screen.getByRole('status')).toHaveTextContent(/not available/i);
    expect(screen.queryByText('should not render')).not.toBeInTheDocument();
  });

  it('falls back when type is missing entirely', () => {
    render(<ExerciseViewer payload={{ term: 'Hallo' }} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('keeps reveal state inside the stub — the viewer does not fetch or grade', async () => {
    render(<ExerciseViewer type="flashcard" payload={{ term: 'Bitte', glosses: ['please'] }} />);
    expect(screen.queryByText('please')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /reveal meaning/i }));
    expect(screen.getByText('please')).toBeInTheDocument();
  });

  it('caps the column at phone width so a desktop viewport stays portrait, not a shrunken desktop', () => {
    const { container } = render(
      <ExerciseViewer type="flashcard" payload={{ term: 'Ja', glosses: ['yes'] }} />
    );
    expect(container.firstChild).toHaveStyle({ maxWidth: '480px', width: '100%' });
  });
});

describe('exercise components stay presentation-only', () => {
  it('is not imported by the PWA entry or App — E4 does not hide inside this slice', () => {
    const app = readFileSync('src/App.jsx', 'utf8');
    const main = readFileSync('src/main.jsx', 'utf8');
    expect(app).not.toMatch(/ExerciseViewer|ExercisePreview|exerciseRegistry/);
    expect(main).not.toMatch(/ExerciseViewer|ExercisePreview|exerciseRegistry|exercise-preview/);
  });

  it('nothing in this folder fetches, talks to Supabase, or writes progress', () => {
    // Spec §7.3 / E4: the progress RPC and B2 sync cannot both write. These
    // stubs must not grow a caller by accident. A later adoption plan wires
    // one writer — not this slice.
    const forbidden = /fetch\(|supabase|\/api\/v1\/|recordEvent|applyEvent|apply_progress_event/;
    const offenders = walkJsx(DIR).filter((f) => forbidden.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
