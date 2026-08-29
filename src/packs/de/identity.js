// Copy for the Home identity strip.
//
// Lives in the pack for the same reason the mission copy does: IdentityStrip
// knows fields, not phrases, so no German reaches src/components.

export const IDENTITY = {
  /** Greets by name when there is one, and stays warm when there is not. */
  greeting: (name) => (name ? `Guten Tag, ${name}` : 'Guten Tag'),

  /**
   * "Member since Jun 2026". Formatting lives here rather than in the
   * component because month names are language, not layout.
   */
  memberSince: (date) =>
    `Member since ${date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`,

  /** Names the level chip for a screen reader, which sees only "A2" otherwise. */
  levelLabel: (level) => `Level ${level}`,

  settingsLink: 'Settings',
};
