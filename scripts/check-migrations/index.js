#!/usr/bin/env node
// Does the Supabase project have every migration this repo has committed?
//
// The bug this exists for: E4 (#237) merged with
// 20260904140000_progress_events_seen.sql and nobody applied it. That file
// changed apply_progress_event's ARITY, so the deployed endpoint called an
// 8-arg RPC against a 7-arg database. Every progress write failed for ~26
// hours. Nothing was red — CI only ever saw the LOCAL stack, where
// `supabase start` applies every migration and everything looks perfect.
//
// A merged migration file is not an applied migration.
//
// USAGE
//   SUPABASE_ACCESS_TOKEN=<scoped PAT> npm run check:migrations
//
// The token needs one permission: read this project's database. Supabase's own
// guidance is to use a SCOPED personal access token for CI rather than a
// classic one, which carries your whole account on every org and project you
// will ever belong to.

import { readdirSync } from 'node:fs';
import { compareMigrations } from './compare.js';

// Not a secret: this is the host in the public VITE_SUPABASE_URL that ships in
// the browser bundle. Overridable so the check can be pointed at a branch.
const DEFAULT_REF = 'xcnnlczvxmuwcqwychox';
const MIGRATIONS_DIR = 'supabase/migrations';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF || DEFAULT_REF;

if (!token) {
  // Skip loudly. A quiet skip is the failure mode this whole script is about:
  // "nothing inspected" and "nothing wrong" print identically otherwise.
  console.log('check-migrations: SKIPPED — SUPABASE_ACCESS_TOKEN is not set.');
  console.log('check-migrations: NOTHING WAS VERIFIED. Drift against the project is unknown.');
  process.exit(0);
}

// Overridable so the runner itself can be exercised against a stub; the fetch,
// parse and exit-code wiring is not covered by compare.js's pure tests.
const apiBase = process.env.SUPABASE_API_URL || 'https://api.supabase.com';

const res = await fetch(`${apiBase}/v1/projects/${ref}/database/migrations`, {
  headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
});

if (!res.ok) {
  // Never echo the token, not even its length. Report the status only.
  console.error(`check-migrations: the Management API returned ${res.status} for project ${ref}.`);
  if (res.status === 401 || res.status === 403) {
    console.error('check-migrations: the token is missing, expired, or lacks database read on this project.');
  }
  process.exit(1);
}

const body = await res.json().catch(() => null);
// The endpoint's 200 shape is undocumented ("List applied migration versions"),
// so accept the two plausible envelopes and let compareMigrations refuse
// anything it cannot compare on name.
const remoteRows = Array.isArray(body) ? body : (body?.migrations ?? []);

const result = compareMigrations(readdirSync(MIGRATIONS_DIR), remoteRows);

console.log(`check-migrations: project ${ref}`);
if (result.localCount !== undefined) {
  console.log(
    `check-migrations: compared ${result.localCount} repo migration(s) against ` +
      `${result.remoteCount} applied, matched by ${result.matchedBy}.`
  );
}

if (result.untracked?.length) {
  console.log(
    `check-migrations: ${result.untracked.length} applied migration(s) are not in the repo ` +
      `(applied by hand?): ${result.untracked.map((m) => m.name).join(', ')}`
  );
}

if (!result.ok) {
  if (result.reason) {
    console.error(`check-migrations: FAILED — ${result.reason}`);
  } else {
    console.error(`check-migrations: FAILED — ${result.unapplied.length} migration(s) NOT applied:`);
    for (const m of result.unapplied) console.error(`  - ${m.file}`);
    console.error('');
    console.error('Apply them under the production drill: baseline → apply → re-baseline → notify pgrst.');
    console.error('An arity change kills a whole lane; a missing column only degrades reads.');
  }
  process.exit(1);
}

console.log('check-migrations: OK — every repo migration is applied.');
