/**
 * The three surfaces a first-time learner needs pointed out, in the order they
 * meet them.
 *
 * `status` is the header StatusChip, not a bare level switcher: the A1/A2/B1
 * control lives *inside* that chip's popover (see StatusChip.jsx), so the chip
 * is the only always-visible surface the level lives on, and the copy has to
 * say that tapping is what opens the switcher.
 */
export const TUTORIAL_STEPS = Object.freeze([
  {
    id: 'status',
    title: 'Your level',
    body: 'A1, A2 or B1, alongside the XP you have earned. Tap it any time to switch level or check your rank.',
  },
  {
    id: 'chat',
    title: 'Chat',
    body: 'Hold a real conversation in German. Replies come back pitched at your level, with corrections as you go.',
  },
  {
    id: 'stats',
    title: 'Profile',
    body: 'Your standing, the weekly leagues, and Settings. Start here when you want a picture of your practice — or to change how you learn.',
  },
]);
