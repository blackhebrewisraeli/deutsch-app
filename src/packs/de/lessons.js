// Chrome copy for the server-driven lesson overlay.
//
// Lives in the pack for the same reason HOME_CHROME does: LessonUnits knows
// structure — an ordered list of units, each a stack of exercises — and nothing
// about German. A heading authored in src/components is exactly the coupling
// the pack extraction was built to prevent.
export const LESSON_CHROME = {
  /** Section heading over the whole server-driven set. */
  heading: 'Lektionen',
  /** Prefixes the unit number: "Einheit 3". */
  unitPrefix: 'Einheit',

  /**
   * Summary label on the collapsible that holds the tab's bundled content once
   * server-driven units are on screen. The dynamic pathway is the primary
   * journey; the bundled decks and tables stay one tap away rather than several
   * screens down (owner decision, 2026-09-04).
   */
  bundledHeading: 'Reference & Bundled Practice',
};
