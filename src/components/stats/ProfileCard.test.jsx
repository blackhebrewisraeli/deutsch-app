import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

vi.mock('../../lib/leagues.js', () => ({
  TIER_NAMES: ['Bronze', 'Silver', 'Gold', 'Sapphire', 'Ruby'],
  fetchProfile: vi.fn(),
}));

import ProfileCard from './ProfileCard.jsx';
import { fetchProfile } from '../../lib/leagues.js';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it('renders fetched profile fields', async () => {
  fetchProfile.mockResolvedValue({
    handle: 'Rival',
    avatar_emoji: '🦊',
    tier: 1,
    total_xp: 420,
    longest_streak: 9,
    achievements: [],
  });
  render(<ProfileCard userId="x" onClose={() => {}} />);
  await waitFor(() => expect(screen.getByText('Rival')).toBeTruthy());
  expect(screen.getByText('Silver')).toBeTruthy();
  expect(screen.getByText(/420/)).toBeTruthy();
});

it('calls onClose when the close button is clicked', async () => {
  fetchProfile.mockResolvedValue({
    handle: 'R',
    avatar_emoji: null,
    tier: 0,
    total_xp: 0,
    longest_streak: 0,
    achievements: [],
  });
  const onClose = vi.fn();
  render(<ProfileCard userId="x" onClose={onClose} />);
  await waitFor(() => expect(screen.getByText('R')).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: /close/i }));
  expect(onClose).toHaveBeenCalled();
});

// ── Keyboard loop ────────────────────────────────────────────
// PR #143 made the league rows reachable by Tab and activatable by Enter, but
// the card that opens was a plain <div>: focus stayed behind on the row, so a
// keyboard user pressed Enter and nothing moved, Escape did nothing, and the
// only way out was to Tab blindly through the page beneath the scrim. These
// assert the whole loop — in, out, and back to the exact row.

const PROFILE = {
  handle: 'Rival',
  avatar_emoji: null,
  tier: 0,
  total_xp: 0,
  longest_streak: 0,
  achievements: [],
};

// A stand-in for the leaderboard row, so the focus-return assertion names a
// real trigger outside the card rather than asserting against document.body.
function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        3. Rival
      </button>
      {open && <ProfileCard userId="x" onClose={() => setOpen(false)} />}
    </>
  );
}

it('is a modal dialog with an accessible name', async () => {
  fetchProfile.mockResolvedValue(PROFILE);
  render(<ProfileCard userId="x" onClose={() => {}} />);
  const dialog = await screen.findByRole('dialog');
  expect(dialog.getAttribute('aria-modal')).toBe('true');
  expect(dialog).toHaveAccessibleName();
});

it('moves focus into the card when it opens', async () => {
  fetchProfile.mockResolvedValue(PROFILE);
  render(<ProfileCard userId="x" onClose={() => {}} />);
  const dialog = await screen.findByRole('dialog');
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
});

it('closes on Escape', async () => {
  fetchProfile.mockResolvedValue(PROFILE);
  const onClose = vi.fn();
  render(<ProfileCard userId="x" onClose={onClose} />);
  await screen.findByRole('dialog');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('returns focus to the row that opened it', async () => {
  fetchProfile.mockResolvedValue(PROFILE);
  const user = userEvent.setup();
  render(<Harness />);

  const row = screen.getByRole('button', { name: '3. Rival' });
  await user.click(row);

  const dialog = await screen.findByRole('dialog');
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

  await user.keyboard('{Escape}');

  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(document.activeElement).toBe(row);
});

it('keeps Tab inside the card', async () => {
  fetchProfile.mockResolvedValue(PROFILE);
  const user = userEvent.setup();
  render(<Harness />);

  await user.click(screen.getByRole('button', { name: '3. Rival' }));
  const dialog = await screen.findByRole('dialog');
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

  // Enough tabs to walk past every focusable element in the card and wrap.
  await user.tab();
  expect(dialog.contains(document.activeElement)).toBe(true);
  await user.tab();
  expect(dialog.contains(document.activeElement)).toBe(true);

  await user.tab({ shift: true });
  expect(dialog.contains(document.activeElement)).toBe(true);
});

// ── Narrow viewports ─────────────────────────────────────────
// Measured at 320px: the card wanted 289px of handle + 48px of padding = 337px,
// the flex container clamped it to the 320px viewport, and the surplus did not
// shrink — it painted straight out of the card onto the scrim. jsdom has no
// layout, so these lock the three properties that let the card give way
// instead: it must be border-box (padding inside the width), it must be free to
// shrink, and a long handle must be allowed to break.
it('lets the card shrink instead of overflowing a narrow viewport', async () => {
  fetchProfile.mockResolvedValue({ ...PROFILE, handle: 'Maximiliane_Schwarzenberger' });
  render(<ProfileCard userId="x" onClose={() => {}} />);
  const dialog = await screen.findByRole('dialog');

  expect(dialog.style.boxSizing).toBe('border-box');
  expect(parseInt(dialog.style.minWidth, 10)).toBe(0);
  expect(dialog.style.maxWidth).not.toBe('');
});

it('breaks a long handle rather than letting it escape the card', async () => {
  fetchProfile.mockResolvedValue({ ...PROFILE, handle: 'Maximiliane_Schwarzenberger' });
  render(<ProfileCard userId="x" onClose={() => {}} />);
  await screen.findByRole('dialog');

  const handle = screen.getByRole('heading', { name: 'Maximiliane_Schwarzenberger' });
  expect(handle.style.overflowWrap).toBe('anywhere');
});
