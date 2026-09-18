/**
 * The three surfaces a first-time learner needs pointed out, in the order they
 * meet them.
 *
 * `status` is the header StatusChip: CEFR code plus XP live on its face, and
 * retaking the placement test is what changes the practice level.
 */
export const TUTORIAL_STEPS = Object.freeze([
  {
    id: 'status',
    title: 'Your level',
    body: 'A1, A2 or B1, alongside the XP you have earned. Tap it any time to retake placement or check your rank.',
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
