#!/usr/bin/env node
// `npm run where -- <name>` — pull up a component/module before you touch it:
// its path, one-line purpose, exports, imports, and (most useful) who depends
// on it, so you can see the blast radius of a change. Read-only.
import { collectSources } from './lib/collect.js';
import { buildGraph, analyze } from './lib/moduleGraph.js';

const query = process.argv.slice(2).join(' ').trim();
if (!query) {
  console.error('Usage: npm run where -- <component-or-module-name>');
  process.exit(1);
}

const files = collectSources(['src', 'api'], { includeTests: true });
const graph = buildGraph(files);
const matches = analyze(query, files, graph);

if (matches.length === 0) {
  console.log(`No module matches "${query}".`);
  process.exit(0);
}

for (const m of matches) {
  console.log(`\n▶ ${m.path}`);
  if (m.purpose) console.log(`    purpose: ${m.purpose}`);
  if (m.exports.length) console.log(`    exports: ${m.exports.join(', ')}`);
  console.log(`    imports (${m.imports.length}): ${m.imports.join(', ') || '—'}`);
  console.log(`    depended on by (${m.dependents.length}):`);
  if (m.dependents.length) for (const d of m.dependents) console.log(`        - ${d}`);
  else console.log('        — nothing (leaf, entrypoint, or orphan)');
}
console.log('');
