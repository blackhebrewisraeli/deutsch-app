import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BadgeGrid from './BadgeGrid';
import { ACHIEVEMENTS } from '../../lib/gamification';
import { BORDER, FONT_SIZE, LINE_HEIGHT, OPACITY } from '../../lib/theme';

const tiles = () => screen.getAllByRole('listitem');
const tileFor = (state) => tiles().filter((t) => t.dataset.badge === state);

describe('BadgeGrid', () => {
  it('marks earned vs locked badges', () => {
    render(<BadgeGrid achievements={{ streak3: 123 }} />);
    expect(screen.getByText('Drei am Stück')).toBeInTheDocument();
    // Derived from the catalogue, not hardcoded: a literal count goes stale
    // every time a badge is added, which is exactly what happened here.
    expect(ACHIEVEMENTS.length).toBeGreaterThan(1);
    expect(screen.getAllByText('FREIGESCHALTET')).toHaveLength(1);
    expect(screen.getAllByText('GESPERRT')).toHaveLength(ACHIEVEMENTS.length - 1);
  });
});

describe('BadgeGrid — flat, and legible when locked', () => {
  it('is a real list, so a screen reader can say how many badges there are', () => {
    render(<BadgeGrid achievements={{}} />);
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(tiles()).toHaveLength(ACHIEVEMENTS.length);
  });

  it('marks each tile with its state in the DOM, not only in colour', () => {
    render(<BadgeGrid achievements={{ streak3: 1 }} />);
    expect(tileFor('earned')).toHaveLength(1);
    expect(tileFor('locked')).toHaveLength(ACHIEVEMENTS.length - 1);
  });

  // The redesign's premise: fifteen earned tiles each carrying SHADOW.card read
  // as fifteen floating slabs. A hairline border draws the same boundary.
  it('carries no drop shadow on any tile', () => {
    render(<BadgeGrid achievements={{ streak3: 1, streak7: 2 }} />);
    for (const tile of tiles()) {
      expect(tile.style.boxShadow).toBe('');
    }
  });

  // The contrast regression this replaced. `opacity: 0.55` + `grayscale(1)` on
  // the whole tile dimmed the NAME as much as the icon, and a locked badge is
  // the thing telling a learner what to aim at — it has to stay readable.
  it('never dims a whole locked tile, only its icon', () => {
    render(<BadgeGrid achievements={{}} />);
    const locked = tileFor('locked')[0];
    expect(locked.style.opacity).toBe('');
    expect(locked.style.filter).toBe('');

    const icon = locked.querySelector('[aria-hidden="true"]');
    expect(icon.style.opacity).toBe(String(OPACITY.dim));
  });

  it('distinguishes the two states by border, not by absence of one', () => {
    render(<BadgeGrid achievements={{ streak3: 1 }} />);
    expect(tileFor('earned')[0].style.border).toBe(BORDER.panel);
    expect(tileFor('locked')[0].style.border).toBe(BORDER.panelDashed);
  });

  // The point of the refactor. Five literals — fontSize 30, fontSize 9,
  // fontWeight 600, opacity 0.55 and SHADOW.card — were decisions this file
  // had no business making alone. Asserting against the TOKEN rather than
  // against its current value is what keeps that true: if the scale moves,
  // this test moves with it instead of pinning a number.
  it('takes every visual value from the design system, not from a literal', () => {
    render(<BadgeGrid achievements={{ streak3: 1 }} />);
    const [icon, name, state] = tileFor('earned')[0].children;

    expect(icon.style.fontSize).toBe(`${FONT_SIZE['2xl']}px`);
    expect(icon.style.lineHeight).toBe(String(LINE_HEIGHT.tight));
    expect(name.style.fontSize).toBe(`${FONT_SIZE.base}px`);
    expect(name.style.lineHeight).toBe(String(LINE_HEIGHT.snug));
    expect(state.style.fontSize).toBe(`${FONT_SIZE.label}px`);
    expect(state.style.lineHeight).toBe(String(LINE_HEIGHT.normal));
  });
});
