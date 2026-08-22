import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TranslateTab from './TranslateTab';

// Each level renders a different exercise component off a differently shaped
// row (A1 `words`, A2 `template`, B1 free text), so a `level` that has moved
// ahead of `exercises` hands BlankExercise an A1 row and throws on
// `exercise.template.split`.
//
// The fix is a lifecycle contract, not logic inside this component: App.jsx
// renders it as `<TranslateTab key={level} …>`, so a switch remounts. These
// tests model that caller by rerendering with the key changed — a bare
// `level` prop change on a live instance is a call-site bug and is not
// something this component defends against. The end-to-end guarantee (the
// header control actually driving this tab) is asserted in App.test.jsx
// under "level coordination".
describe('TranslateTab — remounted per level, as the caller keys it', () => {
  it.each([
    ['a1', 'a2'],
    ['a2', 'a1'],
    ['a1', 'b1'],
    ['b1', 'a2'],
    ['a2', 'b1'],
    ['b1', 'a1'],
  ])('survives %s -> %s without a bank/level mismatch', (from, to) => {
    const { rerender } = render(<TranslateTab key={from} level={from} />);
    expect(() => rerender(<TranslateTab key={to} level={to} />)).not.toThrow();
  });

  it('renders the new level header immediately after the switch', () => {
    const { rerender } = render(<TranslateTab key="a1" level="a1" />);
    expect(screen.getByText(/A1 — WORD TILES/)).toBeInTheDocument();
    rerender(<TranslateTab key="a2" level="a2" />);
    expect(screen.getByText(/A2 — FILL THE BLANKS/)).toBeInTheDocument();
    expect(screen.queryByText(/A1 — WORD TILES/)).toBeNull();
  });

  it('starts every level at exercise 1 of the set', () => {
    const { rerender } = render(<TranslateTab key="a1" level="a1" />);
    expect(screen.getByText(/Exercise 1 \/ 10/)).toBeInTheDocument();
    rerender(<TranslateTab key="b1" level="b1" />);
    expect(screen.getByText(/Exercise 1 \/ 10/)).toBeInTheDocument();
  });

  // Positive control: without it, a green suite above proves nothing if the
  // header stopped rendering entirely.
  it('renders a mode header at all', () => {
    render(<TranslateTab level="b1" />);
    expect(screen.getByText(/B1 — FREE TYPING/)).toBeInTheDocument();
  });

  // Mounting each level standalone is what a keyed remount actually does.
  // Pins that no level is broken on a cold mount, which the rerender cases
  // above would not catch if `render` and `rerender` ever diverged.
  it.each(['a1', 'a2', 'b1'])('mounts %s cleanly from cold', (level) => {
    expect(() => render(<TranslateTab level={level} />)).not.toThrow();
  });
});
