#!/usr/bin/env node
// `npm run audit:dead` — flag candidate dead code: modules under src/ that no
// non-test module imports (excluding entrypoints + the test setup). Heuristic,
// not gospel — a hit can be a real entrypoint or something loaded dynamically,
// so review before deleting. Always exits 0 (reporting tool, not a gate).
import { collectSources } from './lib/collect.js';
import { buildGraph, findOrphans } from './lib/moduleGraph.js';

// Build the graph from non-test sources so a module kept alive only by its own
// test still surfaces as unused-by-the-app.
const files = collectSources(['src'], { includeTests: false });
const graph = buildGraph(files);

const ENTRY = [/(^|\/)main\.jsx?$/, /(^|\/)test-setup\.js$/];
const orphans = findOrphans(files, graph, { entryPatterns: ENTRY });

if (orphans.length === 0) {
  console.log('✓ No orphan modules under src/.');
} else {
  console.log(`Found ${orphans.length} orphan module(s) under src/ — nothing imports them:\n`);
  for (const p of orphans) console.log(`  - ${p}`);
  console.log(
    '\nHeuristic: a hit may be an intended entrypoint or dynamically loaded. Review before deleting.'
  );
}
