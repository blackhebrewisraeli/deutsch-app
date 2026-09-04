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
};
