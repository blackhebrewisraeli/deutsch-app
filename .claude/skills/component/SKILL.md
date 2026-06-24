---
name: component
description: Use to pull up / locate a component or module in this repo before editing it — shows its path, one-line purpose, exports, imports, and (most importantly) which files depend on it, i.e. the blast radius of a change. Triggers — "where is X", "pull up X", "what depends on X / what uses X", "is X dead code", or "/component X".
---

# /component — pull up a project element

Locate any component/module in this repo and see its dependency **blast radius**
before you change it. This is the safe-maintenance shortcut: never edit an
element without first seeing what depends on it.

## Usage

`/component <name>` — e.g. `/component VocabTab`, `/component GoalRing`,
`/component theme`. Name match is case-insensitive and substring-based.

## What to do

1. Run the locator (read-only; scans `src/` + `api/`):
   ```bash
   npm run where -- <name>
   ```
2. Present the result to the user: **path**, **purpose**, **exports**,
   **imports**, and **who depends on it**.
3. If they want to edit it, open the file and treat the **dependents list as the
   blast radius** — the files to re-check and re-test after the change.
4. When relevant, offer the companion hygiene commands:
   - `npm run audit:dead` — modules nothing imports (candidate dead code).
   - `npm run clean` — clear stale build/dev caches before debugging.

## Notes

- Backed by `scripts/where.js` → `scripts/lib/moduleGraph.js` (pure, unit-tested
  in `scripts/lib/moduleGraph.test.js`). The script works outside Claude too.
- Heuristics are regex-based and match this repo's tidy top-of-file imports; they
  don't follow dynamic `import()` or runtime indirection. Treat output as a strong
  hint, not proof.
- Full toolkit + cache/cruft guidance: `docs/dev-toolkit.md`.
